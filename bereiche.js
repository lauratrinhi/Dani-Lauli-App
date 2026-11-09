/* =========================================================
   Alle Bereiche der App (Dates, Activity, Recap)
   ========================================================= */
window.B = {};

/* ---------- Gemeinsame Helfer ---------- */
// Setzt neuen Inhalt, ohne getippte Eingaben zu verlieren
function setzeHtml(el, html) {
  const werte = {};
  el.querySelectorAll("input[id], textarea[id]").forEach(f => { if (f.value) werte[f.id] = f.value; });
  const fokus = document.activeElement?.id;
  el.innerHTML = html;
  for (const [id, w] of Object.entries(werte)) { const f = document.getElementById(id); if (f && !f.value) f.value = w; }
  if (fokus && el.querySelector("#" + CSS.escape(fokus))) document.getElementById(fokus).focus();
}

function dateiWaehlen({ accept = "image/*", multiple = false, capture = null } = {}) {
  return new Promise(fertig => {
    const f = document.createElement("input");
    f.type = "file";
    f.accept = accept;
    f.multiple = multiple;
    if (capture) f.setAttribute("capture", capture);
    f.className = "versteckt";
    document.body.appendChild(f);
    f.onchange = () => { fertig([...f.files]); f.remove(); };
    f.click();
  });
}

// Formular in einem Blatt. "absenden" bekommt das Blatt und gibt true zurück, wenn es geschlossen werden soll.
function formularBlatt(titel, felderHtml, { ok = "Speichern", untertitel = "", absenden, beiStart } = {}) {
  const b = blatt(`
    <h3>${schuetzen(titel)}</h3>
    ${untertitel ? `<div class="meta">${schuetzen(untertitel)}</div>` : '<div style="height:8px"></div>'}
    ${felderHtml}
    <div class="reihe"><button class="knopf zweit" data-a="0">Abbrechen</button><button class="knopf" data-a="1">${ok}</button></div>`);
  let laeuft = false;
  b.el.addEventListener("click", async e => {
    const k = e.target.closest("[data-a]");
    if (!k || laeuft) return;
    if (k.dataset.a === "0") return b.zu();
    laeuft = true;
    k.style.opacity = ".6";
    try { if (await absenden(b.el)) b.zu(); }
    finally { laeuft = false; k.style.opacity = ""; }
  });
  if (beiStart) beiStart(b.el);
  setTimeout(() => b.el.querySelector("input, textarea")?.focus(), 250);
}

const wert = (wurzel, sel) => (wurzel.querySelector(sel)?.value || "").trim();
const schnitt = w => (w.reduce((a, b) => a + b, 0) / w.length).toFixed(1).replace(".", ",");
function bewertungZeile(bewertungen, id, feld = "eintrag_id") {
  return leute.map(p => {
    const w = bewertungen.filter(b => b[feld] === id && b.user_id === p.user_id).map(b => b.sterne);
    return w.length ? `${schuetzen(p.name)} <span class="sterne">★</span> ${schnitt(w)}` : null;
  }).filter(Boolean).join(" · ");
}
function segmentHtml(optionen, aktiv, fn) {
  return `<div class="segment">${optionen.map(([id, name]) => `<button class="${id === aktiv ? "aktiv" : ""}" onclick="${fn}('${id}')">${name}</button>`).join("")}</div>`;
}
const mehrKnopf = (fn, text, icon = "plus") => `<button class="knopf zweit" style="margin-bottom:14px" onclick="${fn}"><i class="ti ti-${icon}"></i> ${text}</button>`;
const istAktuell = id => aktuelleSeite === id;

/* ---- Würfeln (gleich in Orte, Kochbuch und Watchlist) ---- */
const wuerfelKnopf = fn => `<button class="knopf" onclick="${fn}"><i class="ti ti-dice-5"></i> Würfeln</button>`;
function wuerfelZiehen(liste, letzte, gewicht = () => 1) {
  const auswahl = liste.length > 1 ? liste.filter(x => x !== letzte) : liste;
  let r = Math.random() * auswahl.reduce((s, x) => s + gewicht(x), 0);
  return auswahl.find(x => (r -= gewicht(x)) <= 0) || auswahl[0];
}
function wuerfelFeld(text) {
  return `<div style="text-align:center;padding:8px 0 4px">
    <i class="ti ti-dice-5 w-wuerfel" style="font-size:44px;color:var(--blau-text);display:inline-block;transition:transform .12s"></i>
    <div class="meta">${text}</div>
    <div class="w-name" style="font-weight:800;font-size:26px;margin:4px 0;min-height:34px"></div>
    <div class="w-mehr"></div>
  </div>`;
}
async function wuerfelDrehen(box, namen, ende, aktiv) {
  const nameEl = box.querySelector(".w-name"), wuerfel = box.querySelector(".w-wuerfel");
  if (namen.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let pause = 50;
    for (let i = 0; i < 12; i++) {
      if (!aktiv()) return false;
      nameEl.textContent = namen[Math.floor(Math.random() * namen.length)];
      wuerfel.style.transform = `rotate(${(i + 1) * 30}deg)`;
      await new Promise(r => setTimeout(r, pause));
      pause *= 1.17;
    }
    wuerfel.style.transform = "";
  }
  if (!aktiv()) return false;
  nameEl.textContent = ende;
  return true;
}
const wuerfelKnoepfe = ok => `<div class="reihe" style="margin-top:14px">
  <button class="knopf zweit" data-a="nochmal"><i class="ti ti-refresh"></i> Nochmal</button>
  <button class="knopf" data-a="ok">${ok}</button></div>`;

/* =========================================================
   DATES · Liste
   ========================================================= */
registriereSeite("liste", {
  render(el) {
    zeigeMitCache("liste", () => hol(db.from("liste").select("*").eq("erledigt", false)
      .order("faellig", { nullsFirst: false }).order("erstellt_um")), daten => {
      if (!istAktuell("liste")) return;
      const alle = daten || [];
      const heute = new Date().toISOString().slice(0, 10);
      const zeile = x => `
        <div class="zeile">
          <button class="kreis" onclick="B.liste.fertig(${x.id}, this)" aria-label="Erledigt"><i class="ti ti-check"></i></button>
          <div class="inhalt">
            <div class="haupt">${schuetzen(x.text)}</div>
            <div class="neben">${x.faellig ? `<span style="${x.faellig < heute ? "color:var(--rot);font-weight:600" : ""}">bis ${datumKurz(x.faellig)}</span> · ` : ""}von ${schuetzen(nameVon(x.von))}</div>
          </div>
        </div>`;
      const treffen = alle.filter(x => x.art === "treffen");
      const todos = alle.filter(x => x.art === "todo");
      setzeHtml(el, `
        <div class="karte">
          <div class="karte-titel">Beim nächsten Treffen</div>
          ${treffen.map(zeile).join("") || '<div class="meta">Noch keine Ideen</div>'}
          <div class="eingabe-pille" style="margin-top:10px">
            <input id="liTreffen" placeholder="Was wollen wir machen?" enterkeyhint="send" onkeydown="if (event.key === 'Enter') B.liste.neu('treffen')">
            <button class="icon-knopf blau" onclick="B.liste.neu('treffen')" aria-label="Hinzufügen"><i class="ti ti-plus"></i></button>
          </div>
        </div>
        <div class="karte">
          <div class="karte-titel">To-dos</div>
          ${todos.map(zeile).join("") || '<div class="meta">Alles erledigt</div>'}
          <div class="eingabe-pille" style="margin-top:10px">
            <input id="liTodo" placeholder="z. B. Urlaub planen" enterkeyhint="send" onkeydown="if (event.key === 'Enter') B.liste.neu('todo')">
            <button class="icon-knopf" onclick="B.liste.datum()" aria-label="Fällig am"><i class="ti ti-calendar"></i></button>
            <button class="icon-knopf blau" onclick="B.liste.neu('todo')" aria-label="Hinzufügen"><i class="ti ti-plus"></i></button>
          </div>
          <div class="meta" id="liDatumInfo">${B.liste._datum ? "Fällig am " + datumKurz(B.liste._datum) : ""}</div>
        </div>`);
    });
  }
});

B.liste = {
  _datum: null,
  async datum() {
    const d = await eingabe("Bis wann?", { typ: "date", wert: B.liste._datum || "", hinweis: "Am Fälligkeitstag bekommt ihr beide eine Erinnerung.", ok: "Übernehmen" });
    if (d === null) return;
    B.liste._datum = d || null;
    const info = document.getElementById("liDatumInfo");
    if (info) info.textContent = d ? "Fällig am " + datumKurz(d) : "";
  },
  async neu(art) {
    const feld = document.getElementById(art === "todo" ? "liTodo" : "liTreffen");
    const text = feld.value.trim();
    if (!text) return;
    const faellig = art === "todo" ? B.liste._datum : null;
    if (await tun(db.from("liste").insert({ text, art, faellig }))) {
      feld.value = "";
      if (art === "todo") B.liste._datum = null;
      seiteAktualisieren();
    }
  },
  async fertig(id, kreis) {
    kreis?.classList.add("an");
    if (await tun(db.from("liste").update({ erledigt: true }).eq("id", id))) setTimeout(seiteAktualisieren, 350);
  }
};

/* =========================================================
   DATES · ABC-Dates
   ========================================================= */
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

registriereSeite("abc", {
  render(el) {
    zeigeMitCache("abc", async () => {
      const [zeilen, eintraege] = await Promise.all([hol(db.from("abc_buchstaben").select("*")), hol(db.from("abc_eintraege").select("buchstabe"))]);
      return { zeilen, eintraege };
    }, daten => {
      if (!istAktuell("abc")) return;
      B.abc._daten = daten || { zeilen: [], eintraege: [] };
      B.abc.zeichnen(el);
    });
  }
});

B.abc = {
  _daten: { zeilen: [], eintraege: [] },
  offen: null,

  stand() {
    const z = this._daten.zeilen || [];
    const fertig = z.filter(x => x.erledigt);
    const fertigSet = new Set(fertig.map(x => x.buchstabe));
    const aktuell = ABC.find(b => !fertigSet.has(b)) || null;
    const letzte = fertig.slice().sort((a, b) => ABC.indexOf(b.buchstabe) - ABC.indexOf(a.buchstabe))[0] || null;
    let planer = z.find(x => x.buchstabe === aktuell)?.geplant_von || null;
    if (!planer && letzte?.geplant_von) planer = leute.find(p => p.user_id !== letzte.geplant_von)?.user_id || null;
    return { fertigSet, aktuell, letzte, planer };
  },

  zeichnen(el) {
    const { fertigSet, aktuell, letzte, planer } = this.stand();
    const anzahl = {};
    (this._daten.eintraege || []).forEach(x => { anzahl[x.buchstabe] = (anzahl[x.buchstabe] || 0) + 1; });

    const kopf = aktuell ? `
      <div class="karte" style="text-align:center">
        <div class="meta">Als Nächstes dran</div>
        <div style="font-size:64px;font-weight:800;line-height:1.05;color:var(--blau-text)">${aktuell}</div>
        <div class="meta" style="margin:10px 0 6px">Wer plant das ${aktuell}-Date?</div>
        <div class="segment" style="margin-bottom:8px">${leute.map(p => `<button class="${p.user_id === planer ? "aktiv" : ""}" onclick="B.abc.planer('${p.user_id}')">${schuetzen(p.name)}</button>`).join("")}</div>
        ${letzte ? `<div class="meta">Zuletzt: ${letzte.buchstabe}${letzte.geplant_von ? " – geplant von " + schuetzen(nameVon(letzte.geplant_von)) : ""}${letzte.datum ? " · " + datumKurz(letzte.datum) : ""}</div>` : ""}
        <div class="reihe" style="margin-top:12px">
          <button class="knopf zweit" onclick="B.abc.oeffnen('${aktuell}')"><i class="ti ti-photo"></i> Erinnerungen</button>
          <button class="knopf" onclick="B.abc.erledigt()"><i class="ti ti-check"></i> Erledigt</button>
        </div>
      </div>` : `<div class="karte" style="text-align:center"><div class="countdown-zahl">Alphabet geschafft!</div><div class="meta">Alle 26 Buchstaben – Respekt.</div></div>`;

    const raster = ABC.map(b => {
      const fertig = fertigSet.has(b);
      const stil = fertig ? "background:var(--blau);color:#fff;border-color:var(--blau)"
        : b === aktuell ? "border:2px solid var(--blau-text);color:var(--blau-text)" : "";
      const auswahl = b === this.offen ? "box-shadow:0 0 0 2px var(--text)" : "";
      return `<button class="chip" style="width:100%;padding:10px 0;font-weight:700;font-size:17px;border-radius:12px;${stil};${auswahl}" onclick="B.abc.oeffnen('${b}')">${b}${anzahl[b] ? `<div style="font-size:10px;font-weight:600;opacity:.8">${anzahl[b]}×</div>` : ""}</button>`;
    }).join("");

    setzeHtml(el, `${kopf}
      <div class="karte">
        <div class="karte-titel">Alle Buchstaben</div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px">${raster}</div>
      </div>
      <div id="abcDetail"></div>`);
    if (this.offen) this.detail();
  },

  async planer(id) {
    const { aktuell } = this.stand();
    if (await tun(db.from("abc_buchstaben").upsert({ buchstabe: aktuell, geplant_von: id }))) seiteAktualisieren();
  },

  async erledigt() {
    const { aktuell, planer } = this.stand();
    if (!planer) return toast("Wähl zuerst aus, wer das " + aktuell + "-Date geplant hat.", "fehler");
    if (!await frage(`Das ${aktuell}-Date als erledigt markieren?`, { ja: "Erledigt", details: "Danach ist der nächste Buchstabe dran – und der andere plant." })) return;
    const ok = await tun(db.from("abc_buchstaben").upsert({ buchstabe: aktuell, geplant_von: planer, erledigt: true, datum: new Date().toLocaleDateString("sv-SE") }));
    if (!ok) return;
    const naechster = ABC[ABC.indexOf(aktuell) + 1];
    const anderer = leute.find(p => p.user_id !== planer)?.user_id;
    if (naechster && anderer) await tun(db.from("abc_buchstaben").upsert({ buchstabe: naechster, geplant_von: anderer }));
    toast(`${aktuell}-Date erledigt ✓`);
    this.offen = aktuell;
    seiteAktualisieren();
  },

  oeffnen(b) {
    this.offen = b;
    this.zeichnen(document.getElementById("seite-abc"));
    setTimeout(() => document.getElementById("abcDetail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  },

  detail() {
    const b = this.offen;
    zeigeMitCache("abc-" + b, async () => {
      const eintraege = await hol(db.from("abc_eintraege").select("*").eq("buchstabe", b).order("erstellt_um"));
      const ids = eintraege.map(e => e.id);
      const medien = ids.length ? await hol(db.from("abc_medien").select("*").in("eintrag_id", ids).order("erstellt_um")) : [];
      await bildUrlsHolen(medien.map(m => m.datei_pfad));
      return { eintraege, medien };
    }, daten => {
      const box = document.getElementById("abcDetail");
      if (!box || this.offen !== b) return;
      const { eintraege = [], medien = [] } = daten || {};
      const medienHtml = e => medien.filter(m => m.eintrag_id === e.id).map(m => m.typ === "video"
        ? `<video src="${bildUrl(m.datei_pfad)}" controls playsinline preload="metadata" style="width:100%;border-radius:10px;grid-column:span 3"></video>`
        : bildTag(m.datei_pfad)).join("");
      setzeHtml(box, `
        <div class="karte">
          <div class="karte-titel"><span style="font-size:26px;color:var(--blau-text)">${b}</span>
            <button class="icon-knopf" onclick="B.abc.offen=null;document.getElementById('abcDetail').innerHTML=''" aria-label="Schließen"><i class="ti ti-x"></i></button></div>
          ${eintraege.map(e => `
            <div style="padding:10px 0;border-top:0.5px solid var(--rand)">
              <div class="reihe"><div style="flex:1;font-weight:600;font-size:16px">${schuetzen(e.titel)}</div>
                <button class="icon-knopf blau" onclick="B.abc.medien(${e.id})" aria-label="Fotos hinzufügen"><i class="ti ti-camera-plus"></i></button>
                <button class="icon-knopf" onclick="B.abc.loeschen(${e.id})" aria-label="Löschen"><i class="ti ti-trash"></i></button></div>
              ${medien.some(m => m.eintrag_id === e.id) ? `<div class="raster" style="margin-top:8px">${medienHtml(e)}</div>` : ""}
            </div>`).join("") || '<div class="meta">Noch nichts eingetragen</div>'}
          <div class="eingabe-pille" style="margin-top:12px">
            <input id="abcTitel" placeholder="Was habt ihr gemacht? z. B. Brunch" enterkeyhint="send" onkeydown="if (event.key === 'Enter') B.abc.neu()">
            <button class="icon-knopf blau" onclick="B.abc.neu()" aria-label="Hinzufügen"><i class="ti ti-plus"></i></button>
          </div>
        </div>`);
    });
  },

  async neu() {
    const feld = document.getElementById("abcTitel");
    const titel = feld.value.trim();
    if (!titel) return;
    if (await tun(db.from("abc_eintraege").insert({ buchstabe: this.offen, titel }))) { feld.value = ""; seiteAktualisieren(); }
  },

  async loeschen(id) {
    if (!await frage("Diese Aktivität mit allen Fotos löschen?", { ja: "Löschen", gefahr: true })) return;
    if (await tun(db.from("abc_eintraege").delete().eq("id", id))) seiteAktualisieren();
  },

  async medien(eintragId) {
    const dateien = await dateiWaehlen({ accept: "image/*,video/*", multiple: true });
    if (!dateien.length) return;
    toast(`Lädt ${dateien.length} ${dateien.length === 1 ? "Datei" : "Dateien"} hoch …`);
    for (const datei of dateien) {
      try {
        let pfad, typ = "foto";
        if (datei.type.startsWith("video")) {
          typ = "video";
          pfad = `${ich.id}/abc-${Date.now()}.${(datei.name.split(".").pop() || "mov").toLowerCase()}`;
          const { error } = await db.storage.from("medien").upload(pfad, datei, { cacheControl: "31536000" });
          if (error) throw error;
        } else {
          pfad = await bildHochladen(datei, "abc-");
        }
        await tun(db.from("abc_medien").insert({ eintrag_id: eintragId, datei_pfad: pfad, typ }));
      } catch (e) { fehler(e); }
    }
    toast("Hochgeladen ✓");
    seiteAktualisieren();
  }
};

/* =========================================================
   DATES · Wünsche
   ========================================================= */
const ANLAESSE = ["Weihnachten", "Geburtstag", "Jahrestag", "Einfach so"];

registriereSeite("wuensche", {
  render(el) {
    zeigeMitCache("wuensche", async () => {
      const [wuensche, ideen] = await Promise.all([
        hol(db.from("wuensche").select("*").order("erstellt_um")),
        hol(db.from("geschenkideen").select("*").eq("erledigt", false).order("erstellt_um"))
      ]);
      return { wuensche, ideen };
    }, daten => {
      if (!istAktuell("wuensche")) return;
      const { wuensche = [], ideen = [] } = daten || {};
      const anderer = nameVon(andererId());
      const link = l => l && /^https?:\/\//i.test(l) ? ` · <a href="${schuetzen(l)}" target="_blank" rel="noopener">Link</a>` : "";
      const meine = wuensche.filter(w => w.user_id === ich.id);
      const seine = wuensche.filter(w => w.user_id !== ich.id);
      setzeHtml(el, `
        <div class="karte">
          <div class="karte-titel">Meine Wünsche <button class="icon-knopf blau rund" onclick="B.wuensche.neu('wunsch')" aria-label="Wunsch hinzufügen"><i class="ti ti-plus"></i></button></div>
          <div class="meta" style="margin-top:-6px;margin-bottom:6px">${schuetzen(anderer)} sieht sie – aber nicht, was schon besorgt ist.</div>
          ${meine.map(w => `<div class="zeile"><i class="ti ti-gift" style="font-size:20px;color:var(--text3)"></i>
            <div class="inhalt"><div class="haupt">${schuetzen(w.text)}</div><div class="neben">${schuetzen(w.anlass || "")}${link(w.link)}</div></div>
            <button class="icon-knopf" onclick="B.wuensche.loeschen(${w.id})" aria-label="Löschen"><i class="ti ti-trash"></i></button></div>`).join("") || '<div class="meta">Noch keine Wünsche</div>'}
        </div>
        <div class="karte">
          <div class="karte-titel">Wünsche von ${schuetzen(anderer)}</div>
          ${seine.map(w => {
            const vonMir = w.besorgt_von === ich.id;
            return `<div class="zeile"><button class="kreis ${vonMir ? "an" : ""}" onclick="B.wuensche.besorgt(${w.id}, ${vonMir})" aria-label="Besorgt"><i class="ti ti-check"></i></button>
              <div class="inhalt"><div class="haupt" style="${vonMir ? "text-decoration:line-through;color:var(--text2)" : ""}">${schuetzen(w.text)}</div>
              <div class="neben">${schuetzen(w.anlass || "")}${link(w.link)}${vonMir ? " · von dir besorgt" : ""}</div></div></div>`;
          }).join("") || '<div class="meta">Noch keine Wünsche</div>'}
        </div>
        <div class="karte">
          <div class="karte-titel">Geheime Geschenkideen <button class="icon-knopf blau rund" onclick="B.wuensche.neu('idee')" aria-label="Idee hinzufügen"><i class="ti ti-plus"></i></button></div>
          <div class="meta" style="margin-top:-6px;margin-bottom:6px"><i class="ti ti-lock"></i> Nur du siehst diese Liste.</div>
          ${ideen.map(w => `<div class="zeile"><button class="kreis" onclick="B.wuensche.ideeFertig(${w.id}, this)" aria-label="Erledigt"><i class="ti ti-check"></i></button>
            <div class="inhalt"><div class="haupt">${schuetzen(w.text)}</div><div class="neben">${schuetzen(w.anlass || "")}${link(w.link)}</div></div></div>`).join("") || '<div class="meta">Noch keine Ideen</div>'}
        </div>`);
    });
  }
});

B.wuensche = {
  neu(art) {
    formularBlatt(art === "wunsch" ? "Neuer Wunsch" : "Neue Geschenkidee", `
      <input class="f-text" placeholder="${art === "wunsch" ? "Was wünschst du dir?" : "Idee für ein Geschenk"}">
      <input class="f-link" placeholder="Link (optional)" inputmode="url">
      <select class="f-anlass">${ANLAESSE.map(a => `<option>${a}</option>`).join("")}</select>`, {
      absenden: async el => {
        const daten = { text: wert(el, ".f-text"), link: wert(el, ".f-link") || null, anlass: wert(el, ".f-anlass") };
        if (!daten.text) { toast("Bitte etwas eintragen", "fehler"); return false; }
        if (!await tun(db.from(art === "wunsch" ? "wuensche" : "geschenkideen").insert(daten))) return false;
        seiteAktualisieren();
        return true;
      }
    });
  },
  async loeschen(id) {
    if (!await frage("Diesen Wunsch löschen?", { ja: "Löschen", gefahr: true })) return;
    if (await tun(db.from("wuensche").delete().eq("id", id))) seiteAktualisieren();
  },
  async besorgt(id, warVonMir) {
    if (await tun(db.from("wuensche").update({ besorgt_von: warVonMir ? null : ich.id }).eq("id", id))) seiteAktualisieren();
  },
  async ideeFertig(id, kreis) {
    kreis?.classList.add("an");
    if (await tun(db.from("geschenkideen").update({ erledigt: true }).eq("id", id))) setTimeout(seiteAktualisieren, 350);
  }
};

/* =========================================================
   ACTIVITY · Watchlist
   ========================================================= */
const PLATTFORMEN = ["Netflix", "Prime Video", "Disney+", "Apple TV+", "WOW", "Joyn", "RTL+", "YouTube", "Kino"];

registriereSeite("watchlist", {
  render(el) {
    zeigeMitCache("watchlist", async () => {
      const [eintraege, bewertungen] = await Promise.all([
        hol(db.from("watchlist").select("*").order("erstellt_um", { ascending: false })),
        hol(db.from("bewertungen").select("*"))
      ]);
      return { eintraege, bewertungen };
    }, daten => {
      if (!istAktuell("watchlist")) return;
      B.watch._daten = daten || { eintraege: [], bewertungen: [] };
      B.watch.zeichnen(el);
    });
  }
});

B.watch = {
  _daten: { eintraege: [], bewertungen: [] },
  ansicht: "laeuft",

  zeichnen(el) {
    const { eintraege = [], bewertungen = [] } = this._daten;
    const zahl = s => eintraege.filter(e => e.status === s).length;
    const sichtbar = eintraege.filter(e => e.status === this.ansicht);
    const leerText = { laeuft: ["Gerade schaut ihr nichts – fangt was aus „Geplant“ an.", "player-play"], geplant: ["Noch nichts auf der Liste", "list"], gesehen: ["Noch nichts fertig geschaut", "check"] };

    const karte = e => {
      const eigene = bewertungen.filter(b => b.eintrag_id === e.id);
      const sterne = bewertungZeile(bewertungen, e.id);
      let fortschritt = "";
      if (e.art === "serie" && e.status !== "geplant") {
        fortschritt = `<button class="abzeichen" style="border:none;margin-top:8px;font-size:14px;padding:6px 10px" onclick="B.watch.fortschritt(${e.id})">
          Staffel ${e.staffel} · ${e.folge ? "Folge " + e.folge + " gesehen" : "noch keine Folge"} <i class="ti ti-pencil" style="font-size:13px"></i></button>`;
      }
      let knoepfe = "";
      if (e.status === "geplant") knoepfe = `<button class="knopf" onclick="B.watch.status(${e.id}, 'laeuft')"><i class="ti ti-player-play"></i> Anfangen</button>`;
      else if (e.status === "laeuft" && e.art === "serie") knoepfe = `
        <button class="knopf" onclick="B.watch.folge(${e.id})"><i class="ti ti-plus"></i> Folge</button>
        <button class="knopf zweit" onclick="B.watch.staffel(${e.id})"><i class="ti ti-checks"></i> Staffel</button>
        <button class="icon-knopf rund" onclick="B.watch.fertig(${e.id})" aria-label="Serie fertig"><i class="ti ti-flag-check"></i></button>`;
      else if (e.status === "laeuft") knoepfe = `<button class="knopf" onclick="B.watch.fertig(${e.id})"><i class="ti ti-check"></i> Gesehen</button>`;
      else knoepfe = `<button class="knopf zweit" onclick="B.watch.status(${e.id}, 'laeuft')"><i class="ti ti-repeat"></i> Nochmal schauen</button>`;
      if (e.status !== "geplant") knoepfe += `<button class="icon-knopf rund" onclick="B.watch.bewerten(${e.id})" aria-label="Bewerten"><i class="ti ti-star"></i></button>`;
      knoepfe += `<button class="icon-knopf" onclick="B.watch.loeschen(${e.id})" aria-label="Löschen"><i class="ti ti-trash"></i></button>`;

      const liste = eigene.slice().sort((a, b) => new Date(b.erstellt_um) - new Date(a.erstellt_um)).map(b => {
        const wo = b.staffel ? (b.folge ? `S${b.staffel} · F${b.folge}` : `Staffel ${b.staffel}`) : (e.art === "film" ? "Film" : "Gesamt");
        return `<div class="kommentar"><span class="meta">${wo}</span> · <b>${schuetzen(nameVon(b.user_id))}</b> <span class="sterne">${sterneText(b.sterne)}</span>${b.kommentar ? "<br>" + schuetzen(b.kommentar) : ""}</div>`;
      }).join("");

      return `<div class="karte" id="watch-${e.id}">
        <div class="reihe" style="align-items:flex-start">
          <i class="ti ti-${e.art === "film" ? "movie" : "device-tv"}" style="font-size:22px;color:var(--text2);margin-top:2px"></i>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:17px">${schuetzen(e.titel)}</div>
            <div class="meta">${e.plattform ? schuetzen(e.plattform) + " · " : ""}von ${schuetzen(nameVon(e.user_id))}${sterne ? " · " + sterne : ""}</div>
          </div>
        </div>
        ${fortschritt}
        <div class="reihe" style="margin-top:12px">${knoepfe}</div>
        ${liste ? `<details style="margin-top:10px"><summary>Bewertungen (${eigene.length}) <i class="ti ti-chevron-down"></i></summary>${liste}</details>` : ""}
      </div>`;
    };

    setzeHtml(el, `
      ${segmentHtml([["laeuft", `Gerade (${zahl("laeuft")})`], ["geplant", `Geplant (${zahl("geplant")})`], ["gesehen", `Gesehen (${zahl("gesehen")})`]], this.ansicht, "B.watch.wechsel")}
      ${this.ansicht === "geplant" ? `<div class="reihe" style="margin-bottom:14px">${wuerfelKnopf("B.watch.wuerfeln()")}<button class="knopf zweit" onclick="B.watch.neu()"><i class="ti ti-plus"></i> Eintragen</button></div>` : mehrKnopf("B.watch.neu()", "Film oder Serie eintragen")}
      ${sichtbar.map(karte).join("") || leer(...leerText[this.ansicht])}`);
  },

  wechsel(s) { this.ansicht = s; this.zeichnen(document.getElementById("seite-watchlist")); },

  /* ---- Würfeln: Was schauen wir heute? ---- */
  _filter: "alle",
  _letzte: null,
  wuerfeln() {
    const FILTER = [["alle", "Alles"], ["film", "Filme"], ["serie", "Serien"]];
    const geplant = this._daten.eintraege.filter(e => e.status === "geplant");
    if (!geplant.length) return toast("Bei „Geplant“ steht noch nichts.", "fehler");
    const b = blatt(`<h3>Was schauen wir heute?</h3><div class="chips w-quellen"></div><div class="w-inhalt"></div>`);
    let runde = 0;
    const zeigen = async () => {
      const passend = f => geplant.filter(e => f === "alle" || e.art === f);
      b.el.querySelector(".w-quellen").innerHTML = FILTER.map(([k, n]) =>
        `<button class="chip ${k === this._filter ? "aktiv" : ""}" data-q="${k}">${n} (${passend(k).length})</button>`).join("");
      const inhalt = b.el.querySelector(".w-inhalt");
      const liste = passend(this._filter);
      if (!liste.length) {
        inhalt.innerHTML = `<div class="meta" style="text-align:center;padding:24px 0">Bei „Geplant“ ${this._filter === "film" ? "steht gerade kein Film" : "steht gerade keine Serie"}.</div>`;
        return;
      }
      const wahl = wuerfelZiehen(liste, liste.find(e => e.id === this._letzte));
      this._letzte = wahl.id;
      const meine = ++runde;
      inhalt.innerHTML = wuerfelFeld("Heute schauen wir …");
      if (!await wuerfelDrehen(inhalt, liste.map(e => e.titel), wahl.titel, () => meine === runde && b.hg.isConnected)) return;
      inhalt.querySelector(".w-mehr").innerHTML = `
        <div class="meta">${wahl.art === "film" ? "Film" : "Serie"}${wahl.plattform ? " · " + schuetzen(wahl.plattform) : ""} · von ${schuetzen(nameVon(wahl.user_id))}</div>
        ${wuerfelKnoepfe('<i class="ti ti-player-play"></i> Anfangen')}`;
      inhalt.querySelector('[data-a="nochmal"]').onclick = zeigen;
      inhalt.querySelector('[data-a="ok"]').onclick = async () => {
        b.zu();
        await this.status(wahl.id, "laeuft");
        toast("Viel Spaß beim Schauen!");
      };
    };
    b.el.querySelector(".w-quellen").addEventListener("click", e => {
      const k = e.target.closest("[data-q]");
      if (!k || k.dataset.q === this._filter) return;
      this._filter = k.dataset.q;
      this._letzte = null;
      zeigen();
    });
    zeigen();
  },

  finden(id) { return this._daten.eintraege.find(e => e.id === id); },

  neu() {
    formularBlatt("Film oder Serie", `
      <select class="f-art"><option value="serie">Serie</option><option value="film">Film</option></select>
      <input class="f-titel" placeholder="Titel">
      <input class="f-wo" list="wlPlattformen" placeholder="Wo? z. B. Netflix (optional)">
      <datalist id="wlPlattformen">${PLATTFORMEN.map(p => `<option value="${p}">`).join("")}</datalist>`, {
      ok: "Auf die Liste",
      absenden: async el => {
        const titel = wert(el, ".f-titel");
        if (!titel) { toast("Bitte einen Titel eintragen", "fehler"); return false; }
        if (!await tun(db.from("watchlist").insert({ titel, art: wert(el, ".f-art"), plattform: wert(el, ".f-wo") || null }))) return false;
        this.ansicht = "geplant";
        seiteAktualisieren();
        return true;
      }
    });
  },

  async status(id, status) {
    if (await tun(db.from("watchlist").update({ status }).eq("id", id))) { this.ansicht = status; seiteAktualisieren(); }
  },

  async bewertung(e, staffel, folge, untertitel, ueberspringen = "Überspringen") {
    const b = await sterneWahl(e.titel, { untertitel, ueberspringen });
    if (b) await tun(db.from("bewertungen").insert({ eintrag_id: e.id, staffel, folge, ...b }));
  },

  async folge(id) {
    const e = this.finden(id);
    const folge = e.folge + 1;
    if (!await tun(db.from("watchlist").update({ folge }).eq("id", id))) return;
    await this.bewertung(e, e.staffel, folge, `Staffel ${e.staffel} · Folge ${folge}`);
    seiteAktualisieren();
  },

  async staffel(id) {
    const e = this.finden(id);
    await this.bewertung(e, e.staffel, null, `Staffel ${e.staffel} komplett`);
    if (await tun(db.from("watchlist").update({ staffel: e.staffel + 1, folge: 0 }).eq("id", id))) toast(`Weiter mit Staffel ${e.staffel + 1}`);
    seiteAktualisieren();
  },

  async fertig(id) {
    const e = this.finden(id);
    await this.bewertung(e, null, null, e.art === "film" ? "Der Film" : "Die ganze Serie");
    if (await tun(db.from("watchlist").update({ status: "gesehen" }).eq("id", id))) { this.ansicht = "gesehen"; seiteAktualisieren(); }
  },

  async bewerten(id) {
    const e = this.finden(id);
    if (e.art === "film" || e.status === "gesehen") await this.bewertung(e, null, null, e.art === "film" ? "Der Film" : "Die ganze Serie", "Abbrechen");
    else if (e.folge) await this.bewertung(e, e.staffel, e.folge, `Staffel ${e.staffel} · Folge ${e.folge}`, "Abbrechen");
    else return toast("Schaut zuerst eine Folge 😉");
    seiteAktualisieren();
  },

  async fortschritt(id) {
    const e = this.finden(id);
    const antwort = await eingabe("Wo seid ihr gerade?", { wert: `${e.staffel} ${e.folge}`, hinweis: "Staffel und Folge, z. B. 2 5", ok: "Speichern" });
    if (!antwort) return;
    const [staffel, folge] = (antwort.match(/\d+/g) || []).map(Number);
    if (!staffel || folge === undefined) return toast("Bitte zwei Zahlen eingeben, z. B. 2 5", "fehler");
    if (await tun(db.from("watchlist").update({ staffel, folge }).eq("id", id))) seiteAktualisieren();
  },

  async loeschen(id) {
    if (!await frage("Von der Liste löschen?", { ja: "Löschen", gefahr: true, details: "Die Bewertungen gehen dabei auch verloren." })) return;
    if (await tun(db.from("watchlist").delete().eq("id", id))) seiteAktualisieren();
  }
};

/* =========================================================
   ACTIVITY · Orte (Restaurants, Cafés, Bars)
   ========================================================= */
// [Mehrzahl im Satz, Einzahl, Symbol, Name in der Auswahl]
const ORT_ARTEN = {
  restaurant: ["Restaurants", "Restaurant", "tools-kitchen-2", "Restaurants"],
  lunch: ["Lunch-Spots", "Lunch", "salad", "Lunch"],
  snack: ["Snack-Spots", "Snack", "cookie", "Snacks"],
  cafe: ["Cafés", "Café", "coffee", "Cafés"],
  bar: ["Bars", "Bar", "glass-cocktail", "Bars"]
};
const GESCHMACK = { suess: "Süß", herzhaft: "Herzhaft", beides: "Süß & herzhaft" };
const KUECHEN = ["Italienisch", "Pizza", "Japanisch", "Sushi", "Vietnamesisch", "Thailändisch", "Koreanisch", "Chinesisch", "Indisch", "Mexikanisch",
  "Griechisch", "Türkisch", "Libanesisch", "Deutsch", "Bayerisch", "Burger", "Steak", "Vegetarisch", "Vegan", "Frühstück & Brunch", "Kuchen & Torten", "Cocktails", "Wein", "Bier",
  "Mittagstisch", "Bowls", "Salate", "Sandwiches", "Bäckerei", "Eis", "Döner", "Streetfood", "Crêpes & Waffeln", "Donuts"];

registriereSeite("orte", {
  render(el) {
    zeigeMitCache("orte", async () => {
      const [orte, bewertungen, fotos] = await Promise.all([
        hol(db.from("orte").select("*").order("name")),
        hol(db.from("ort_bewertungen").select("*")),
        hol(db.from("ort_fotos").select("*").order("erstellt_um"))
      ]);
      await bildUrlsHolen(fotos.map(f => f.datei_pfad));
      return { orte, bewertungen, fotos };
    }, daten => {
      if (!istAktuell("orte")) return;
      B.orte._daten = daten || { orte: [], bewertungen: [], fotos: [] };
      B.orte.zeichnen(el);
    });
  }
});

B.orte = {
  _daten: { orte: [], bewertungen: [], fotos: [] },
  stadt: speicher.lesen("orteStadt", "Düsseldorf"),
  art: "restaurant",
  extra: [],

  staedte() { return [...new Set(["Düsseldorf", "München", ...this._daten.orte.map(o => o.stadt), ...this.extra])]; },
  karten: o => "https://maps.apple.com/?q=" + encodeURIComponent([o.name, o.adresse, o.stadt].filter(Boolean).join(", ")),
  wertung(o) {
    const w = this._daten.bewertungen.filter(b => b.ort_id === o.id).map(b => b.sterne);
    return w.length ? w.reduce((a, c) => a + c, 0) / w.length : 0;
  },

  zeichnen(el) {
    const { orte, bewertungen, fotos } = this._daten;
    const sichtbar = orte.filter(o => o.stadt === this.stadt && o.art === this.art);
    const geplant = sichtbar.filter(o => !o.besucht);
    const besucht = sichtbar.filter(o => o.besucht).sort((a, b) => this.wertung(b) - this.wertung(a));
    const [plural] = ORT_ARTEN[this.art];

    const karte = o => {
      const bilder = fotos.filter(f => f.ort_id === o.id);
      const eigene = bewertungen.filter(b => b.ort_id === o.id).sort((a, b) => new Date(b.erstellt_um) - new Date(a.erstellt_um));
      const sterne = bewertungZeile(bewertungen, o.id, "ort_id");
      return `<div class="karte" id="ort-${o.id}">
        <div style="font-weight:700;font-size:17px">${schuetzen(o.name)}</div>
        <div class="meta">${o.kueche ? schuetzen(o.kueche) + " · " : ""}${(ORT_ARTEN[o.art] || ORT_ARTEN.restaurant)[1]}${o.art === "snack" && GESCHMACK[o.geschmack] ? " · " + GESCHMACK[o.geschmack] : ""}${sterne ? " · " + sterne : ""}</div>
        <a class="meta" style="display:inline-flex;gap:4px;align-items:center;color:var(--blau-text)" href="${this.karten(o)}" target="_blank" rel="noopener"><i class="ti ti-map-pin"></i>${o.adresse ? schuetzen(o.adresse) : "In Karten öffnen"}</a>
        ${bilder.length ? `<div class="raster" style="margin-top:10px">${bilder.map(f => bildTag(f.datei_pfad)).join("")}</div>` : ""}
        <div class="reihe" style="margin-top:12px">
          <button class="knopf" onclick="B.orte.bewerten(${o.id})"><i class="ti ti-star"></i> Bewerten</button>
          ${o.besucht ? "" : `<button class="knopf zweit" onclick="B.orte.besucht(${o.id})"><i class="ti ti-check"></i> Waren da</button>`}
          <button class="icon-knopf rund" onclick="B.orte.mehr(${o.id})" aria-label="Mehr"><i class="ti ti-dots"></i></button>
        </div>
        ${eigene.length ? `<details style="margin-top:10px"><summary>Bewertungen (${eigene.length}) <i class="ti ti-chevron-down"></i></summary>${eigene.map(b =>
          `<div class="kommentar"><b>${schuetzen(nameVon(b.user_id))}</b> <span class="sterne">${sterneText(b.sterne)}</span> <span class="meta">${datumKurz(b.erstellt_um)}</span>${b.kommentar ? "<br>" + schuetzen(b.kommentar) : ""}</div>`).join("")}</details>` : ""}
      </div>`;
    };

    setzeHtml(el, `
      <div class="chips">${this.staedte().map(s => `<button class="chip ${s === this.stadt ? "aktiv" : ""}" data-stadt="${schuetzen(s)}" onclick="B.orte.stadtWahl(this.dataset.stadt)">${schuetzen(s)}</button>`).join("")}
        <button class="chip" onclick="B.orte.neueStadt()"><i class="ti ti-plus"></i> Stadt</button></div>
      <div class="ort-arten">${Object.entries(ORT_ARTEN).map(([k, [, , icon, name]]) => `
        <button class="${k === this.art ? "aktiv" : ""}" onclick="B.orte.artWahl('${k}')"><i class="ti ti-${icon}"></i><span>${name}</span><small>${orte.filter(o => o.stadt === this.stadt && o.art === k).length}</small></button>`).join("")}</div>
      <div class="reihe" style="margin-bottom:14px">
        ${wuerfelKnopf("B.orte.zufall()")}
        <button class="knopf zweit" onclick="B.orte.neu()"><i class="ti ti-plus"></i> Neuer Ort</button>
      </div>
      ${geplant.length ? `<div class="abschnitt">Wollen wir hin</div>${geplant.map(karte).join("")}` : ""}
      ${besucht.length ? `<div class="abschnitt">Waren wir – beste zuerst</div>${besucht.map(karte).join("")}` : ""}
      ${sichtbar.length ? "" : leer(`Noch keine ${plural} in ${schuetzen(this.stadt)}`, ORT_ARTEN[this.art][2])}`);
  },

  neuZeichnen() { this.zeichnen(document.getElementById("seite-orte")); },
  stadtWahl(s) { this.stadt = s; speicher.schreiben("orteStadt", s); this.neuZeichnen(); },
  artWahl(a) { this.art = a; this.neuZeichnen(); },

  async neueStadt() {
    const s = await eingabe("Neue Stadt", { platzhalter: "z. B. Lissabon", hinweis: "Praktisch für Urlaube: Restaurants, Snacks, Cafés und Bars vorab sammeln.", ok: "Hinzufügen" });
    if (!s) return;
    if (!this.staedte().includes(s)) this.extra.push(s);
    this.stadtWahl(s);
  },

  neu() {
    formularBlatt("Neuer Ort", `
      <input class="f-name" placeholder="Name">
      <select class="f-art">${Object.entries(ORT_ARTEN).map(([k, [, e]]) => `<option value="${k}" ${k === this.art ? "selected" : ""}>${e}</option>`).join("")}</select>
      <input class="f-stadt" list="orteStaedte" placeholder="Stadt" value="${schuetzen(this.stadt)}">
      <datalist id="orteStaedte">${this.staedte().map(s => `<option value="${schuetzen(s)}">`).join("")}</datalist>
      <select class="f-geschmack" style="display:${this.art === "snack" ? "block" : "none"}">${Object.entries(GESCHMACK).map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select>
      <input class="f-kueche" list="orteKuechen" placeholder="Küche, z. B. Italienisch (optional)">
      <datalist id="orteKuechen">${KUECHEN.map(k => `<option value="${k}">`).join("")}</datalist>
      <input class="f-adresse" placeholder="Adresse (optional)">
      <select class="f-besucht"><option value="nein">Wollen wir hin</option><option value="ja">Waren wir schon</option></select>`, {
      beiStart: el => {
        el.querySelector(".f-art").addEventListener("change", e => { el.querySelector(".f-geschmack").style.display = e.target.value === "snack" ? "block" : "none"; });
      },
      absenden: async el => {
        const name = wert(el, ".f-name"), stadt = wert(el, ".f-stadt"), art = wert(el, ".f-art");
        if (!name || !stadt) { toast("Bitte Name und Stadt eintragen", "fehler"); return false; }
        const zeile = { name, stadt, art, kueche: wert(el, ".f-kueche") || null, adresse: wert(el, ".f-adresse") || null, besucht: wert(el, ".f-besucht") === "ja" };
        if (art === "snack") zeile.geschmack = wert(el, ".f-geschmack");
        const ok = await tun(db.from("orte").insert(zeile));
        if (!ok) return false;
        this.stadt = stadt; this.art = art; speicher.schreiben("orteStadt", stadt);
        seiteAktualisieren();
        return true;
      }
    });
  },

  finden(id) { return this._daten.orte.find(o => o.id === id); },

  async bewerten(id) {
    const o = this.finden(id);
    const b = await sterneWahl(o.name, { untertitel: "Wie war's?", platzhalter: "Was habt ihr gegessen? (optional)" });
    if (!b) return;
    if (await tun(db.from("ort_bewertungen").insert({ ort_id: id, ...b }))) {
      if (!o.besucht) await tun(db.from("orte").update({ besucht: true }).eq("id", id));
      seiteAktualisieren();
    }
  },

  async besucht(id) { if (await tun(db.from("orte").update({ besucht: true }).eq("id", id))) seiteAktualisieren(); },

  async fotos(id) {
    const dateien = await dateiWaehlen({ multiple: true });
    if (!dateien.length) return;
    toast("Lädt hoch …");
    for (const d of dateien) {
      try { const pfad = await bildHochladen(d, "ort-"); await tun(db.from("ort_fotos").insert({ ort_id: id, datei_pfad: pfad })); }
      catch (e) { fehler(e); }
    }
    seiteAktualisieren();
  },

  mehr(id) {
    const o = this.finden(id);
    if (!o) return;
    const zeile = (a, icon, text, rot = false) => `<div class="zeile" data-a="${a}"><i class="ti ti-${icon}" style="font-size:22px;color:${rot ? "var(--rot)" : "var(--blau-text)"}"></i><div class="inhalt"><div class="haupt" style="${rot ? "color:var(--rot)" : ""}">${text}</div></div></div>`;
    const b = blatt(`
      <h3>${schuetzen(o.name)}</h3>
      <div class="auswahl-liste">
        ${zeile("fotos", "camera-plus", "Fotos hinzufügen")}
        ${zeile("art", "category", "Kategorie ändern")}
        ${zeile("loeschen", "trash", "Löschen", true)}
      </div>`);
    b.el.addEventListener("click", e => {
      const k = e.target.closest("[data-a]");
      if (!k) return;
      b.zu();
      if (k.dataset.a === "fotos") this.fotos(id);
      else if (k.dataset.a === "art") this.artAendern(id);
      else this.loeschen(id);
    });
  },

  artAendern(id) {
    const o = this.finden(id);
    formularBlatt("Kategorie ändern", `
      <select class="f-art">${Object.entries(ORT_ARTEN).map(([k, [, e]]) => `<option value="${k}" ${k === o.art ? "selected" : ""}>${e}</option>`).join("")}</select>
      <select class="f-geschmack" style="display:${o.art === "snack" ? "block" : "none"}">${Object.entries(GESCHMACK).map(([k, n]) => `<option value="${k}" ${k === o.geschmack ? "selected" : ""}>${n}</option>`).join("")}</select>`, {
      ok: "Speichern",
      beiStart: el => {
        el.querySelector(".f-art").addEventListener("change", e => { el.querySelector(".f-geschmack").style.display = e.target.value === "snack" ? "block" : "none"; });
      },
      absenden: async el => {
        const art = wert(el, ".f-art");
        const neu = { art };
        if (art === "snack") neu.geschmack = wert(el, ".f-geschmack");
        if (!await tun(db.from("orte").update(neu).eq("id", id))) return false;
        this.art = art;
        seiteAktualisieren();
        return true;
      }
    });
  },

  async loeschen(id) {
    if (!await frage("Diesen Ort löschen?", { ja: "Löschen", gefahr: true, details: "Bewertungen und Fotos gehen dabei auch verloren." })) return;
    if (await tun(db.from("orte").delete().eq("id", id))) seiteAktualisieren();
  },

  zufall() {
    const alle = this._daten.orte.filter(o => o.stadt === this.stadt && o.art === this.art);
    if (!alle.length) return toast(`Noch keine ${ORT_ARTEN[this.art][0]} in ${this.stadt} eingetragen.`, "fehler");
    const gewicht = o => !o.besucht ? 3 : Math.max(1, this.wertung(o) || 2);
    const snack = this.art === "snack";
    const FILTER = [["alle", "Egal"], ["suess", "Süß"], ["herzhaft", "Herzhaft"]];
    const passend = f => alle.filter(o => f === "alle" || o.geschmack === f || o.geschmack === "beides");
    let filter = "alle";
    const b = blatt(`<h3>${snack ? "Worauf habt ihr Lust?" : "Wohin gehen wir?"}</h3>${snack ? '<div class="chips w-quellen"></div>' : ""}<div class="w-inhalt"></div>`);
    let runde = 0, letzte = null;
    if (snack) b.el.querySelector(".w-quellen").addEventListener("click", e => {
      const k = e.target.closest("[data-q]");
      if (!k || k.dataset.q === filter) return;
      filter = k.dataset.q;
      letzte = null;
      zeigen();
    });
    const zeigen = async () => {
      if (snack) b.el.querySelector(".w-quellen").innerHTML = FILTER.map(([k, n]) =>
        `<button class="chip ${k === filter ? "aktiv" : ""}" data-q="${k}">${n} (${passend(k).length})</button>`).join("");
      const kandidaten = passend(filter);
      if (!kandidaten.length) {
        runde++;
        b.el.querySelector(".w-inhalt").innerHTML = `<div class="meta" style="text-align:center;padding:24px 0">Noch keine ${filter === "suess" ? "süßen" : "herzhaften"} Snacks in ${schuetzen(this.stadt)}.</div>`;
        return;
      }
      const t = wuerfelZiehen(kandidaten, letzte, gewicht);
      letzte = t;
      const meine = ++runde;
      const inhalt = b.el.querySelector(".w-inhalt");
      inhalt.innerHTML = wuerfelFeld(snack ? "Heute holen wir uns was bei …" : this.art === "lunch" ? "Heute gehen wir lunchen im …" : "Heute geht's ins …");
      if (!await wuerfelDrehen(inhalt, kandidaten.map(o => o.name), t.name, () => meine === runde && b.hg.isConnected)) return;
      inhalt.querySelector(".w-mehr").innerHTML = `
        <div class="meta">${t.kueche ? schuetzen(t.kueche) + " · " : ""}${snack && GESCHMACK[t.geschmack] ? GESCHMACK[t.geschmack] + " · " : ""}${t.besucht ? "Waren wir schon" : "Neu für euch"}</div>
        <a class="knopf zweit" style="margin-top:12px" href="${this.karten(t)}" target="_blank" rel="noopener"><i class="ti ti-route"></i> Route anzeigen</a>
        ${wuerfelKnoepfe('<i class="ti ti-check"></i> Passt!')}`;
      inhalt.querySelector('[data-a="nochmal"]').onclick = zeigen;
      inhalt.querySelector('[data-a="ok"]').onclick = () => {
        b.zu();
        document.getElementById("ort-" + t.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      };
    };
    zeigen();
  }
};

/* =========================================================
   ACTIVITY · Kochbuch
   ========================================================= */
registriereSeite("kochbuch", {
  render(el) {
    zeigeMitCache("kochbuch", async () => {
      const [rezepte, einkauf] = await Promise.all([
        hol(db.from("rezepte").select("*").order("erstellt_um", { ascending: false })),
        db.from("einkauf").select("*").order("erstellt_um").then(r => r.error ? [] : r.data || [])
      ]);
      await bildUrlsHolen(rezepte.map(r => r.bild_pfad));
      return { rezepte, einkauf };
    }, daten => {
      if (!istAktuell("kochbuch")) return;
      if (Array.isArray(daten)) daten = { rezepte: daten, einkauf: [] }; // alter Zwischenspeicher
      B.koch._daten = daten?.rezepte || [];
      B.koch._einkauf = daten?.einkauf || [];
      B.koch.zeichnen(el);
    });
  }
});


// Liest die Zutaten aus einem Rezepttext: alles vor der Zubereitung, eine Zutat pro Zeile oder mit Komma getrennt.
function zutatenAus(text) {
  if (!text) return [];
  const zeilen = text.split(/\r?\n/).map(z => z.trim());
  const ergebnis = [];
  for (let zeile of zeilen) {
    if (/^(\d+[.)]\s|schritt\b|zubereitung|anleitung|so geht|und so)/i.test(zeile)) break;
    zeile = zeile.replace(/^(zutaten|für\s+\d+(\s*(personen|portionen|pers\.))?)\s*:?\s*/i, "").replace(/^[-–•*·]\s*/, "");
    for (let teil of zeile.split(/,(?!\d)|;/)) {
      teil = teil.trim().replace(/^[-–•*·]\s*/, "").replace(/[.]$/, "");
      if (teil && /\p{L}/u.test(teil) && teil.length <= 80 && !ergebnis.includes(teil)) ergebnis.push(teil);
    }
  }
  return ergebnis.slice(0, 40);
}

const KOCH_IDEEN = [
  { titel: "Spaghetti Carbonara", rezept: "Für 2: 250 g Spaghetti, 100 g Guanciale oder Speck, 2 Eier + 1 Eigelb, 50 g Pecorino oder Parmesan, Pfeffer\n\n1. Spaghetti in Salzwasser kochen, eine Tasse Nudelwasser aufheben.\n2. Speck in der Pfanne knusprig braten.\n3. Eier mit geriebenem Käse und viel Pfeffer verquirlen.\n4. Herd aus, Nudeln zum Speck geben, Eiermasse und etwas Nudelwasser unterrühren, bis es cremig ist." },
  { titel: "Rotes Linsen-Curry", rezept: "Für 2: 150 g rote Linsen, 1 Dose Kokosmilch, 1 Dose gehackte Tomaten, 1 Zwiebel, 2 Knoblauchzehen, 1 Stück Ingwer, 2 TL Currypulver, Spinat, Reis\n\n1. Zwiebel, Knoblauch und Ingwer in Öl anbraten, Curry kurz mitrösten.\n2. Linsen, Tomaten und Kokosmilch dazu, 15 Minuten köcheln.\n3. Spinat unterheben, mit Salz und Limette abschmecken. Dazu Reis." },
  { titel: "Ofengemüse mit Feta", rezept: "Für 2: 1 Süßkartoffel, 1 Paprika, 1 Zucchini, 1 rote Zwiebel, 1 Dose Kichererbsen, 200 g Feta, Olivenöl, Paprikapulver, Thymian\n\n1. Ofen auf 200 °C Umluft vorheizen.\n2. Gemüse würfeln, mit Kichererbsen, Öl und Gewürzen aufs Blech.\n3. Feta in die Mitte legen, 30 Minuten backen. Mit Joghurt-Dip servieren." },
  { titel: "Käsespätzle", rezept: "Für 2: 400 g Spätzle (frisch oder aus dem Kühlregal), 150 g Bergkäse, 2 Zwiebeln, Butter, Schnittlauch\n\n1. Zwiebeln in Ringe schneiden und in Butter goldbraun rösten.\n2. Spätzle in einer Pfanne mit Butter erhitzen.\n3. Käse lagenweise unterheben, bis er schmilzt.\n4. Mit Röstzwiebeln und Schnittlauch servieren." },
  { titel: "Shakshuka", rezept: "Für 2: 4 Eier, 1 Dose gehackte Tomaten, 1 Paprika, 1 Zwiebel, 2 Knoblauchzehen, Kreuzkümmel, Paprikapulver, Feta, Brot\n\n1. Zwiebel, Paprika und Knoblauch anbraten, Gewürze dazu.\n2. Tomaten dazu, 10 Minuten einköcheln.\n3. Mulden machen, Eier hineinschlagen, mit Deckel ca. 6 Minuten stocken lassen.\n4. Mit Feta und Brot direkt aus der Pfanne essen." },
  { titel: "Gebratener Reis mit Ei", rezept: "Für 2: 2 Tassen gekochter Reis (am besten vom Vortag), 2 Eier, 1 Karotte, 1 Handvoll Erbsen, 2 Frühlingszwiebeln, Sojasauce, Sesamöl\n\n1. Gemüse klein schneiden und im Wok scharf anbraten.\n2. Reis dazu und mitbraten, bis er leicht knusprig ist.\n3. Reis zur Seite schieben, Eier in der Lücke verrühren und unterheben.\n4. Mit Sojasauce, Sesamöl und Frühlingszwiebeln abschmecken." },
  { titel: "Kürbissuppe", rezept: "Für 2: 1 kleiner Hokkaido, 1 Zwiebel, 1 Stück Ingwer, 500 ml Gemüsebrühe, 200 ml Kokosmilch, Kürbiskerne\n\n1. Kürbis mit Schale würfeln, Zwiebel und Ingwer anschwitzen.\n2. Kürbis dazu, mit Brühe aufgießen, 20 Minuten kochen.\n3. Kokosmilch dazu und fein pürieren.\n4. Mit Salz, Pfeffer und gerösteten Kürbiskernen servieren." },
  { titel: "Hähnchen-Wraps", rezept: "Für 2: 300 g Hähnchenbrust, 4 Wraps, 1 Avocado, Salat, Tomaten, Mais, Joghurt oder Sour Cream, Paprikapulver, Limette\n\n1. Hähnchen in Streifen schneiden, mit Paprika und Salz würzen und anbraten.\n2. Avocado mit Limette und Salz zerdrücken.\n3. Wraps kurz in der Pfanne erwärmen.\n4. Alles einfüllen, einrollen und genießen." },
  { titel: "Kaiserschmarrn", rezept: "Für 2: 4 Eier, 125 g Mehl, 250 ml Milch, 1 Prise Salz, 2 EL Zucker, Rosinen (optional), Butter, Puderzucker, Apfelmus\n\n1. Eier trennen, Eiweiß mit Salz steif schlagen.\n2. Eigelb, Mehl, Milch und Zucker glatt rühren, Eischnee unterheben.\n3. Teig in reichlich Butter backen, wenden, mit zwei Gabeln zerreißen.\n4. Etwas Zucker darüber karamellisieren, mit Puderzucker und Apfelmus servieren." }
];

B.koch = {
  _daten: [],
  ansicht: "offen",
  _einkauf: [],
  zeichnen(el) {
    const segment = segmentHtml([
      ["offen", `Rezepte (${this._daten.filter(r => !r.gekocht).length})`],
      ["gekocht", `Gekocht (${this._daten.filter(r => r.gekocht).length})`],
      ["einkauf", `Einkauf (${this._einkauf.filter(e => !e.erledigt).length})`]], this.ansicht, "B.koch.wechsel");
    if (this.ansicht === "einkauf") return this.zeichneEinkauf(el, segment);
    const gekocht = this.ansicht === "gekocht";
    const liste = this._daten.filter(r => !!r.gekocht === gekocht);
    setzeHtml(el, `
      ${segment}
      <div class="reihe" style="margin-bottom:14px">
        ${wuerfelKnopf("B.koch.wuerfeln()")}
        <button class="knopf zweit" onclick="B.koch.neu()"><i class="ti ti-plus"></i> Neues Gericht</button>
      </div>
      ${liste.map(r => `<div class="karte" id="rezept-${r.id}" style="padding:0;overflow:hidden">
        ${r.bild_pfad ? bildTag(r.bild_pfad, 'style="width:100%;aspect-ratio:4/3;object-fit:cover;display:block"') : ""}
        <div style="padding:14px 16px 16px">
          <div style="font-weight:700;font-size:18px">${schuetzen(r.titel)}</div>
          <div class="meta">von ${schuetzen(nameVon(r.user_id))} · ${datumKurz(r.erstellt_um)}</div>
          ${r.rezept ? `<details style="margin-top:6px"><summary>Rezept anzeigen <i class="ti ti-chevron-down"></i></summary><div class="kommentar" style="white-space:pre-wrap;margin-top:8px">${schuetzen(r.rezept)}</div></details>` : ""}
          ${r.link && /^https?:\/\//i.test(r.link) ? `<a class="meta" style="display:inline-flex;gap:4px;align-items:center;color:var(--blau-text)" href="${schuetzen(r.link)}" target="_blank" rel="noopener"><i class="ti ti-external-link"></i> Zum Rezept</a>` : ""}
          <div class="reihe" style="margin-top:12px">
            <button class="knopf" onclick="B.koch.heuteKochen(${r.id})"><i class="ti ti-shopping-cart"></i> Heute kochen</button>
            ${r.gekocht ? "" : `<button class="knopf zweit" onclick="B.koch.umschalten(${r.id}, false)"><i class="ti ti-chef-hat"></i> Gekocht!</button>`}
            <button class="icon-knopf rund" onclick="B.koch.mehr(${r.id})" aria-label="Mehr"><i class="ti ti-dots"></i></button>
          </div>
        </div>
      </div>`).join("") || leer(gekocht ? "Noch nichts gekocht" : "Noch keine Gerichte eingetragen", "chef-hat")}`);
  },
  wechsel(a) { this.ansicht = a; this.zeichnen(document.getElementById("seite-kochbuch")); },

  neu() {
    let bild = null;
    formularBlatt("Neues Gericht", `
      <input class="f-titel" placeholder="Was wollen wir kochen?">
      <textarea class="f-rezept" rows="6" placeholder="Zutaten und Zubereitung …"></textarea>
      <input class="f-link" placeholder="Link zum Rezept (optional)" inputmode="url">
      <button class="knopf zweit f-bild" style="margin-bottom:10px" type="button"><i class="ti ti-photo-plus"></i> Bild hinzufügen (optional)</button>`, {
      beiStart: el => {
        const k = el.querySelector(".f-bild");
        k.onclick = async () => {
          const [d] = await dateiWaehlen();
          if (d) { bild = d; k.innerHTML = '<i class="ti ti-check"></i> Bild ausgewählt'; }
        };
      },
      absenden: async el => {
        const titel = wert(el, ".f-titel");
        if (!titel) { toast("Bitte gib dem Gericht einen Namen", "fehler"); return false; }
        try {
          const bild_pfad = bild ? await bildHochladen(bild, "rezept-") : null;
          if (!await tun(db.from("rezepte").insert({ titel, rezept: wert(el, ".f-rezept") || null, link: wert(el, ".f-link") || null, bild_pfad }))) return false;
          this.ansicht = "offen";
          seiteAktualisieren();
          return true;
        } catch (e) { fehler(e); return false; }
      }
    });
  },

  /* ---- Würfeln: Was kochen wir heute? ---- */
  _quelle: null,
  _letzte: null,
  quellen() {
    const eigene = this._daten;
    const name = t => (t || "").trim().toLowerCase();
    return {
      liste: { name: "Rezepte", eintraege: eigene.filter(r => !r.gekocht) },
      gekocht: { name: "Gekocht", eintraege: eigene.filter(r => r.gekocht) },
      ideen: { name: "Ideen", eintraege: KOCH_IDEEN.filter(i => !eigene.some(r => name(r.titel) === name(i.titel))) }
    };
  },

  wuerfeln() {
    const q = this.quellen();
    if (!this._quelle || !q[this._quelle].eintraege.length)
      this._quelle = ["liste", "gekocht", "ideen"].find(k => q[k].eintraege.length) || "ideen";
    const b = blatt(`<h3>Was kochen wir heute?</h3><div class="chips w-quellen"></div><div class="w-inhalt"></div>`);
    let runde = 0;

    const zeigen = async () => {
      const quellen = this.quellen();
      b.el.querySelector(".w-quellen").innerHTML = Object.entries(quellen).map(([k, v]) =>
        `<button class="chip ${k === this._quelle ? "aktiv" : ""}" data-q="${k}">${v.name} (${v.eintraege.length})</button>`).join("");
      const inhalt = b.el.querySelector(".w-inhalt");
      const liste = quellen[this._quelle].eintraege;
      if (!liste.length) {
        inhalt.innerHTML = `<div class="meta" style="text-align:center;padding:24px 0">${this._quelle === "gekocht" ? "Ihr habt noch nichts als gekocht markiert." : this._quelle === "liste" ? "Bei Rezepte steht gerade nichts." : "Alle Ideen stehen schon in eurem Kochbuch."}</div>`;
        return;
      }
      const wahl = wuerfelZiehen(liste, liste.find(r => r.titel === this._letzte));
      this._letzte = wahl.titel;
      const meine = ++runde;
      inhalt.innerHTML = wuerfelFeld("Heute kochen wir …");
      if (!await wuerfelDrehen(inhalt, liste.map(r => r.titel), wahl.titel, () => meine === runde && b.hg.isConnected)) return;

      const neu = this._quelle === "ideen";
      const link = wahl.link && /^https?:\/\//i.test(wahl.link) ? wahl.link : null;
      inhalt.querySelector(".w-mehr").innerHTML = `
        <div class="meta">${neu ? "Neue Idee für euch" : this._quelle === "gekocht" ? "Habt ihr schon mal gekocht" : "Aus euren Rezepten"}</div>
        ${wahl.rezept ? `<details style="margin-top:8px;text-align:left"><summary>Rezept anzeigen <i class="ti ti-chevron-down"></i></summary><div class="kommentar" style="white-space:pre-wrap;margin-top:8px">${schuetzen(wahl.rezept)}</div></details>` : ""}
        ${link ? `<a class="knopf zweit" style="margin-top:10px" href="${schuetzen(link)}" target="_blank" rel="noopener"><i class="ti ti-external-link"></i> Zum Rezept</a>` : ""}
        ${wuerfelKnoepfe('<i class="ti ti-chef-hat"></i> Machen wir!')}`;
      inhalt.querySelector('[data-a="ok"]').onclick = async () => {
        if (neu && !await tun(db.from("rezepte").insert({ titel: wahl.titel, rezept: wahl.rezept }))) return;
        b.zu();
        if (neu) { this.ansicht = "offen"; seiteAktualisieren(); }
        this.einkaufBlatt(wahl.titel, wahl.rezept);
      };
      inhalt.querySelector('[data-a="nochmal"]').onclick = zeigen;
    };

    b.el.querySelector(".w-quellen").addEventListener("click", e => {
      const k = e.target.closest("[data-q]");
      if (!k || k.dataset.q === this._quelle) return;
      this._quelle = k.dataset.q;
      this._letzte = null;
      zeigen();
    });
    zeigen();
  },

  /* ---- Heute kochen → Einkaufsliste ---- */
  heuteKochen(id) {
    const r = this._daten.find(x => x.id === id);
    if (r) this.einkaufBlatt(r.titel, r.rezept);
  },

  einkaufBlatt(titel, rezept) {
    const zutaten = zutatenAus(rezept);
    const b = blatt(`
      <h3>${schuetzen(titel)}</h3>
      <div class="meta">${zutaten.length ? "Tippe weg, was ihr schon zu Hause habt." : "Bei diesem Rezept stehen keine Zutaten – trag sie einfach hier ein."}</div>
      <div class="ek-liste" style="margin:10px 0"></div>
      <div class="reihe" style="margin-bottom:14px">
        <input class="ek-neu" placeholder="Weitere Zutat …" enterkeyhint="done" style="margin:0;flex:1">
        <button class="icon-knopf rund ek-plus" aria-label="Hinzufügen"><i class="ti ti-plus"></i></button>
      </div>
      <div class="reihe">
        <button class="knopf zweit" data-a="nein">Ohne Einkaufen</button>
        <button class="knopf ek-ok"></button>
      </div>`);
    const liste = zutaten.map(text => ({ text, an: true }));
    const zeigen = () => {
      b.el.querySelector(".ek-liste").innerHTML = liste.map((z, i) => `
        <div class="zeile"><button class="kreis ${z.an ? "an" : ""}" data-i="${i}" aria-label="Kaufen"><i class="ti ti-check"></i></button>
          <div class="inhalt"><div class="haupt" style="${z.an ? "" : "text-decoration:line-through;color:var(--text3)"}">${schuetzen(z.text)}</div></div></div>`).join("");
      const n = liste.filter(z => z.an).length;
      const ok = b.el.querySelector(".ek-ok");
      ok.innerHTML = `<i class="ti ti-shopping-cart"></i> ${n ? `Auf die Liste (${n})` : "Nichts zu kaufen"}`;
    };
    const dazu = () => {
      const feld = b.el.querySelector(".ek-neu");
      const text = feld.value.trim();
      if (!text) return;
      liste.push({ text, an: true });
      feld.value = "";
      zeigen();
      feld.focus();
    };
    b.el.querySelector(".ek-plus").onclick = dazu;
    b.el.querySelector(".ek-neu").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); dazu(); } });
    b.el.querySelector(".ek-liste").addEventListener("click", e => {
      const k = e.target.closest("[data-i]");
      if (!k) return;
      liste[k.dataset.i].an = !liste[k.dataset.i].an;
      zeigen();
    });
    b.el.querySelector('[data-a="nein"]').onclick = () => { b.zu(); toast("Guten Appetit!"); };
    b.el.querySelector(".ek-ok").onclick = async () => {
      const kaufen = liste.filter(z => z.an);
      if (!kaufen.length) { b.zu(); toast("Guten Appetit!"); return; }
      if (!await tun(db.from("einkauf").insert(kaufen.map(z => ({ text: z.text, rezept: titel }))))) return;
      b.zu();
      toast(`${kaufen.length} ${kaufen.length === 1 ? "Zutat steht" : "Zutaten stehen"} auf der Einkaufsliste ✓`);
      this.ansicht = "einkauf";
      if (istAktuell("kochbuch")) seiteAktualisieren();
    };
    zeigen();
  },

  zeichneEinkauf(el, segment) {
    const gruppen = [];
    for (const e of this._einkauf) {
      const name = e.rezept || "Sonstiges";
      let g = gruppen.find(x => x.name === name);
      if (!g) gruppen.push(g = { name, eintraege: [] });
      g.eintraege.push(e);
    }
    const abgehakt = this._einkauf.filter(e => e.erledigt).length;
    const zeile = e => `
      <div class="zeile"><button class="kreis ${e.erledigt ? "an" : ""}" onclick="B.koch.abhaken(${e.id})" aria-label="Abhaken"><i class="ti ti-check"></i></button>
        <div class="inhalt"><div class="haupt" style="${e.erledigt ? "text-decoration:line-through;color:var(--text3)" : ""}">${schuetzen(e.text)}</div></div></div>`;
    setzeHtml(el, `
      ${segment}
      <div class="reihe" style="margin-bottom:14px">
        <input id="ekNeu" placeholder="Etwas auf die Liste …" enterkeyhint="done" style="margin:0;flex:1" onkeydown="if (event.key === 'Enter') { event.preventDefault(); B.koch.einkaufDazu(); }">
        <button class="icon-knopf rund" onclick="B.koch.einkaufDazu()" aria-label="Hinzufügen"><i class="ti ti-plus"></i></button>
      </div>
      ${gruppen.map(g => {
        const sortiert = g.eintraege.filter(e => !e.erledigt).concat(g.eintraege.filter(e => e.erledigt));
        return `<div class="karte"><div class="karte-titel">${schuetzen(g.name)}</div>${sortiert.map(zeile).join("")}</div>`;
      }).join("") || leer("Die Einkaufsliste ist leer – tippe bei einem Rezept auf „Heute kochen“.", "shopping-cart")}
      ${abgehakt ? `<button class="knopf zweit" style="width:100%" onclick="B.koch.aufraeumen()"><i class="ti ti-trash"></i> Abgehakte entfernen (${abgehakt})</button>` : ""}`);
  },

  async abhaken(id) {
    const e = this._einkauf.find(x => x.id === id);
    if (!e) return;
    e.erledigt = !e.erledigt;
    this.zeichnen(document.getElementById("seite-kochbuch"));
    if (!await tun(db.from("einkauf").update({ erledigt: e.erledigt }).eq("id", id))) {
      e.erledigt = !e.erledigt;
      this.zeichnen(document.getElementById("seite-kochbuch"));
    }
  },

  async einkaufDazu() {
    const feld = document.getElementById("ekNeu");
    const text = feld?.value.trim();
    if (!text) return;
    if (await tun(db.from("einkauf").insert({ text, rezept: null }))) { feld.value = ""; seiteAktualisieren(); }
  },

  async aufraeumen() {
    if (await tun(db.from("einkauf").delete().eq("erledigt", true))) seiteAktualisieren();
  },

  mehr(id) {
    const r = this._daten.find(x => x.id === id);
    if (!r) return;
    const zeile = (a, icon, text, farbe = "var(--blau-text)") => `<div class="zeile" data-a="${a}"><i class="ti ti-${icon}" style="font-size:22px;color:${farbe}"></i><div class="inhalt"><div class="haupt" style="${a === "loeschen" ? "color:var(--rot)" : ""}">${text}</div></div></div>`;
    const b = blatt(`
      <h3>${schuetzen(r.titel)}</h3>
      <div class="auswahl-liste">
        ${zeile("bild", "camera-plus", r.bild_pfad ? "Bild ändern" : "Bild hinzufügen")}
        ${r.gekocht ? zeile("zurueck", "arrow-back-up", "Zurück zu Rezepte") : ""}
        ${zeile("loeschen", "trash", "Löschen", "var(--rot)")}
      </div>`);
    b.el.addEventListener("click", e => {
      const k = e.target.closest("[data-a]");
      if (!k) return;
      b.zu();
      if (k.dataset.a === "bild") this.bild(id);
      else if (k.dataset.a === "zurueck") this.umschalten(id, true);
      else this.loeschen(id);
    });
  },

  async umschalten(id, war) { if (await tun(db.from("rezepte").update({ gekocht: !war }).eq("id", id))) { toast(war ? "Wieder bei Rezepte" : "Lecker! ✓"); seiteAktualisieren(); } },

  async bild(id) {
    const [d] = await dateiWaehlen();
    if (!d) return;
    try { const bild_pfad = await bildHochladen(d, "rezept-"); if (await tun(db.from("rezepte").update({ bild_pfad }).eq("id", id))) seiteAktualisieren(); }
    catch (e) { fehler(e); }
  },

  async loeschen(id) {
    if (!await frage("Dieses Gericht löschen?", { ja: "Löschen", gefahr: true })) return;
    if (await tun(db.from("rezepte").delete().eq("id", id))) seiteAktualisieren();
  }
};

/* =========================================================
   RECAP · Essen (Food Diary)
   ========================================================= */
registriereSeite("essen", {
  render(el) {
    zeigeMitCache("essen", async () => {
      const liste = await hol(db.from("essen").select("*").gte("erstellt_um", new Date(Date.now() - 7 * 864e5).toISOString()).order("erstellt_um", { ascending: false }));
      await bildUrlsHolen(liste.map(x => x.datei_pfad));
      return liste;
    }, daten => {
      if (!istAktuell("essen")) return;
      const nachTag = {};
      (daten || []).forEach(x => { const t = new Date(x.erstellt_um).toLocaleDateString("sv-SE"); (nachTag[t] = nachTag[t] || []).push(x); });
      const heute = new Date().toLocaleDateString("sv-SE");
      const gestern = new Date(Date.now() - 864e5).toLocaleDateString("sv-SE");
      const tagName = t => t === heute ? "Heute" : t === gestern ? "Gestern" : new Date(t + "T12:00").toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "short" });
      setzeHtml(el, `
        <div class="karte">
          <div class="karte-titel">Was gab's heute?</div>
          <div class="eingabe-pille">
            <input id="essenNotiz" placeholder="Was gibt's? (optional)">
            <button class="icon-knopf blau" onclick="B.essen.foto()" aria-label="Foto aufnehmen"><i class="ti ti-camera"></i></button>
          </div>
        </div>
        ${Object.entries(nachTag).map(([t, eintraege]) => `
          <div class="abschnitt">${tagName(t)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">${eintraege.map(x => `
            <div class="karte" style="padding:0;overflow:hidden;margin:0">
              ${bildTag(x.datei_pfad, 'style="width:100%;aspect-ratio:1;object-fit:cover;display:block"')}
              <div style="padding:8px 10px"><div style="font-size:13px;font-weight:600">${schuetzen(nameVon(x.user_id))} <span class="meta">${new Date(x.erstellt_um).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span></div>
              ${x.notiz ? `<div class="meta" style="margin:2px 0 0">${schuetzen(x.notiz)}</div>` : ""}</div>
            </div>`).join("")}</div>`).join("") || leer("Noch kein Essen diese Woche", "tools-kitchen-2")}`);
    });
  }
});

B.essen = {
  async foto() {
    const [d] = await dateiWaehlen({ capture: "environment" });
    if (!d) return;
    toast("Lädt hoch …");
    try {
      const pfad = await bildHochladen(d, "essen-");
      const feld = document.getElementById("essenNotiz");
      if (await tun(db.from("essen").insert({ datei_pfad: pfad, notiz: feld?.value.trim() || null }))) { if (feld) feld.value = ""; toast("Gepostet ✓"); seiteAktualisieren(); }
    } catch (e) { fehler(e); }
  }
};

/* =========================================================
   RECAP · Gefühls-Check-in
   ========================================================= */
const GEFUEHLE = ["😢", "😕", "😐", "🙂", "🥰"];

registriereSeite("gefuehl", {
  render(el) {
    zeigeMitCache("gefuehl", () => hol(db.from("checkins").select("*").order("erstellt_um", { ascending: false }).limit(20)), daten => {
      if (!istAktuell("gefuehl")) return;
      setzeHtml(el, `
        <div class="karte">
          <div class="karte-titel">Wie fühlst du dich gerade mit uns?</div>
          <div style="display:flex;justify-content:space-between;margin:6px 0 12px" id="gefuehlWahl">
            ${GEFUEHLE.map((g, i) => `<button class="chip ${B.gefuehl.wahl === i + 1 ? "aktiv" : ""}" style="font-size:28px;padding:6px 10px" onclick="B.gefuehl.waehlen(${i + 1})">${g}</button>`).join("")}
          </div>
          <textarea id="gefuehlText" rows="2" placeholder="Was würde dir gerade guttun? (optional)"></textarea>
          <button class="knopf" onclick="B.gefuehl.teilen()">Teilen</button>
        </div>
        <div class="abschnitt">Verlauf</div>
        <div class="karte">${(daten || []).map(c => `
          <div class="zeile">
            <span style="font-size:28px">${GEFUEHLE[c.wert - 1]}</span>
            <div class="inhalt"><div class="haupt"><b>${schuetzen(nameVon(c.user_id))}</b> <span class="meta">${wieLange(c.erstellt_um)}</span></div>
            ${c.text ? `<div class="neben" style="color:var(--text)">${schuetzen(c.text)}</div>` : ""}</div>
          </div>`).join("") || '<div class="meta">Noch kein Check-in</div>'}</div>`);
    });
  }
});

B.gefuehl = {
  wahl: null,
  waehlen(w) {
    this.wahl = w;
    document.querySelectorAll("#gefuehlWahl .chip").forEach((k, i) => k.classList.toggle("aktiv", i + 1 === w));
  },
  async teilen() {
    if (!this.wahl) return toast("Wähl zuerst ein Gefühl aus", "fehler");
    const feld = document.getElementById("gefuehlText");
    if (await tun(db.from("checkins").insert({ wert: this.wahl, text: feld.value.trim() || null }))) {
      this.wahl = null; feld.value = ""; toast("Geteilt ✓"); seiteAktualisieren();
    }
  }
};

/* =========================================================
   RECAP · Monatsrückblick
   ========================================================= */
registriereSeite("rueckblick", {
  render(el) {
    const monat = B.rueck.monat;
    const [j, m] = monat.split("-").map(Number);
    const von = new Date(j, m - 1, 1).toISOString(), bis = new Date(j, m, 1).toISOString();
    zeigeMitCache("rueckblick-" + monat, async () => {
      const [momente, essen, treffen, checks, abc] = await Promise.all([
        hol(db.from("posts").select("datei_pfad, weitere_pfade, typ, erstellt_um").gte("erstellt_um", von).lt("erstellt_um", bis).order("erstellt_um")),
        hol(db.from("essen").select("datei_pfad").gte("erstellt_um", von).lt("erstellt_um", bis).order("erstellt_um")),
        hol(db.from("besuche").select("*").gte("ankunft", von).lt("ankunft", bis).order("ankunft")),
        hol(db.from("checkins").select("user_id, wert").gte("erstellt_um", von).lt("erstellt_um", bis)),
        hol(db.from("abc_buchstaben").select("buchstabe, datum").eq("erledigt", true).gte("datum", von.slice(0, 10)).lt("datum", bis.slice(0, 10)))
      ]);
      const bilder = [...momente.filter(x => x.typ === "foto").flatMap(x => [x.datei_pfad, ...(x.weitere_pfade || [])]), ...essen.map(x => x.datei_pfad)].slice(0, 90);
      await bildUrlsHolen(bilder);
      return { momente: momente.length, essen: essen.length, treffen, checks, abc, bilder };
    }, d => {
      if (!istAktuell("rueckblick") || B.rueck.monat !== monat) return;
      d = d || { momente: 0, essen: 0, treffen: [], checks: [], abc: [], bilder: [] };
      const monate = [...Array(12)].map((_, i) => { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() - i); return x; });
      const stimmung = id => { const w = d.checks.filter(c => c.user_id === id).map(c => c.wert); return w.length ? GEFUEHLE[Math.round(w.reduce((a, b) => a + b, 0) / w.length) - 1] : "–"; };
      const kachel = (zahl, text, icon) => `<div class="karte" style="margin:0;text-align:center;padding:14px 8px"><i class="ti ti-${icon}" style="font-size:20px;color:var(--text3)"></i>
        <div style="font-size:26px;font-weight:800">${zahl}</div><div class="meta" style="margin:0">${text}</div></div>`;
      setzeHtml(el, `
        <div class="chips">${monate.map(x => { const k = x.toLocaleDateString("sv-SE").slice(0, 7);
          return `<button class="chip ${k === monat ? "aktiv" : ""}" onclick="B.rueck.wahl('${k}')">${x.toLocaleDateString("de-DE", { month: "short", year: x.getFullYear() !== new Date().getFullYear() ? "2-digit" : undefined })}</button>`; }).join("")}</div>
        <div style="font-size:24px;font-weight:800;margin:4px 4px 12px">${new Date(j, m - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px">
          ${kachel(d.momente, "Momente", "camera")}${kachel(d.essen, "Essen", "tools-kitchen-2")}
          ${kachel(d.treffen.length, "Treffen", "train")}${kachel(d.abc.length, "ABC-Dates", "abc")}
        </div>
        <div class="karte">
          <div class="karte-titel">Stimmung</div>
          <div class="reihe" style="justify-content:space-around">${leute.map(p => `<div style="text-align:center"><div style="font-size:34px">${stimmung(p.user_id)}</div><div class="meta">${schuetzen(p.name)}</div></div>`).join("")}</div>
          ${d.treffen.length ? `<div style="margin-top:10px">${d.treffen.map(t => `<div class="zeile"><i class="ti ti-train" style="font-size:20px;color:var(--text2)"></i><div class="inhalt"><div class="haupt">${schuetzen(t.reisender)}</div><div class="neben">${datumKurz(t.ankunft)}</div></div></div>`).join("")}</div>` : ""}
        </div>
        ${d.bilder.length ? `<div class="abschnitt">Fotos</div><div class="raster">${d.bilder.map(p => bildTag(p)).join("")}</div>` : leer("In diesem Monat gibt es noch keine Fotos", "photo")}`);
    });
  }
});

B.rueck = {
  monat: (() => { const x = new Date(); if (x.getDate() <= 3) x.setMonth(x.getMonth() - 1); return x.toLocaleDateString("sv-SE").slice(0, 7); })(),
  wahl(k) { this.monat = k; seiteAktualisieren(); }
};

/* Falls die App schon offen ist (Seite wurde vor diesem Skript geöffnet): jetzt zeichnen */
if (typeof ich !== "undefined" && ich && aktuelleSeite !== "heute") seiteAktualisieren();
