(() => {
  const namen = {};
  const ARTEN = {
    restaurant: { symbol: "🍽️", name: "Restaurants", einzahl: "Restaurant" },
    cafe: { symbol: "☕", name: "Cafés", einzahl: "Café" },
    bar: { symbol: "🍸", name: "Bars", einzahl: "Bar" }
  };
  const KUECHEN = ["Italienisch", "Pizza", "Japanisch", "Sushi", "Vietnamesisch", "Thailändisch", "Koreanisch", "Chinesisch",
    "Indisch", "Mexikanisch", "Griechisch", "Türkisch", "Libanesisch", "Deutsch", "Bayerisch", "Burger", "Steak",
    "Vegetarisch", "Vegan", "Frühstück & Brunch", "Kuchen & Torten", "Cocktails", "Wein", "Bier"];
  const STANDARD_STAEDTE = ["Düsseldorf", "München"];

  let stadt = "Düsseldorf";
  let art = "restaurant";
  let extraStaedte = [];
  let orte = [];
  let bewertungen = [];
  let fotos = [];
  let fotoZiel = null;

  const el = html => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  const esc = t => schuetzen(String(t ?? ""));
  const leer = t => `<div class="meta" style="text-align:center">${t}</div>`;
  const AN = "background:#1f3a68;color:white";
  const AUS = "background:#f3f3f3;color:#333";
  const CHIP = "width:auto;flex:0 0 auto;padding:8px 14px;border-radius:20px;margin:0";

  const HTML = `
    <div>
      <div id="ortStaedte" style="display:flex;gap:6px;overflow-x:auto;margin-bottom:10px;padding-bottom:2px"></div>
      <div id="ortArten" style="display:flex;gap:6px;margin-bottom:10px"></div>
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <button onclick="ortZufall()" style="flex:1">🎲 Zufall: Wohin heute?</button>
        <button onclick="ortFormular()" style="width:auto;${AUS}">➕ Neu</button>
      </div>
      <div class="post versteckt" id="ortNeu">
        <div style="font-weight:600;margin-bottom:6px">Neuer Ort</div>
        <input id="ortName" placeholder="Name">
        <select id="ortArt">${Object.entries(ARTEN).map(([k, a]) => `<option value="${k}">${a.symbol} ${a.einzahl}</option>`).join("")}</select>
        <input id="ortStadt" list="ortStadtListe" placeholder="Stadt">
        <datalist id="ortStadtListe"></datalist>
        <input id="ortKueche" list="ortKuechen" placeholder="Küche, z. B. Italienisch (optional)">
        <datalist id="ortKuechen">${KUECHEN.map(k => `<option value="${k}">`).join("")}</datalist>
        <input id="ortAdresse" placeholder="Adresse (optional)">
        <select id="ortBesucht">
          <option value="nein">📌 Wollen wir hin</option>
          <option value="ja">✅ Waren wir schon</option>
        </select>
        <div style="display:flex;gap:6px">
          <button onclick="ortFormular(false)" style="${AUS}">Abbrechen</button>
          <button onclick="ortSpeichern()">Speichern</button>
        </div>
      </div>
      <div id="ortListe"></div>
      <input id="ortFotoDatei" type="file" accept="image/*" multiple class="versteckt">
    </div>`;

  // ---------- Hilfen ----------
  function verkleinern(datei) {
    return new Promise((ok, fehler) => {
      const bild = new Image();
      bild.onload = () => {
        const f = Math.min(1, 1400 / Math.max(bild.width, bild.height));
        const c = document.createElement("canvas");
        c.width = Math.round(bild.width * f);
        c.height = Math.round(bild.height * f);
        c.getContext("2d").drawImage(bild, 0, 0, c.width, c.height);
        URL.revokeObjectURL(bild.src);
        c.toBlob(b => b ? ok(b) : fehler(new Error("Bild konnte nicht umgewandelt werden")), "image/jpeg", 0.85);
      };
      bild.onerror = () => fehler(new Error("Bild konnte nicht geladen werden"));
      bild.src = URL.createObjectURL(datei);
    });
  }

  function bewerten(titel) {
    return new Promise(fertig => {
      let sterne = 0;
      const fenster = el(`
        <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:80;display:flex;align-items:center;justify-content:center;padding:16px">
          <div class="post" style="width:100%;max-width:420px;margin:0">
            <div style="font-weight:700;font-size:18px">${esc(titel)}</div>
            <div class="meta">Wie war's?</div>
            <div class="o-sterne" style="display:flex;justify-content:center;gap:4px;margin:12px 0"></div>
            <textarea rows="2" placeholder="Was habt ihr gegessen? Wie war's? (optional)"></textarea>
            <div style="display:flex;gap:6px">
              <button class="o-weg" style="${AUS}">Abbrechen</button>
              <button class="o-ok">Speichern</button>
            </div>
          </div>
        </div>`);
      const reihe = fenster.querySelector(".o-sterne");
      const zeichnen = () => {
        reihe.innerHTML = [1, 2, 3, 4, 5].map(i =>
          `<button data-s="${i}" style="width:auto;background:none;font-size:34px;padding:2px;opacity:${i <= sterne ? 1 : .25}">⭐</button>`).join("");
      };
      zeichnen();
      reihe.onclick = e => { const s = e.target.closest("[data-s]"); if (s) { sterne = Number(s.dataset.s); zeichnen(); } };
      const zu = wert => { fenster.remove(); fertig(wert); };
      fenster.querySelector(".o-weg").onclick = () => zu(null);
      fenster.querySelector(".o-ok").onclick = () => {
        if (!sterne) return alert("Tipp auf die Sterne.");
        zu({ sterne, kommentar: fenster.querySelector("textarea").value.trim() || null });
      };
      document.body.appendChild(fenster);
    });
  }

  const schnitt = w => (w.reduce((a, b) => a + b, 0) / w.length).toFixed(1).replace(".", ",");
  const kartenLink = o => "https://maps.apple.com/?q=" + encodeURIComponent([o.name, o.adresse, o.stadt].filter(Boolean).join(", "));
  const alleStaedte = () => [...new Set([...STANDARD_STAEDTE, ...orte.map(o => o.stadt), ...extraStaedte])];

  // ---------- Anzeige ----------
  function leistenZeichnen() {
    document.getElementById("ortStaedte").innerHTML =
      alleStaedte().map(s => `<button onclick="ortStadt(this.dataset.stadt)" data-stadt="${esc(s)}" style="${CHIP};${s === stadt ? AN : AUS}">${esc(s)}</button>`).join("") +
      `<button onclick="ortNeueStadt()" style="${CHIP};${AUS}">+ Stadt</button>`;
    document.getElementById("ortArten").innerHTML = Object.entries(ARTEN).map(([k, a]) => {
      const zahl = orte.filter(o => o.stadt === stadt && o.art === k).length;
      return `<button onclick="ortArtWahl('${k}')" style="flex:1;padding:8px 4px;font-size:14px;margin:0;${k === art ? AN : AUS}">${a.symbol} ${a.name} (${zahl})</button>`;
    }).join("");
    document.getElementById("ortStadtListe").innerHTML = alleStaedte().map(s => `<option value="${esc(s)}">`).join("");
  }

  function karte(o, urls) {
    const eigene = bewertungen.filter(b => b.ort_id === o.id);
    const proPerson = Object.entries(namen).map(([id, n]) => {
      const w = eigene.filter(b => b.user_id === id).map(b => b.sterne);
      return w.length ? `${esc(n)} ⭐ ${schnitt(w)}` : null;
    }).filter(Boolean).join(" · ");
    const bilder = fotos.filter(f => f.ort_id === o.id && urls[f.datei_pfad]);
    const liste = eigene.slice().sort((a, b) => new Date(b.erstellt_um) - new Date(a.erstellt_um)).map(b =>
      `<div class="kommentar"><b>${esc(namen[b.user_id] || "?")}</b> ${"⭐".repeat(b.sterne)} <span class="meta">${new Date(b.erstellt_um).toLocaleDateString("de-DE")}</span>${b.kommentar ? "<br>" + esc(b.kommentar) : ""}</div>`).join("");

    return `
      <div class="post" id="ort-${o.id}">
        <div style="font-weight:700;font-size:18px">${esc(o.name)}</div>
        <div class="meta">${o.kueche ? esc(o.kueche) + " · " : ""}${ARTEN[o.art].einzahl}${proPerson ? " · " + proPerson : ""}</div>
        ${o.adresse ? `<div class="kommentar"><a href="${kartenLink(o)}" target="_blank" rel="noopener">📍 ${esc(o.adresse)}</a></div>` : `<div class="kommentar"><a href="${kartenLink(o)}" target="_blank" rel="noopener">📍 In Karten suchen</a></div>`}
        ${bilder.length ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:8px">${bilder.map(f => `<img src="${urls[f.datei_pfad]}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;margin:0">`).join("")}</div>` : ""}
        <div style="display:flex;gap:6px;margin-top:8px">
          <button onclick="ortBewerten(${o.id})" style="flex:1">⭐ Bewerten</button>
          <button onclick="ortFotos(${o.id})" style="width:auto;${AUS}">📷</button>
          ${o.besucht ? "" : `<button onclick="ortBesucht(${o.id})" style="width:auto;${AUS}">✅ Waren wir</button>`}
          <button onclick="ortLoeschen(${o.id})" style="width:auto;${AUS}">🗑️</button>
        </div>
        ${liste ? `<details><summary class="meta">Bewertungen (${eigene.length})</summary>${liste}</details>` : ""}
      </div>`;
  }

  async function laden() {
    const [o, b, f] = await Promise.all([
      db.from("orte").select("*").order("name"),
      db.from("ort_bewertungen").select("*"),
      db.from("ort_fotos").select("*").order("erstellt_um")
    ]);
    orte = o.data || [];
    bewertungen = b.data || [];
    fotos = f.data || [];
    leistenZeichnen();

    const sichtbar = orte.filter(x => x.stadt === stadt && x.art === art);
    const pfade = fotos.filter(x => sichtbar.some(s => s.id === x.ort_id)).map(x => x.datei_pfad);
    const urls = {};
    if (pfade.length) {
      const { data } = await db.storage.from("medien").createSignedUrls(pfade, 3600);
      (data || []).forEach(l => { if (l.signedUrl) urls[l.path] = l.signedUrl; });
    }

    const wert = x => {
      const w = bewertungen.filter(b => b.ort_id === x.id).map(b => b.sterne);
      return w.length ? w.reduce((a, c) => a + c, 0) / w.length : 0;
    };
    const geplant = sichtbar.filter(x => !x.besucht);
    const besucht = sichtbar.filter(x => x.besucht).sort((a, c) => wert(c) - wert(a));
    const a = ARTEN[art];

    document.getElementById("ortListe").innerHTML = sichtbar.length ? `
      ${geplant.length ? `<div class="meta" style="font-weight:600">📌 Wollen wir hin (${geplant.length})</div>${geplant.map(x => karte(x, urls)).join("")}` : ""}
      ${besucht.length ? `<div class="meta" style="font-weight:600">✅ Waren wir – beste zuerst (${besucht.length})</div>${besucht.map(x => karte(x, urls)).join("")}` : ""}`
      : leer(`Noch keine ${a.name} in ${esc(stadt)} ${a.symbol}`);
  }

  // ---------- Aktionen ----------
  window.ortStadt = s => { stadt = s; laden(); };
  window.ortArtWahl = k => { art = k; laden(); };

  window.ortNeueStadt = () => {
    const s = (prompt("Welche Stadt? (z. B. für euren Urlaub)") || "").trim();
    if (!s) return;
    if (!alleStaedte().includes(s)) extraStaedte.push(s);
    stadt = s;
    laden();
  };

  window.ortFormular = (zeigen = true) => {
    const f = document.getElementById("ortNeu");
    f.classList.toggle("versteckt", !zeigen);
    if (zeigen) {
      document.getElementById("ortArt").value = art;
      document.getElementById("ortStadt").value = stadt;
      document.getElementById("ortName").focus();
    }
  };

  window.ortSpeichern = async () => {
    const wert = id => document.getElementById(id).value.trim();
    const name = wert("ortName"), neueStadt = wert("ortStadt");
    if (!name) return alert("Bitte einen Namen eintragen.");
    if (!neueStadt) return alert("Bitte eine Stadt eintragen.");
    const { error } = await db.from("orte").insert({
      name, stadt: neueStadt, art: wert("ortArt"),
      kueche: wert("ortKueche") || null,
      adresse: wert("ortAdresse") || null,
      besucht: wert("ortBesucht") === "ja"
    });
    if (error) return alert("Fehler: " + error.message);
    ["ortName", "ortKueche", "ortAdresse"].forEach(id => { document.getElementById(id).value = ""; });
    stadt = neueStadt;
    art = wert("ortArt");
    ortFormular(false);
    laden();
  };

  window.ortBewerten = async id => {
    const o = orte.find(x => x.id === id);
    const b = await bewerten(o.name);
    if (!b) return;
    await db.from("ort_bewertungen").insert({ ort_id: id, ...b });
    if (!o.besucht) await db.from("orte").update({ besucht: true }).eq("id", id);
    laden();
  };

  window.ortBesucht = async id => {
    await db.from("orte").update({ besucht: true }).eq("id", id);
    laden();
  };

  window.ortFotos = id => {
    fotoZiel = id;
    document.getElementById("ortFotoDatei").click();
  };

  window.ortLoeschen = async id => {
    if (!confirm("Diesen Ort mit allen Bewertungen und Fotos löschen?")) return;
    await db.from("orte").delete().eq("id", id);
    laden();
  };

  window.ortZufall = () => {
    const kandidaten = orte.filter(o => o.stadt === stadt && o.art === art);
    if (!kandidaten.length) return alert(`Noch keine ${ARTEN[art].name} in ${stadt} eingetragen.`);
    // Orte mit guten Bewertungen und noch nicht besuchte Orte kommen etwas häufiger dran
    const gewicht = o => {
      const w = bewertungen.filter(b => b.ort_id === o.id).map(b => b.sterne);
      if (!o.besucht) return 3;
      return w.length ? Math.max(1, w.reduce((a, c) => a + c, 0) / w.length) : 2;
    };
    const summe = kandidaten.reduce((s, o) => s + gewicht(o), 0);
    let r = Math.random() * summe;
    const treffer = kandidaten.find(o => (r -= gewicht(o)) <= 0) || kandidaten[0];

    const fenster = el(`
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:80;display:flex;align-items:center;justify-content:center;padding:16px">
        <div class="post" style="width:100%;max-width:420px;margin:0;text-align:center">
          <div style="font-size:48px">🎲</div>
          <div class="meta">Heute geht's ins …</div>
          <div style="font-weight:800;font-size:24px;margin:6px 0">${esc(treffer.name)}</div>
          <div class="meta">${treffer.kueche ? esc(treffer.kueche) + " · " : ""}${treffer.besucht ? "✅ Waren wir schon" : "📌 Neu für euch"}</div>
          <div class="kommentar" style="margin:10px 0"><a href="${kartenLink(treffer)}" target="_blank" rel="noopener">📍 Route anzeigen</a></div>
          <div style="display:flex;gap:6px">
            <button class="z-nochmal" style="${AUS}">Nochmal 🎲</button>
            <button class="z-ok">Passt!</button>
          </div>
        </div>
      </div>`);
    fenster.querySelector(".z-ok").onclick = () => {
      fenster.remove();
      document.getElementById("ort-" + treffer.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    fenster.querySelector(".z-nochmal").onclick = () => { fenster.remove(); ortZufall(); };
    document.body.appendChild(fenster);
  };

  // ---------- Reiter einbauen ----------
  function aktivieren() {
    document.querySelectorAll("[data-tab]").forEach(b => {
      const aktiv = b.dataset.tab === "orte";
      b.style.background = aktiv ? "#1f3a68" : "#f3f3f3";
      b.style.color = aktiv ? "white" : "#333";
    });
    document.querySelectorAll(".ex-bereich").forEach(d => { d.style.display = d.id === "tab-orte" ? "" : "none"; });
    window.scrollTo(0, 0);
    laden();
  }

  async function einbauen(nach) {
    const { data } = await db.from("personen").select("user_id, name");
    (data || []).forEach(p => { namen[p.user_id] = p.name; });

    const knopf = el(`<button style="flex:1 0 54px;padding:6px 0;font-size:20px;line-height:1.1;background:#f3f3f3;color:#333">📍<div style="font-size:11px">Orte</div></button>`);
    knopf.dataset.tab = "orte";
    knopf.onclick = aktivieren;
    nach.after(knopf);

    const bereich = el(HTML);
    bereich.id = "tab-orte";
    bereich.classList.add("ex-bereich");
    bereich.style.display = "none";
    document.getElementById("app").appendChild(bereich);

    document.getElementById("ortFotoDatei").onchange = async ev => {
      const dateien = [...ev.target.files];
      ev.target.value = "";
      if (!dateien.length || !fotoZiel) return;
      try {
        for (const datei of dateien) {
          const blob = await verkleinern(datei);
          const pfad = `${ich.id}/ort-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
          const { error } = await db.storage.from("medien").upload(pfad, blob, { contentType: "image/jpeg" });
          if (error) throw error;
          await db.from("ort_fotos").insert({ ort_id: fotoZiel, datei_pfad: pfad });
        }
        laden();
      } catch (e) {
        alert("Foto konnte nicht hochgeladen werden: " + e.message);
      }
    };
  }

  let versuche = 0;
  const warte = setInterval(() => {
    versuche++;
    const nach = document.querySelector('[data-tab="watchlist"]') || document.querySelector('[data-tab="kochbuch"]') ||
      (versuche > 20 && document.querySelector('[data-tab="essen"]'));
    if (nach && typeof ich !== "undefined" && ich) {
      clearInterval(warte);
      einbauen(nach);
    }
  }, 300);
})();
