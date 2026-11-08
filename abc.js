(() => {
  const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const namen = {};
  let zeilen = [];
  let anzahl = {};
  let offen = null;
  let zielEintrag = null;

  const el = html => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  const esc = t => schuetzen(String(t ?? ""));
  const leer = t => `<div class="meta" style="text-align:center">${t}</div>`;
  const heuteText = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

  const HTML = `
    <div>
      <div class="post" id="abcAktuell"></div>
      <div class="post">
        <div style="font-weight:600;margin-bottom:8px">Alle Buchstaben</div>
        <div id="abcRaster" style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px"></div>
      </div>
      <div id="abcDetail"></div>
      <input id="abcDatei" type="file" accept="image/*,video/*" multiple class="versteckt">
    </div>`;

  async function urls(pfade) {
    if (!pfade.length) return {};
    const { data } = await db.storage.from("medien").createSignedUrls(pfade, 3600);
    const m = {};
    (data || []).forEach(x => { if (x.signedUrl) m[x.path] = x.signedUrl; });
    return m;
  }

  function stand() {
    const fertig = zeilen.filter(z => z.erledigt);
    const fertigSet = new Set(fertig.map(z => z.buchstabe));
    const aktuell = ABC.find(b => !fertigSet.has(b)) || null;
    const letzte = fertig.slice().sort((a, b) => ABC.indexOf(b.buchstabe) - ABC.indexOf(a.buchstabe))[0] || null;
    const zeile = zeilen.find(z => z.buchstabe === aktuell);
    let planer = (zeile && zeile.geplant_von) || null;
    if (!planer && letzte && letzte.geplant_von) planer = Object.keys(namen).find(id => id !== letzte.geplant_von) || null;
    return { fertigSet, aktuell, letzte, planer };
  }

  function zeigeAktuell() {
    const { aktuell, letzte, planer } = stand();
    const box = document.getElementById("abcAktuell");
    if (!aktuell) {
      box.innerHTML = `<div style="text-align:center;font-size:22px;font-weight:700">Ihr habt das ganze Alphabet geschafft! 🎉</div>`;
      return;
    }
    const personKnopf = ([id, n]) =>
      `<button onclick="abcPlaner('${id}')" style="flex:1;background:${planer === id ? "#e8707e" : "#f3f3f3"};color:${planer === id ? "white" : "#333"}">${esc(n)}</button>`;
    box.innerHTML = `
      <div style="text-align:center">
        <div class="meta">Als Nächstes dran</div>
        <div style="font-size:56px;font-weight:800;color:#e8707e;line-height:1.1">${aktuell}</div>
      </div>
      <div class="meta" style="margin-top:8px">Wer plant das ${aktuell}-Date?</div>
      <div style="display:flex;gap:6px;margin:4px 0 8px">${Object.entries(namen).map(personKnopf).join("")}</div>
      ${letzte ? `<div class="meta">Zuletzt: ${letzte.buchstabe}${letzte.geplant_von ? " – geplant von " + esc(namen[letzte.geplant_von] || "?") : ""}${letzte.datum ? " · " + new Date(letzte.datum).toLocaleDateString("de-DE") : ""}</div>` : ""}
      <button onclick="abcOeffnen('${aktuell}')" style="margin-top:8px;background:#f3f3f3;color:#333">📸 Erinnerungen zum ${aktuell}-Date</button>
      <button onclick="abcErledigt()" style="margin-top:6px">✅ ${aktuell}-Date erledigt</button>`;
  }

  function zeigeRaster() {
    const { fertigSet, aktuell } = stand();
    document.getElementById("abcRaster").innerHTML = ABC.map(b => {
      const fertig = fertigSet.has(b);
      const hg = fertig ? "#e8707e" : b === aktuell ? "#fff" : "#f3f3f3";
      const farbe = fertig ? "white" : "#333";
      const rand = b === offen ? "2px solid #333" : b === aktuell ? "2px solid #e8707e" : "none";
      return `<button onclick="abcOeffnen('${b}')" style="width:auto;padding:8px 0;font-size:18px;background:${hg};color:${farbe};border:${rand}">${b}${anzahl[b] ? `<div style="font-size:10px">${anzahl[b]}×</div>` : ""}</button>`;
    }).join("");
  }

  async function laden() {
    const [z, e] = await Promise.all([
      db.from("abc_buchstaben").select("*"),
      db.from("abc_eintraege").select("buchstabe")
    ]);
    zeilen = z.data || [];
    anzahl = {};
    (e.data || []).forEach(x => { anzahl[x.buchstabe] = (anzahl[x.buchstabe] || 0) + 1; });
    zeigeAktuell();
    zeigeRaster();
  }

  window.abcPlaner = async id => {
    const { aktuell } = stand();
    const { error } = await db.from("abc_buchstaben").upsert({ buchstabe: aktuell, geplant_von: id });
    if (error) return alert("Fehler: " + error.message);
    laden();
  };

  window.abcErledigt = async () => {
    const { aktuell, planer } = stand();
    if (!planer) return alert("Wähl zuerst aus, wer das " + aktuell + "-Date geplant hat.");
    if (!confirm(`Das ${aktuell}-Date als erledigt markieren?`)) return;
    const { error } = await db.from("abc_buchstaben").upsert({ buchstabe: aktuell, geplant_von: planer, erledigt: true, datum: heuteText() });
    if (error) return alert("Fehler: " + error.message);
    const naechster = ABC[ABC.indexOf(aktuell) + 1];
    const anderer = Object.keys(namen).find(id => id !== planer);
    if (naechster && anderer) await db.from("abc_buchstaben").upsert({ buchstabe: naechster, geplant_von: anderer });
    await laden();
    abcOeffnen(aktuell);
  };

  window.abcOeffnen = async b => {
    offen = b;
    zeigeRaster();
    const box = document.getElementById("abcDetail");
    box.innerHTML = leer("Lädt …");
    const { data: eintraege } = await db.from("abc_eintraege").select("*").eq("buchstabe", b).order("erstellt_um");
    const ids = (eintraege || []).map(e => e.id);
    const medien = ids.length ? ((await db.from("abc_medien").select("*").in("eintrag_id", ids).order("erstellt_um")).data || []) : [];
    const u = await urls(medien.map(m => m.datei_pfad));
    const medienHtml = e => medien.filter(m => m.eintrag_id === e.id && u[m.datei_pfad]).map(m =>
      m.typ === "video"
        ? `<video src="${u[m.datei_pfad]}" controls playsinline style="width:100%;border-radius:10px"></video>`
        : `<img src="${u[m.datei_pfad]}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;margin:0">`
    ).join("");
    box.innerHTML = `
      <div class="post">
        <div style="font-size:28px;font-weight:800;color:#e8707e">${b}</div>
        ${(eintraege || []).map(e => `
          <div style="margin:12px 0;border-top:1px solid #eee;padding-top:10px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;font-weight:600;font-size:17px">${esc(e.titel)}</div>
              <button onclick="abcEintragLoeschen(${e.id})" style="width:auto;background:#f3f3f3;color:#333">🗑️</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0">${medienHtml(e)}</div>
            <button onclick="abcMedienWaehlen(${e.id})" style="background:#f3f3f3;color:#333">📷 Fotos/Videos hinzufügen</button>
          </div>`).join("") || leer("Noch nichts eingetragen")}
        <div id="abcStatus" class="meta"></div>
        <input id="abcTitel" placeholder="Was habt ihr gemacht? z. B. Brunch" style="margin-top:10px">
        <button onclick="abcEintragNeu()" style="margin-top:6px">+ Aktivität hinzufügen</button>
      </div>`;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  window.abcEintragNeu = async () => {
    const feld = document.getElementById("abcTitel");
    const titel = feld.value.trim();
    if (!titel) return;
    const { error } = await db.from("abc_eintraege").insert({ buchstabe: offen, titel });
    if (error) return alert("Fehler: " + error.message);
    await laden();
    abcOeffnen(offen);
  };

  window.abcEintragLoeschen = async id => {
    if (!confirm("Diese Aktivität mit allen Bildern löschen?")) return;
    await db.from("abc_eintraege").delete().eq("id", id);
    await laden();
    abcOeffnen(offen);
  };

  window.abcMedienWaehlen = id => {
    zielEintrag = id;
    document.getElementById("abcDatei").click();
  };

  async function abcHochladen(dateien) {
    if (!dateien.length || !zielEintrag) return;
    const status = document.getElementById("abcStatus");
    let n = 0;
    for (const datei of dateien) {
      n++;
      if (status) status.textContent = `Lädt hoch … (${n}/${dateien.length})`;
      const typ = datei.type.startsWith("video") ? "video" : "foto";
      const pfad = ich.id + "/abc-" + Date.now() + "-" + n + "-" + datei.name;
      const { error } = await db.storage.from("medien").upload(pfad, datei);
      if (error) { alert("Upload fehlgeschlagen: " + error.message); continue; }
      await db.from("abc_medien").insert({ eintrag_id: zielEintrag, datei_pfad: pfad, typ });
    }
    document.getElementById("abcDatei").value = "";
    abcOeffnen(offen);
  }

  function aktivieren() {
    document.querySelectorAll("[data-tab]").forEach(b => {
      const aktiv = b.dataset.tab === "abc";
      b.style.background = aktiv ? "#e8707e" : "#f3f3f3";
      b.style.color = aktiv ? "white" : "#333";
    });
    document.querySelectorAll(".ex-bereich").forEach(d => { d.style.display = d.id === "tab-abc" ? "" : "none"; });
    window.scrollTo(0, 0);
    laden();
  }

  async function einbauen(nav) {
    const { data } = await db.from("personen").select("user_id, name");
    (data || []).forEach(p => { namen[p.user_id] = p.name; });

    const knopf = el(`<button style="flex:1;padding:6px 0;font-size:20px;line-height:1.1;background:#f3f3f3;color:#333">🔤<div style="font-size:11px">ABC</div></button>`);
    knopf.dataset.tab = "abc";
    knopf.onclick = aktivieren;
    nav.insertBefore(knopf, nav.querySelector('[data-tab="essen"]'));

    const bereich = el(HTML);
    bereich.id = "tab-abc";
    bereich.classList.add("ex-bereich");
    bereich.style.display = "none";
    document.getElementById("app").appendChild(bereich);
    document.getElementById("abcDatei").onchange = ev => abcHochladen([...ev.target.files]);
  }

  const warte = setInterval(() => {
    const heuteKnopf = document.querySelector('[data-tab="heute"]');
    if (heuteKnopf && typeof ich !== "undefined" && ich) {
      clearInterval(warte);
      einbauen(heuteKnopf.parentElement);
    }
  }, 300);
})();
