import * as webpushModul from "web-push";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const webpush = webpushModul.default ?? webpushModul;

const START = 9 * 60, ENDE = 21 * 60; // Foto-Alarm zwischen 9 und 21 Uhr
const ABHOL_STUNDE = 8;               // Abhol-Erinnerung ab 8 Uhr morgens

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
webpush.setVapidDetails(
  "https://" + process.env.GITHUB_REPOSITORY_OWNER.toLowerCase() + ".github.io",
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

function berlin(d) {
  const teile = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(d);
  const g = t => teile.find(p => p.type === t).value;
  return { tag: `${g("year")}-${g("month")}-${g("day")}`, minuten: +g("hour") * 60 + +g("minute") };
}

function zielMinuten(tag) {
  const zahl = parseInt(createHash("sha256").update(tag + "wir-zwei").digest("hex").slice(0, 8), 16);
  return START + (zahl % (ENDE - START));
}

const vorname = text => text.trim().split(" ")[0];

async function senden(nachricht, userIds = null) {
  let abfrage = db.from("push_abos").select("id, abo");
  if (userIds) abfrage = abfrage.in("user_id", userIds);
  const { data: abos, error } = await abfrage;
  if (error) throw error;
  for (const { id, abo } of abos) {
    try {
      await webpush.sendNotification(abo, JSON.stringify(nachricht), { TTL: 3600, urgency: "high" });
      console.log("Gesendet an", id, nachricht.title);
    } catch (e) {
      console.log("Fehler bei", id, e.statusCode);
      if (e.statusCode === 404 || e.statusCode === 410) await db.from("push_abos").delete().eq("id", id);
    }
  }
}

async function schonGesendet(schluessel, tage = null) {
  const { data } = await db.from("erinnerungen").select("gesendet_um").eq("schluessel", schluessel).maybeSingle();
  if (!data) return false;
  if (tage === null) return true;
  return Date.now() - new Date(data.gesendet_um) < tage * 864e5;
}

async function merken(schluessel) {
  await db.from("erinnerungen").upsert({ schluessel, gesendet_um: new Date().toISOString() });
}

// 0) Neue Erinnerungen verschicken
async function notizenVerschicken(leute) {
  const { data: neue } = await db.from("notizen").select("*").eq("gesendet", false).eq("erledigt", false);
  for (const n of neue || []) {
    const von = (leute.find(p => p.user_id === n.von) || {}).name || "Jemand";
    const { count } = await db.from("notizen").select("id", { count: "exact", head: true })
      .eq("an", n.an).eq("erledigt", false);
    await senden({ title: `📝 Erinnerung von ${von}`, body: n.text, badge: count }, [n.an]);
    await db.from("notizen").update({ gesendet: true }).eq("id", n.id);
  }
}
// 1) Täglicher Foto-Alarm
async function fotoAlarm(jetzt, test) {
  if (test) return senden({ title: "Test 🔔", body: "Der Wecker funktioniert! 🎉" });
  if (jetzt.minuten < zielMinuten(jetzt.tag)) return console.log("Noch nicht Zeit für den Foto-Alarm.");
  const { data: letzte } = await db.from("alarme").select("ausgeloest_um")
    .order("ausgeloest_um", { ascending: false }).limit(1);
  if (letzte?.length && berlin(new Date(letzte[0].ausgeloest_um)).tag === jetzt.tag) {
    return console.log("Foto-Alarm heute schon ausgelöst.");
  }
  const { error } = await db.from("alarme").insert({ ausgeloest_um: new Date().toISOString() });
  if (error) throw error;
  await senden({ title: "📸 Jetzt!", body: "Zeig, was du gerade machst – du hast 2 Minuten!" });
}

// 2) Abhol-Erinnerung am Ankunftstag
async function abholErinnerung(jetzt, leute) {
  if (jetzt.minuten < ABHOL_STUNDE * 60) return;
  const { data: besuche } = await db.from("besuche").select("*")
    .gte("ankunft", new Date(Date.now() - 864e5).toISOString())
    .lte("ankunft", new Date(Date.now() + 2 * 864e5).toISOString());
  for (const b of besuche || []) {
    const ankunft = new Date(b.ankunft);
    if (berlin(ankunft).tag !== jetzt.tag) continue;
    const schluessel = "abholen-" + b.id;
    if (await schonGesendet(schluessel)) continue;
    const reisender = vorname(b.reisender);
    const abholer = leute.filter(p => p.name !== reisender).map(p => p.user_id);
    if (!abholer.length) continue;
    const uhrzeit = ankunft.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
    await senden({ title: "Heute ist es so weit! 💕", body: `${reisender} kommt um ${uhrzeit} Uhr am Hauptbahnhof an – nicht vergessen abzuholen! 🚉` }, abholer);
    await merken(schluessel);
  }
}

// 3) Ticket-Erinnerung: Wer ist als Nächstes dran?
async function ticketErinnerung(jetzt, leute) {
  if (jetzt.minuten < 10 * 60 || jetzt.minuten >= 20 * 60) return;
  const jetztIso = new Date().toISOString();
  const { data: geplant } = await db.from("besuche").select("id").gt("ankunft", jetztIso).limit(1);
  if (geplant?.length) return; // nächstes Treffen ist schon eingetragen
  const { data: letzte } = await db.from("besuche").select("*")
    .lte("ankunft", jetztIso).order("ankunft", { ascending: false }).limit(1);
  if (!letzte?.length) return;
  const b = letzte[0];
  const ende = new Date(b.abreise ? b.abreise + "T23:59:00" : b.ankunft);
  if (Date.now() - ende < 3 * 864e5) return; // erst 3 Tage nach dem Treffen
  const schluessel = "ticket-" + b.id;
  if (await schonGesendet(schluessel, 7)) return; // höchstens einmal pro Woche
  const zuletzt = vorname(b.reisender);
  const naechster = leute.filter(p => p.name !== zuletzt).map(p => p.user_id);
  if (!naechster.length) return;
  await senden({ title: "Du bist dran! 🚆", body: `${zuletzt} ist zuletzt gefahren – denk an dein Zugticket. Früh gebucht ist meistens günstiger!` }, naechster);
  await merken(schluessel);
}

// 4) Food-Diary-Erinnerung (13–21 Uhr, wenn man heute noch nichts gepostet hat)
async function essenErinnerung(jetzt, leute) {
  if (jetzt.minuten < 13 * 60 || jetzt.minuten >= 21 * 60) return;
  const seit = new Date(Date.now() - 20 * 36e5).toISOString();
  const { data } = await db.from("essen").select("user_id, erstellt_um").gte("erstellt_um", seit);
  const gepostet = new Set((data || []).filter(x => berlin(new Date(x.erstellt_um)).tag === jetzt.tag).map(x => x.user_id));
  for (const p of leute) {
    if (gepostet.has(p.user_id)) continue;
    const schluessel = `essen-${jetzt.tag}-${p.name}`;
    if (await schonGesendet(schluessel)) continue;
    await senden({ title: "🍽️ Was gab's heute?", body: "Mach ein Foto von deinem Essen fürs Food Diary!" }, [p.user_id]);
    await merken(schluessel);
  }
}

// 5) Gefühls-Check-in (sonntags 18–21 Uhr)
async function checkinErinnerung(jetzt, leute) {
  const wochentag = new Date(jetzt.tag + "T12:00:00Z").getUTCDay();
  if (wochentag !== 0 || jetzt.minuten < 18 * 60 || jetzt.minuten >= 21 * 60) return;
  const schluessel = "checkin-" + jetzt.tag;
  if (await schonGesendet(schluessel)) return;
  const seit = new Date(Date.now() - 6 * 864e5).toISOString();
  const { data } = await db.from("checkins").select("user_id").gte("erstellt_um", seit);
  const schonDa = new Set((data || []).map(x => x.user_id));
  const offen = leute.filter(p => !schonDa.has(p.user_id)).map(p => p.user_id);
  if (offen.length) await senden({ title: "💗 Wie geht's dir mit uns?", body: "Nimm dir kurz Zeit für euren wöchentlichen Check-in." }, offen);
  await merken(schluessel);
}

// 6) Monatsrückblick (am 1. des Monats ab 10 Uhr)
async function rueckblickErinnerung(jetzt) {
  if (!jetzt.tag.endsWith("-01") || jetzt.minuten < 10 * 60) return;
  const schluessel = "rueckblick-" + jetzt.tag;
  if (await schonGesendet(schluessel)) return;
  const vormonat = new Date(jetzt.tag + "T12:00:00Z");
  vormonat.setUTCDate(0);
  const monat = vormonat.toLocaleDateString("de-DE", { month: "long", timeZone: "UTC" });
  await senden({ title: "📅 Euer Monatsrückblick", body: `Schaut euch an, was ihr im ${monat} zusammen erlebt habt 💕` });
  await merken(schluessel);
}

// 7) To-dos am Fälligkeitstag (ab 9 Uhr)
async function todoErinnerung(jetzt) {
  if (jetzt.minuten < 9 * 60) return;
  const { data } = await db.from("liste").select("*").eq("art", "todo").eq("erledigt", false).eq("faellig", jetzt.tag);
  for (const t of data || []) {
    const schluessel = "todo-" + t.id;
    if (await schonGesendet(schluessel)) continue;
    await senden({ title: "✅ Heute fällig", body: t.text });
    await merken(schluessel);
  }
}
const test = process.env.TEST === "true";
const jetzt = berlin(new Date());
const { data: leute, error: personenFehler } = await db.from("personen").select("user_id, name");
if (personenFehler) throw personenFehler;

await fotoAlarm(jetzt, test);
await abholErinnerung(jetzt, leute);
await ticketErinnerung(jetzt, leute);
await notizenVerschicken(leute);
await essenErinnerung(jetzt, leute);
await checkinErinnerung(jetzt, leute);
await rueckblickErinnerung(jetzt);
await todoErinnerung(jetzt);
