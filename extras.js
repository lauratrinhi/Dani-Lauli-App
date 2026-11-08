(() => {
  const TAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const GEFUEHLE = ["😢", "😕", "😐", "🙂", "🥰"];
  const namen = {};
  let gewaehlt = null;

  const el = html => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  const esc = t => schuetzen(String(t ?? ""));
  const nameVon = id => namen[id] || "?";
  const tagKey = d => new Date(d).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const leerText = t => `<div class="meta" style="text-align:center">${t}</div>`;

  async function urls(pfade) {
    if (!pfade.length) return {};
    const { data } = await db.storage.from("medien").createSignedUrls(pfade, 3600);
    const m = {};
    (data || []).forEach(x => { if (x.signedUrl) m[x.path] = x.signedUrl; });
    return m;
  }

  // ---------- Gemeinsame Liste ----------
  const LISTE_HTML = `
    <div>
      <div class="post">
        <div style="font-weight:600">💕 Beim nächsten Treffen</div>
        <div id="exTreffen"></div>
        <input id="exTreffenText" placeholder="Was wollen wir machen?">
        <button onclick="exListeNeu('treffen')" style="margin-top:6px">Hinzufügen</button>
      </div>
      <div class="post">
        <div style="font-weight:600">✅ Gemeinsame To-dos</div>
        <div id="exTodos"></div>
        <input id="exTodoText" placeholder="z. B. Urlaub planen">
        <div class="meta">Fällig am (optional)</div>
        <input id="exTodoDatum" type="date">
        <button onclick="exListeNeu('todo')" style="margin-top:6px">Hinzufügen</button>
      </div>
    </div>`;

  async function ladeListe() {
    const { data } = await db.from("liste").select("*").eq("erledigt", false)
      .order("faellig", { nullsFirst: false }).order("erstellt_um");
    const zeile = x => `
      <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
        <div style="flex:1" class="kommentar">${esc(x.text)}${x.faellig ? ` <span class="meta">· bis ${new Date(x.faellig).toLocaleDateString("de-DE")}</span>` : ""} <span class="meta">· ${esc(nameVon(x.von))}</span></div>
        <button onclick="exListeFertig(${x.id})" style="width:auto;background:#f3f3f3;color:#333">✅</button>
      </div>`;
    const alle = data || [];
    document.getElementById("exTreffen").innerHTML = alle.filter(x => x.art === "treffen").map(zeile).join("") || leerText("Noch nichts eingetragen");
    document.getElementById("exTodos").innerHTML = alle.filter(x => x.art === "todo").map(zeile).join("") || leerText("Noch nichts eingetragen");
  }

  window.exListeNeu = async art => {
    const feld = document.getElementById(art === "todo" ? "exTodoText" : "exTreffenText");
    const text = feld.value.trim();
    if (!text) return;
    const faellig = art === "todo" ? (document.getElementById("exTodoDatum").value || null) : null;
    const { error } = await db.from("liste").insert({ text, art, faellig });
    if (error) return alert("Fehler: " + error.message);
    feld.value = "";
    if (art === "todo") document.getElementById("exTodoDatum").value = "";
    ladeListe();
  };

  window.exListeFertig = async id => {
    await db.from("liste").update({ erledigt: true }).eq("id", id);
    ladeListe();
  };

  // ---------- Food Diary ----------
  const ESSEN_HTML = `
    <div>
      <div class="post">
        <input id="exEssenNotiz" placeholder="Was gibt's? (optional)">
        <button onclick="document.getElementById('exEssenDatei').click()" style="margin-top:6px">🍽️ Essen fotografieren</button>
        <input id="exEssenDatei" type="file" accept="image/*" capture="environment" class="versteckt">
        <div id="exEssenStatus" class="meta"></div>
      </div>
      <div id="exEssenFeed"></div>
    </div>`;

  async function essenHochladen(datei) {
    if (!datei) return;
    const status = document.getElementById("exEssenStatus");
    status.textContent = "Wird hochgeladen …";
    const pfad = ich.id + "/essen-" + Date.now() + "-" + datei.name;
    const { error } = await db.storage.from("medien").upload(pfad, datei);
    if (error) { status.textContent = ""; return alert("Upload fehlgeschlagen: " + error.message); }
    const notizFeld = document.getElementById("exEssenNotiz");
    const { error: fehler } = await db.from("essen").insert({ datei_pfad: pfad, notiz: notizFeld.value.trim() || null });
    if (fehler) { status.textContent = ""; return alert("Fehler: " + fehler.message); }
    notizFeld.value = "";
    document.getElementById("exEssenDatei").value = "";
    status.textContent = "Gepostet! ✅";
    ladeEssen();
  }

  async function ladeEssen() {
    const seit = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data } = await db.from("essen").select("*").gte("erstellt_um", seit).order("erstellt_um", { ascending: false });
    const liste = data || [];
    const u = await urls(liste.map(x => x.datei_pfad));
    const nachTag = {};
    liste.forEach(x => { (nachTag[tagKey(x.erstellt_um)] = nachTag[tagKey(x.erstellt_um)] || []).push(x); });
    document.getElementById("exEssenFeed").innerHTML = Object.entries(nachTag).map(([tag, eintraege]) => {
      const d = new Date(tag + "T12:00");
      return `
      <div class="post">
        <div style="font-weight:600">${TAGE[d.getDay()]}, ${d.toLocaleDateString("de-DE")}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          ${eintraege.map(x => `
            <div>
              <img src="${u[x.datei_pfad] || ""}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px">
              <div class="meta">${esc(nameVon(x.user_id))} · ${new Date(x.erstellt_um).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}${x.notiz ? " · " + esc(x.notiz) : ""}</div>
            </div>`).join("")}
        </div>
      </div>`;
    }).join("") || leerText("Noch kein Essen gepostet 🍽️");
  }

  // ---------- Gefühls-Check-in ----------
  const GEFUEHL_HTML = `
    <div>
      <div class="post">
        <div style="font-weight:600">Wie fühlst du dich gerade mit uns?</div>
        <div id="exGefuehlKnoepfe" style="display:flex;justify-content:space-between;margin:10px 0"></div>
        <textarea id="exGefuehlText" rows="2" placeholder="Was würde dir gerade guttun? (optional)"></textarea>
        <button onclick="exGefuehlSpeichern()" style="margin-top:6px">Teilen</button>
      </div>
      <div id="exGefuehlVerlauf"></div>
    </div>`;

  function gefuehlKnoepfe() {
    document.getElementById("exGefuehlKnoepfe").innerHTML = GEFUEHLE.map((g, i) =>
      `<button onclick="exGefuehlWahl(${i + 1})" style="width:auto;font-size:28px;padding:6px 10px;background:${gewaehlt === i + 1 ? "#e8707e" : "#f3f3f3"}">${g}</button>`
    ).join("");
  }

  window.exGefuehlWahl = w => { gewaehlt = w; gefuehlKnoepfe(); };

  window.exGefuehlSpeichern = async () => {
    if (!gewaehlt) return alert("Wähl zuerst ein Emoji aus.");
    const feld = document.getElementById("exGefuehlText");
    const { error } = await db.from("checkins").insert({ wert: gewaehlt, text: feld.value.trim() || null });
    if (error) return alert("Fehler: " + error.message);
    gewaehlt = null;
    feld.value = "";
    gefuehlKnoepfe();
    ladeGefuehle();
  };

  async function ladeGefuehle() {
    const { data } = await db.from("checkins").select("*").order("erstellt_um", { ascending: false }).limit(20);
    document.getElementById("exGefuehlVerlauf").innerHTML = (data || []).map(c => `
      <div class="post">
        <span style="font-size:24px">${GEFUEHLE[c.wert - 1]}</span>
        <b>${esc(nameVon(c.user_id))}</b>
        <span class="meta">${new Date(c.erstellt_um).toLocaleDateString("de-DE")}</span>
        ${c.text ? `<div class="kommentar">${esc(c.text)}</div>` : ""}
      </div>`).join("") || leerText("Noch kein Check-in");
  }

  // ---------- Monatsrückblick ----------
  const RUECKBLICK_HTML = `
    <div>
      <div class="post"><select id="exMonat" style="width:100%;padding:10px;font-size:16px"></select></div>
      <div id="exRueckblick"></div>
    </div>`;

  function monatsAuswahl() {
    const s = document.getElementById("exMonat");
    const jetzt = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - i, 1);
      const o = document.createElement("option");
      o.value = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      o.textContent = d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      s.appendChild(o);
    }
    if (jetzt.getDate() <= 3) s.selectedIndex = 1;
    s.onchange = ladeRueckblick;
  }

  async function ladeRueckblick() {
    const [j, m] = document.getElementById("exMonat").value.split("-").map(Number);
    const von = new Date(j, m - 1, 1).toISOString();
    const bis = new Date(j, m, 1).toISOString();
    const box = document.getElementById("exRueckblick");
    box.innerHTML = leerText("Lädt …");
    const [p, e, b, c] = await Promise.all([
      db.from("posts").select("datei_pfad, typ, erstellt_um").gte("erstellt_um", von).lt("erstellt_um", bis).order("erstellt_um"),
      db.from("essen").select("datei_pfad").gte("erstellt_um", von).lt("erstellt_um", bis).order("erstellt_um"),
      db.from("besuche").select("*").gte("ankunft", von).lt("ankunft", bis).order("ankunft"),
      db.from("checkins").select("user_id, wert").gte("erstellt_um", von).lt("erstellt_um", bis)
    ]);
    const momente = p.data || [], essen = e.data || [], treffen = b.data || [], checks = c.data || [];
    const bilder = [...momente.filter(x => x.typ === "foto"), ...essen].slice(0, 90);
    const u = await urls(bilder.map(x => x.datei_pfad));
    const stimmung = id => {
      const w = checks.filter(x => x.user_id === id).map(x => x.wert);
      return w.length ? GEFUEHLE[Math.round(w.reduce((a, z) => a + z, 0) / w.length) - 1] : "–";
    };
    const kachel = (zahl, text) => `<div style="flex:1;text-align:center"><div style="font-size:24px;font-weight:700">${zahl}</div><div class="meta">${text}</div></div>`;
    box.innerHTML = `
      <div class="post">
        <div style="display:flex">${kachel(momente.length, "Momente")}${kachel(essen.length, "Essen")}${kachel(treffen.length, "Treffen")}</div>
        <div class="meta" style="text-align:center;margin-top:8px">Stimmung: ${Object.entries(namen).map(([id, n]) => esc(n) + " " + stimmung(id)).join(" · ")}</div>
        ${treffen.length ? `<div class="kommentar" style="margin-top:8px">${treffen.map(x => "🚆 " + esc(x.reisender) + " · " + new Date(x.ankunft).toLocaleDateString("de-DE")).join("<br>")}</div>` : ""}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">
        ${bilder.filter(x => u[x.datei_pfad]).map(x => `<img src="${u[x.datei_pfad]}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;margin:0">`).join("")}
      </div>
      ${bilder.length ? "" : leerText("In diesem Monat gibt es noch keine Fotos")}`;
  }

  // ---------- Reiter oben ----------
  function zeige(id) {
    document.querySelectorAll("[data-tab]").forEach(b => {
      const aktiv = b.dataset.tab === id;
      b.style.background = aktiv ? "#e8707e" : "#f3f3f3";
      b.style.color = aktiv ? "white" : "#333";
    });
    document.querySelectorAll(".ex-bereich").forEach(d => { d.style.display = d.id === "tab-" + id ? "" : "none"; });
    if (id === "liste") ladeListe();
    if (id === "essen") ladeEssen();
    if (id === "gefuehl") ladeGefuehle();
    if (id === "rueckblick") ladeRueckblick();
    window.scrollTo(0, 0);
  }

  async function aufbauen() {
    const { data } = await db.from("personen").select("user_id, name");
    (data || []).forEach(p => { namen[p.user_id] = p.name; });

    const app = document.getElementById("app");
    const heute = document.createElement("div");
    while (app.firstChild) heute.appendChild(app.firstChild);

    const reiter = [
      ["heute", "🏠", "Heute", heute],
      ["liste", "📋", "Liste", el(LISTE_HTML)],
      ["essen", "🍽️", "Essen", el(ESSEN_HTML)],
      ["gefuehl", "💗", "Gefühl", el(GEFUEHL_HTML)],
      ["rueckblick", "📅", "Rückblick", el(RUECKBLICK_HTML)]
    ];

    const nav = el(`<div style="display:flex;gap:6px;margin-bottom:12px;position:sticky;top:0;background:#fff7f5;padding:6px 0;z-index:5"></div>`);
    app.appendChild(nav);
    reiter.forEach(([id, symbol, text, bereich]) => {
      const knopf = el(`<button style="flex:1;padding:6px 0;font-size:20px;line-height:1.1">${symbol}<div style="font-size:11px">${text}</div></button>`);
      knopf.dataset.tab = id;
      knopf.onclick = () => zeige(id);
      nav.appendChild(knopf);
      bereich.id = "tab-" + id;
      bereich.classList.add("ex-bereich");
      app.appendChild(bereich);
    });

    document.getElementById("exEssenDatei").onchange = ev => essenHochladen(ev.target.files[0]);
    gefuehlKnoepfe();
    monatsAuswahl();
    zeige("heute");
  }

  const warte = setInterval(() => {
    const app = document.getElementById("app");
    if (typeof ich !== "undefined" && ich && app && !app.classList.contains("versteckt")) {
      clearInterval(warte);
      aufbauen();
    }
  }, 300);
})();
