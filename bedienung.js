(() => {
  // ---------- Aussehen: Dunkler Modus + kleine Stil-Helfer ----------
  const stil = document.createElement("style");
  stil.textContent = `
    img, video { touch-action: manipulation; }
    .tab-punkt { position:absolute; top:4px; right:8px; width:9px; height:9px; border-radius:50%; background:#e53935; }
    #vollbild { position:fixed; inset:0; background:rgba(0,0,0,.95); z-index:100; display:none; align-items:center; justify-content:center; }
    #vollbild img { max-width:100%; max-height:100%; object-fit:contain; border-radius:0; }
    .herz-pop { position:absolute; left:50%; top:50%; font-size:90px; transform:translate(-50%,-50%) scale(.3); opacity:0; pointer-events:none; animation:herzPop .8s ease forwards; }
    @keyframes herzPop { 30% { transform:translate(-50%,-50%) scale(1.15); opacity:1; } 70% { transform:translate(-50%,-50%) scale(1); opacity:1; } 100% { transform:translate(-50%,-60%) scale(1); opacity:0; } }
    #ziehenHinweis { position:fixed; top:0; left:0; right:0; text-align:center; padding:10px; font-size:14px; color:#888; z-index:60; transform:translateY(-100%); transition:transform .15s; }
    @media (prefers-color-scheme: dark) {
      :root { color-scheme: dark; }
      body { background:#111827 !important; color:#e5e7eb !important; }
      .post { background:#1f2937 !important; box-shadow:none !important; }
      input, textarea, select { background:#111827 !important; color:#e5e7eb !important; border-color:#374151 !important; }
      [style*="#f3f3f3"], [style*="243, 243, 243"] { background:#374151 !important; color:#e5e7eb !important; }
      [style*="#f4f6fb"], [style*="244, 246, 251"] { background:#111827 !important; }
      [style*="background:#fff;"], [style*="background:#fff\\""], [style*="background: rgb(255, 255, 255)"] { background:#1f2937 !important; }
      .kommentar, .kommentar b { color:#e5e7eb; }
      .meta { color:#9ca3af !important; }
      a { color:#93c5fd; }
      #ziehenHinweis { color:#9ca3af; }
    }`;
  document.head.appendChild(stil);

  // ---------- Vollbild & Doppeltipp-Herz ----------
  const vollbild = document.createElement("div");
  vollbild.id = "vollbild";
  vollbild.innerHTML = "<img>";
  vollbild.onclick = () => { vollbild.style.display = "none"; };
  document.body.appendChild(vollbild);

  let letzterTipp = { bild: null, zeit: 0, timer: null };

  document.addEventListener("click", async ev => {
    const bild = ev.target.closest("img");
    if (!bild || bild.closest("#vollbild, #gifFenster, .kommentar") || bild.hasAttribute("onclick")) return;
    if (!bild.closest("#app")) return;

    const imFeed = bild.closest("#feed") && bild.parentElement.classList.contains("post");
    const jetzt = Date.now();

    if (imFeed && letzterTipp.bild === bild && jetzt - letzterTipp.zeit < 300) {
      clearTimeout(letzterTipp.timer);
      letzterTipp = { bild: null, zeit: 0, timer: null };
      const post = bild.parentElement;
      const feld = post.querySelector('input[id^="k"]');
      if (!feld) return;
      const postId = Number(feld.id.slice(1));
      post.style.position = "relative";
      const herz = document.createElement("div");
      herz.className = "herz-pop";
      herz.textContent = "❤️";
      post.appendChild(herz);
      setTimeout(() => herz.remove(), 900);
      const { error } = await db.from("reaktionen").insert({ post_id: postId, emoji: "❤️" });
      if (!error) ladeFeed();
      return;
    }

    clearTimeout(letzterTipp.timer);
    letzterTipp = {
      bild, zeit: jetzt,
      timer: setTimeout(() => {
        vollbild.querySelector("img").src = bild.src;
        vollbild.style.display = "flex";
      }, imFeed ? 300 : 0)
    };
  });

  // ---------- Nach unten ziehen zum Aktualisieren ----------
  const hinweis = document.createElement("div");
  hinweis.id = "ziehenHinweis";
  document.body.appendChild(hinweis);
  let startY = null, gezogen = 0;

  document.addEventListener("touchstart", e => {
    if (window.scrollY <= 0 && !document.querySelector("#gifFenster[style*='flex'], #vollbild[style*='flex']")) {
      startY = e.touches[0].clientY;
    } else {
      startY = null;
    }
  }, { passive: true });

  document.addEventListener("touchmove", e => {
    if (startY === null) return;
    gezogen = e.touches[0].clientY - startY;
    if (gezogen > 20) {
      hinweis.textContent = gezogen > 90 ? "↻ Loslassen zum Aktualisieren" : "↓ Zum Aktualisieren ziehen";
      hinweis.style.transform = "translateY(0)";
    }
  }, { passive: true });

  document.addEventListener("touchend", () => {
    if (startY !== null && gezogen > 90) {
      hinweis.textContent = "Lädt …";
      location.reload();
      return;
    }
    hinweis.style.transform = "translateY(-100%)";
    startY = null;
    gezogen = 0;
  });

  // ---------- Rote Punkte bei Neuem ----------
  const QUELLEN = {
    heute: [["posts", "user_id"], ["kommentare", "user_id"], ["besuche", "erstellt_von"]],
    liste: [["liste", "von"]],
    abc: [["abc_eintraege", "erstellt_von"], ["abc_medien", "user_id"]],
    wuensche: [["wuensche", "user_id"]],
    essen: [["essen", "user_id"]],
    kochbuch: [["rezepte", "user_id"]],
    gefuehl: [["checkins", "user_id"]]
  };

  const gesehen = () => { try { return JSON.parse(localStorage.getItem("zuletztGesehen") || "{}"); } catch (e) { return {}; } };
  const merken = tab => {
    try {
      const g = gesehen();
      g[tab] = new Date().toISOString();
      localStorage.setItem("zuletztGesehen", JSON.stringify(g));
    } catch (e) {}
    const knopf = document.querySelector(`[data-tab="${tab}"]`);
    knopf?.querySelector(".tab-punkt")?.remove();
  };

  async function punkteAktualisieren() {
    if (typeof ich === "undefined" || !ich) return;
    const g = gesehen();
    for (const [tab, tabellen] of Object.entries(QUELLEN)) {
      const knopf = document.querySelector(`[data-tab="${tab}"]`);
      if (!knopf) continue;
      if (knopf.style.color === "white") { merken(tab); continue; }
      const seit = g[tab] || "1970-01-01T00:00:00Z";
      let neu = false;
      for (const [tabelle, spalte] of tabellen) {
        const { count } = await db.from(tabelle).select("id", { count: "exact", head: true })
          .neq(spalte, ich.id).gt("erstellt_um", seit);
        if (count) { neu = true; break; }
      }
      knopf.style.position = "relative";
      const punkt = knopf.querySelector(".tab-punkt");
      if (neu && !punkt) knopf.insertAdjacentHTML("beforeend", '<span class="tab-punkt"></span>');
      if (!neu && punkt) punkt.remove();
    }
  }

  document.addEventListener("click", ev => {
    const knopf = ev.target.closest("[data-tab]");
    if (knopf) merken(knopf.dataset.tab);
  });

  const warte = setInterval(() => {
    if (document.querySelector('[data-tab="heute"]') && typeof ich !== "undefined" && ich) {
      clearInterval(warte);
      merken("heute");
      setTimeout(punkteAktualisieren, 1500);
      setInterval(punkteAktualisieren, 60000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) punkteAktualisieren(); });
    }
  }, 500);
})();
