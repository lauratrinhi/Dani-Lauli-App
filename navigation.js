(() => {
  const BEREICHE = [
    { id: "home", name: "Home", reiter: [["heute", "Home"]] },
    { id: "dates", name: "Dates", reiter: [["liste", "Liste"], ["abc", "ABC"], ["wuensche", "Wünsche"]] },
    { id: "activity", name: "Activity", reiter: [["watchlist", "Watchlist"], ["orte", "Orte"], ["kochbuch", "Kochbuch"]] },
    { id: "recap", name: "Recap", reiter: [["essen", "Essen"], ["gefuehl", "Gefühl"], ["rueckblick", "Rückblick"]] }
  ];

  const stil = document.createElement("style");
  stil.textContent = `
    body { padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
    #app > div[style*="position:sticky"], #app > div[style*="position: sticky"] { display:none !important; }
    #untenLeiste { position:fixed; left:0; right:0; bottom:0; z-index:40; display:flex; background:#fff;
      border-top:1px solid #e5e7eb; padding:6px 0 calc(6px + env(safe-area-inset-bottom)); }
    #untenLeiste button { flex:1; background:none; color:#9ca3af; border:none; margin:0; padding:10px 0 6px;
      font-size:15px; font-weight:600; position:relative; border-radius:0; }
    #untenLeiste button.aktiv { color:#1f3a68; }
    #untenLeiste button.aktiv::after { content:""; position:absolute; left:30%; right:30%; bottom:0; height:3px; border-radius:2px; background:#1f3a68; }
    #unterLeiste { display:flex; gap:6px; position:sticky; top:0; z-index:30; background:#f4f6fb; padding:8px 0; margin-bottom:8px; }
    #unterLeiste button { flex:1; margin:0; padding:8px 4px; font-size:14px; border-radius:20px; background:#f3f3f3; color:#333; position:relative; }
    #unterLeiste button.aktiv { background:#1f3a68; color:#fff; }
    .nav-punkt { position:absolute; top:4px; right:calc(50% - 34px); width:9px; height:9px; border-radius:50%; background:#e53935; }
    #unterLeiste .nav-punkt { right:8px; top:4px; }
    @media (prefers-color-scheme: dark) {
      #untenLeiste { background:#1f2937 !important; border-top-color:#374151; }
      #untenLeiste button.aktiv { color:#93c5fd; }
      #untenLeiste button.aktiv::after { background:#93c5fd; }
      #unterLeiste { background:#111827 !important; }
      #unterLeiste button { background:#374151 !important; color:#e5e7eb !important; }
      #unterLeiste button.aktiv { background:#1f3a68 !important; color:#fff !important; }
    }`;
  document.head.appendChild(stil);

  const original = id => document.querySelector(`[data-tab="${id}"]`);
  const letzterReiter = {};
  let aktiverBereich = "home";

  function bereichVon(reiterId) {
    return BEREICHE.find(b => b.reiter.some(([id]) => id === reiterId));
  }

  function unterLeisteZeichnen(bereich, aktiverReiter) {
    const leiste = document.getElementById("unterLeiste");
    const vorhanden = bereich.reiter.filter(([id]) => original(id));
    if (vorhanden.length < 2) { leiste.style.display = "none"; return; }
    leiste.style.display = "flex";
    leiste.innerHTML = vorhanden.map(([id, name]) =>
      `<button data-unter="${id}" class="${id === aktiverReiter ? "aktiv" : ""}">${name}</button>`).join("");
  }

  function oeffnen(reiterId) {
    const knopf = original(reiterId);
    if (!knopf) return;
    const bereich = bereichVon(reiterId);
    aktiverBereich = bereich.id;
    letzterReiter[bereich.id] = reiterId;
    knopf.click();
    document.querySelectorAll("#untenLeiste button").forEach(b => b.classList.toggle("aktiv", b.dataset.bereich === bereich.id));
    unterLeisteZeichnen(bereich, reiterId);
    punkteSpiegeln();
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

    const unten = document.createElement("nav");
    unten.id = "untenLeiste";
    unten.innerHTML = BEREICHE.map(b =>
      `<button data-bereich="${b.id}" class="${b.id === "home" ? "aktiv" : ""}">${b.name}</button>`).join("");
    document.body.appendChild(unten);
    unten.addEventListener("click", e => {
      const b = e.target.closest("[data-bereich]");
      if (!b) return;
      const bereich = BEREICHE.find(x => x.id === b.dataset.bereich);
      const ziel = letzterReiter[bereich.id] && original(letzterReiter[bereich.id])
        ? letzterReiter[bereich.id]
        : (bereich.reiter.find(([id]) => original(id)) || [])[0];
      if (ziel) oeffnen(ziel);
      else alert("Dieser Bereich ist noch nicht eingerichtet.");
    });

    setInterval(punkteSpiegeln, 2000);
  }

  const warte = setInterval(() => {
    const app = document.getElementById("app");
    if (original("heute") && app && !app.classList.contains("versteckt")) {
      clearInterval(warte);
      einbauen();
    }
  }, 100);
})();
