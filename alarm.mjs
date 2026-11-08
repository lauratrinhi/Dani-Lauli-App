import * as webpushModul from "web-push";
const webpush = webpushModul.default ?? webpushModul;
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const START = 9 * 60, ENDE = 21 * 60; // Zeitraum: 9 bis 21 Uhr

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

const test = process.env.TEST === "true";
const jetzt = berlin(new Date());

if (!test) {
  if (jetzt.minuten < zielMinuten(jetzt.tag)) { console.log("Noch nicht Zeit."); process.exit(0); }
  const { data: letzte } = await db.from("alarme").select("ausgeloest_um")
    .order("ausgeloest_um", { ascending: false }).limit(1);
  if (letzte?.length && berlin(new Date(letzte[0].ausgeloest_um)).tag === jetzt.tag) {
    console.log("Heute schon ausgelöst."); process.exit(0);
  }
  const { error } = await db.from("alarme").insert({ ausgeloest_um: new Date().toISOString() });
  if (error) throw error;
}

const { data: abos, error: fehler } = await db.from("push_abos").select("id, abo");
if (fehler) throw fehler;

const nachricht = JSON.stringify(test
  ? { title: "Test 🔔", body: "Der Wecker funktioniert! 🎉" }
  : { title: "📸 Jetzt!", body: "Zeig, was du gerade machst – du hast 2 Minuten!" });

for (const { id, abo } of abos) {
  try {
    await webpush.sendNotification(abo, nachricht, { TTL: 300, urgency: "high" });
    console.log("Gesendet an", id);
  } catch (e) {
    console.log("Fehler bei", id, e.statusCode);
    if (e.statusCode === 404 || e.statusCode === 410) await db.from("push_abos").delete().eq("id", id);
  }
}
