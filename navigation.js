(() => {
  const BEREICHE = [
    { id: "home", name: "Home", reiter: [["heute", "Home"]] },
    { id: "dates", name: "Dates", reiter: [["liste", "Liste"], ["abc", "ABC"], ["wuensche", "Wünsche"]] },
    { id: "activity", name: "Activity", reiter: [["watchlist", "Watchlist"], ["orte", "Orte"], ["kochbuch", "Kochbuch"]] },
    { id: "recap", name: "Recap", reiter: [["essen", "Essen"], ["gefuehl", "Gefühl"], ["rueckblick", "Rückblick"]] }
  ];

  // ---------- Aussehen (wird sofort geladen) ----------
  const stil = document.createElement("style");
  stil.textContent = `
    body { padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
    body:has(#app.versteckt) #untenLeiste { display:none; }
    #app > div[style*="position:sticky"], #app > div[style*="position: sticky"] { display:none !important; }
    .nav-zurueck #app { visibility:hidden; }
    #navSchnappschuss { pointer-events:none; }
    #untenLeiste { position:fixed; left:0; right:0; bottom:0; z-index:40; display:flex; background:#fff;
      border-top:1px solid #e5e7eb; padding:6px 0 calc(6px + env(safe-area-inset-bottom)); }
    #untenLeiste button { flex:1; background:none; color:#9ca3af; border:none; margin:0; padding:10px 0 6px;
      font-size:15px; font-weight:600; position:relative; border-radius:0; }
    #untenLeiste button.aktiv { color:#1f3a68; }
    #untenLeiste button.aktiv::after { content:""; position:absolute; left:30%; right:30%; bottom:0; height:3px; border-radius:2px; background:#1f3a68; }
    #unterLeiste, .unter-kopie { display:flex; gap:6px; position:sticky; top:0; z-index:30; background:#f4f6fb; padding:8px 0; margin-bottom:8px; }
    #unterLeiste button, .unter-kopie button { flex:1; margin:0; padding:8px 4px; font-size:14px; border-radius:20px; background:#f3f3f3; color:#333; position:relative; }
    #unterLeiste button.aktiv, .unter-kopie button.aktiv { background:#1f3a68; color:#fff; }
    .nav-punkt { position:absolute; top:4px; right:calc(50% - 34px); width:9px; height:9px; border-radius:50%; background:#e53935; }
    #unterLeiste .nav-punkt { right:8px; top:4px; }
    @media (prefers-color-scheme: dark) {
      #untenLeiste { background:#1f2937 !important; border-top-color:#374151; }
      #untenLeiste button.aktiv { color:#93c5fd; }
      #untenLeiste button.aktiv::after { background:#93c5fd; }
      #unterLeiste, .unter-kopie { background:#111827 !important; }
      #unterLeiste button, .unter-kopie button { background:#374151 !important; color:#e5e7eb !important; }
      #unterLeiste button.aktiv, .unter-kopie button.aktiv { background:#1f3a68 !important; color:#fff !important; }
    }`;
  document.head.appendChild(stil);

  // ---------- Merken (überlebt das Neuladen) ----------
  const merk = {
    lesen: (name, standard) => { try { return JSON.parse(sessionStorage.getItem(name)) ?? standard; } catch (e) { return standard; } },
    schreiben: (name, wert) => { try { sessionStorage.setItem(name, JSON.stringify(wert)); } catch (e) {} }
  };
  const letzterReiter = merk.lesen("navLetzte", {});
  const vorher = merk.lesen("navAktuell", "heute");
  const original = id => document.querySelector(`[data-tab="${id}"]`);
  const bereichVon = id => BEREICHE.find(b => b.reiter.some(([r]) => r === id));
  let aktiverBereich = "home";
  let bereit = false;

  const zurueckZu = vorher !== "heute" && bereichVon(vorher) ? vorher : null;
  if (zurueckZu) {
    document.documentElement.classList.add("nav-zurueck");
    aktiverBereich = bereichVon(zurueckZu).id;
  }

  const anzeigen = () => {
    document.documentElement.classList.remove("nav-zurueck");
    document.getElementById("navSchnappschuss")?.remove();
  };

  // Momentaufnahme des aktuellen Bereichs speichern, damit er nach dem Neuladen sofort da ist
  function schnappschussSpeichern() {
    try {
      const id = merk.lesen("navAktuell", "heute");
      const bereich = document.getElementById("tab-" + id);
      if (id === "heute" || !bereich) { sessionStorage.removeItem("navSchnappschuss"); return; }
      const unter = document.getElementById("unterLeiste");
      merk.schreiben("navSchnappschuss", {
        html: (unter && unter.style.display !== "none" ? unter.outerHTML : "") + bereich.outerHTML,
        anzahl: bereich.querySelectorAll("*").length,
        y: window.scrollY
      });
    } catch (e) {}
  }
  window.addEventListener("pagehide", schnappschussSpeichern);
  document.addEventListener("visibilitychange", () => { if (document.hidden) schnappschussSpeichern(); });

  // ---------- Leisten ----------
  function untenAktiv(bereichId) {
    document.querySelectorAll("#untenLeiste button").forEach(b => b.classList.toggle("aktiv", b.dataset.bereich === bereichId));
  }

  function unterLeisteZeichnen(bereich, aktiverReiter) {
    const leiste = document.getElementById("unterLeiste");
    if (!leiste) return;
    const vorhanden = bereich.reiter.filter(([id]) => original(id));
    if (vorhanden.length < 2) { leiste.style.display = "none"; return; }
    leiste.style.display = "flex";
    leiste.innerHTML = vorhanden.map(([id, name]) =>
      `<button data-unter="${id}" class="${id === aktiverReiter ? "aktiv" : ""}">${name}</button>`).join("");
  }

  function oeffnen(reiterId) {
    const knopf = original(reiterId);
    if (!knopf) return false;
    const bereich = bereichVon(reiterId);
    aktiverBereich = bereich.id;
    letzterReiter[bereich.id] = reiterId;
    merk.schreiben("navLetzte", letzterReiter);
    merk.schreiben("navAktuell", reiterId);
    knopf.click();
    untenAktiv(bereich.id);
    unterLeisteZeichnen(bereich, reiterId);
    punkteSpiegeln();
    return true;
  }

  function punkteSpiegeln() {
    const hatPunkt = id => !!original(id)?.querySelector(".tab-punkt");
    document.querySelectorAll("#unterLeiste [data-unter]").forEach(b => {
      const da = hatPunkt(b.dataset.unter) && !b.classList.contains("aktiv");
      const p = b.querySelector(".nav-punkt");
      if (da && !p) b.insertAdjacentHTML("beforeend", '<span class="nav-punkt"></span>');
      if (!da && p) p.remove();
    });
    document.querySelectorAll("#untenLeiste [data-bereich]").forEach(b => {
      const bereich = BEREICHE.find(x => x.id === b.dataset.bereich);
      const da = bereich.id !== aktiverBereich && bereich.reiter.some(([id]) => hatPunkt(id));
      const p = b.querySelector(".nav-punkt");
      if (da && !p) b.insertAdjacentHTML("beforeend", '<span class="nav-punkt"></span>');
      if (!da && p) p.remove();
    });
  }

  // Sofort beim Laden: Leiste unten + Momentaufnahme anzeigen
  document.addEventListener("DOMContentLoaded", () => {
    const unten = document.createElement("nav");
    unten.id = "untenLeiste";
    unten.innerHTML = BEREICHE.map(b =>
      `<button data-bereich="${b.id}" class="${b.id === aktiverBereich ? "aktiv" : ""}">${b.name}</button>`).join("");
    document.body.appendChild(unten);
    unten.addEventListener("click", e => {
      const b = e.target.closest("[data-bereich]");
      if (!b || !bereit) return;
      const bereich = BEREICHE.find(x => x.id === b.dataset.bereich);
      const ziel = letzterReiter[bereich.id] && original(letzterReiter[bereich.id])
        ? letzterReiter[bereich.id]
        : (bereich.reiter.find(([id]) => original(id)) || [])[0];
      if (!ziel || !oeffnen(ziel)) alert("Dieser Bereich lädt noch – einen Moment.");
      anzeigen();
    });

    const schnapp = merk.lesen("navSchnappschuss", null);
    if (zurueckZu && schnapp && schnapp.html) {
      const kopie = document.createElement("div");
      kopie.id = "navSchnappschuss";
      kopie.innerHTML = schnapp.html;
      kopie.querySelectorAll("#unterLeiste").forEach(e => e.classList.add("unter-kopie"));
      kopie.querySelectorAll("[id]").forEach(e => e.removeAttribute("id"));
      kopie.querySelectorAll("[style]").forEach(e => { if (e.style.display === "none" && e.parentElement === kopie) e.style.display = ""; });
      kopie.id = "navSchnappschuss";
      document.querySelector("main")?.prepend(kopie);
      if (schnapp.y) setTimeout(() => window.scrollTo(0, schnapp.y), 0);
    }
  });

  // ---------- Sobald die App bereit ist ----------
  function einbauen() {
    const alteLeiste = original("heute").parentElement;
    alteLeiste.style.display = "none";

    const unter = document.createElement("div");
    unter.id = "unterLeiste";
    unter.style.display = "none";
    alteLeiste.after(unter);
    unter.addEventListener("click", e => {
      const b = e.target.closest("[data-unter]");
      if (b) oeffnen(b.dataset.unter);
    });

    bereit = true;
    setInterval(punkteSpiegeln, 2000);

    if (!zurueckZu) { anzeigen(); return; }

    // Zurück an die alte Stelle – Momentaufnahme erst wegnehmen, wenn der echte Inhalt da ist
    const schnapp = merk.lesen("navSchnappschuss", null);
    let versuche = 0, geoeffnet = false;
    const zurueck = setInterval(() => {
      versuche++;
      if (!geoeffnet && original(zurueckZu)) geoeffnet = oeffnen(zurueckZu);
      const echt = document.getElementById("tab-" + zurueckZu);
      const fertig = geoeffnet && echt && (!schnapp || echt.querySelectorAll("*").length >= schnapp.anzahl * 0.7);
      if (fertig || versuche > 40) {
        clearInterval(zurueck);
        if (!geoeffnet) oeffnen("heute");
        requestAnimationFrame(() => {
          const y = schnapp?.y || 0;
          anzeigen();
          if (y) window.scrollTo(0, y);
        });
      }
    }, 75);
  }

  const warte = setInterval(() => {
    const app = document.getElementById("app");
    if (original("heute") && app && !app.classList.contains("versteckt")) {
      clearInterval(warte);
      einbauen();
    }
  }, 50);
})();
