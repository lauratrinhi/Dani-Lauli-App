(() => {
  const namen = {};
  let ansicht = "laeuft";
  let neueArt = "serie";
  let eintraege = [];
  let bewertungen = [];

  const PLATTFORMEN = ["Netflix", "Prime Video", "Disney+", "Apple TV+", "WOW", "Joyn", "RTL+", "YouTube", "Kino"];
  const el = html => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  const esc = t => schuetzen(String(t ?? ""));
  const leer = t => `<div class="meta" style="text-align:center">${t}</div>`;
  const AN = "flex:1";
  const AUS = "flex:1;background:#f3f3f3;color:#333";
  const KLEIN = "width:auto;background:#f3f3f3;color:#333";

  const HTML = `
    <div>
      <div class="post">
        <details id="wlFormular">
          <summary style="font-weight:600">➕ Film oder Serie eintragen</summary>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button id="wlArtFilm" onclick="wlArt('film')" style="${AUS}">🎬 Film</button>
            <button id="wlArtSerie" onclick="wlArt('serie')" style="${AN}">📺 Serie</button>
          </div>
          <input id="wlTitel" placeholder="Titel">
          <input id="wlPlattform" list="wlPlattformen" placeholder="Wo? z. B. Netflix (optional)">
          <datalist id="wlPlattformen">${PLATTFORMEN.map(p => `<option value="${p}">`).join("")}</datalist>
          <button onclick="wlSpeichern()">Auf die Liste</button>
        </details>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <button id="wlF-laeuft" onclick="wlAnsicht('laeuft')" style="${AN};padding:8px 4px;font-size:14px"></button>
        <button id="wlF-geplant" onclick="wlAnsicht('geplant')" style="${AUS};padding:8px 4px;font-size:14px"></button>
        <button id="wlF-gesehen" onclick="wlAnsicht('gesehen')" style="${AUS};padding:8px 4px;font-size:14px"></button>
      </div>
      <div id="wlListe"></div>
    </div>`;

  // ---------- Bewertungs-Fenster ----------
  function bewerten(titel, untertitel) {
    return new Promise(fertig => {
      let sterne = 0;
      const fenster = el(`
        <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:80;display:flex;align-items:center;justify-content:center;padding:16px">
          <div class="post" style="width:100%;max-width:420px;margin:0">
            <div style="font-weight:700;font-size:18px">${esc(titel)}</div>
            <div class="meta">${esc(untertitel)} – wie fandest du's?</div>
            <div class="wl-sterne" style="display:flex;justify-content:center;gap:4px;margin:12px 0"></div>
            <textarea rows="2" placeholder="Kurzer Kommentar (optional)"></textarea>
            <div style="display:flex;gap:6px">
              <button class="wl-skip" style="${AUS}">Überspringen</button>
              <button class="wl-ok" style="${AN}">Speichern</button>
            </div>
          </div>
        </div>`);
      const reihe = fenster.querySelector(".wl-sterne");
      const zeichnen = () => {
        reihe.innerHTML = [1, 2, 3, 4, 5].map(i =>
          `<button data-s="${i}" style="width:auto;background:none;font-size:34px;padding:2px;opacity:${i <= sterne ? 1 : .25}">⭐</button>`).join("");
      };
      zeichnen();
      reihe.onclick = e => { const s = e.target.closest("[data-s]"); if (s) { sterne = Number(s.dataset.s); zeichnen(); } };
      const zu = wert => { fenster.remove(); fertig(wert); };
      fenster.querySelector(".wl-skip").onclick = () => zu(null);
      fenster.querySelector(".wl-ok").onclick = () => {
        if (!sterne) return alert("Tipp auf die Sterne – oder überspring die Bewertung.");
        zu({ sterne, kommentar: fenster.querySelector("textarea").value.trim() || null });
      };
      document.body.appendChild(fenster);
    });
  }

  // ---------- Anzeige ----------
  const schnitt = werte => (werte.reduce((a, b) => a + b, 0) / werte.length).toFixed(1).replace(".", ",");

  function karte(e) {
    const eigene = bewertungen.filter(b => b.eintrag_id === e.id);
    const proPerson = Object.entries(namen).map(([id, n]) => {
      const w = eigene.filter(b => b.user_id === id).map(b => b.sterne);
      return w.length ? `${esc(n)} ⭐ ${schnitt(w)}` : null;
    }).filter(Boolean).join(" · ");

    let fortschritt = "";
    if (e.art === "serie" && e.status !== "geplant") {
      fortschritt = e.folge
        ? `Staffel ${e.staffel} · Folge ${e.folge} gesehen`
        : `Staffel ${e.staffel} · noch keine Folge`;
      fortschritt = `<div style="font-size:16px;font-weight:600;margin-top:6px" onclick="wlFortschritt(${e.id})">${fortschritt} <span class="meta">✏️</span></div>`;
    }

    let knoepfe = "";
    if (e.status === "geplant") {
      knoepfe = `<button onclick="wlStatus(${e.id}, 'laeuft')" style="${AN}">▶️ Anfangen</button>`;
    } else if (e.status === "laeuft" && e.art === "serie") {
      knoepfe = `
        <button onclick="wlFolgeWeiter(${e.id})" style="${AN}">+1 Folge</button>
        <button onclick="wlStaffelFertig(${e.id})" style="${AUS}">Staffel ✓</button>
        <button onclick="wlFertig(${e.id})" style="${KLEIN}" title="Serie fertig">🏁</button>`;
    } else if (e.status === "laeuft") {
      knoepfe = `<button onclick="wlFertig(${e.id})" style="${AN}">✅ Gesehen</button>`;
    } else {
      knoepfe = `<button onclick="wlStatus(${e.id}, 'laeuft')" style="${AUS}">↩️ Nochmal schauen</button>`;
    }
    if (e.status !== "geplant") knoepfe += `<button onclick="wlNurBewerten(${e.id})" style="${KLEIN}">⭐</button>`;
    knoepfe += `<button onclick="wlLoeschen(${e.id})" style="${KLEIN}">🗑️</button>`;

    const liste = eigene.slice().sort((a, b) => new Date(b.erstellt_um) - new Date(a.erstellt_um)).map(b => {
      const wo = b.staffel ? (b.folge ? `S${b.staffel} · F${b.folge}` : `Staffel ${b.staffel}`) : (e.art === "film" ? "Film" : "Gesamt");
      return `<div class="kommentar">${wo} · <b>${esc(namen[b.user_id] || "?")}</b> ${"⭐".repeat(b.sterne)}${b.kommentar ? " – " + esc(b.kommentar) : ""}</div>`;
    }).join("");

    return `
      <div class="post">
        <div style="font-weight:700;font-size:18px">${e.art === "film" ? "🎬" : "📺"} ${esc(e.titel)}</div>
        <div class="meta">${e.plattform ? esc(e.plattform) + " · " : ""}eingetragen von ${esc(namen[e.user_id] || "?")}${proPerson ? " · " + proPerson : ""}</div>
        ${fortschritt}
        <div style="display:flex;gap:6px;margin-top:8px">${knoepfe}</div>
        ${liste ? `<details><summary class="meta">⭐ Bewertungen (${eigene.length})</summary>${liste}</details>` : ""}
      </div>`;
  }

  async function laden() {
    const [w, b] = await Promise.all([
      db.from("watchlist").select("*").order("erstellt_um", { ascending: false }),
      db.from("bewertungen").select("*")
    ]);
    eintraege = w.data || [];
    bewertungen = b.data || [];
    const zahl = s => eintraege.filter(e => e.status === s).length;
    const titel = { laeuft: "▶️ Gerade", geplant: "📋 Wollen wir", gesehen: "✅ Gesehen" };
    Object.keys(titel).forEach(s => {
      const k = document.getElementById("wlF-" + s);
      k.textContent = `${titel[s]} (${zahl(s)})`;
      k.style.cssText = (s === ansicht ? AN : AUS) + ";padding:8px 4px;font-size:14px";
    });
    const sichtbar = eintraege.filter(e => e.status === ansicht);
    const leerText = { laeuft: "Gerade schaut ihr nichts – fangt was aus „Wollen wir“ an 🍿", geplant: "Noch nichts auf der Liste", gesehen: "Noch nichts fertig geschaut" };
    document.getElementById("wlListe").innerHTML = sichtbar.map(karte).join("") || leer(leerText[ansicht]);
  }

  const finden = id => eintraege.find(e => e.id === id);

  // ---------- Aktionen ----------
  window.wlArt = art => {
    neueArt = art;
    document.getElementById("wlArtFilm").style.cssText = art === "film" ? AN : AUS;
    document.getElementById("wlArtSerie").style.cssText = art === "serie" ? AN : AUS;
  };

  window.wlAnsicht = s => { ansicht = s; laden(); };

  window.wlSpeichern = async () => {
    const titel = document.getElementById("wlTitel").value.trim();
    if (!titel) return alert("Bitte einen Titel eintragen.");
    const { error } = await db.from("watchlist").insert({
      titel, art: neueArt,
      plattform: document.getElementById("wlPlattform").value.trim() || null
    });
    if (error) return alert("Fehler: " + error.message);
    document.getElementById("wlTitel").value = "";
    document.getElementById("wlPlattform").value = "";
    document.getElementById("wlFormular").open = false;
    ansicht = "geplant";
    laden();
  };

  window.wlStatus = async (id, status) => {
    await db.from("watchlist").update({ status }).eq("id", id);
    ansicht = status;
    laden();
  };

  async function bewertungSpeichern(e, staffel, folge, untertitel) {
    const b = await bewerten(e.titel, untertitel);
    if (b) await db.from("bewertungen").insert({ eintrag_id: e.id, staffel, folge, ...b });
  }

  window.wlFolgeWeiter = async id => {
    const e = finden(id);
    const folge = e.folge + 1;
    await db.from("watchlist").update({ folge }).eq("id", id);
    await bewertungSpeichern(e, e.staffel, folge, `Staffel ${e.staffel} · Folge ${folge}`);
    laden();
  };

  window.wlStaffelFertig = async id => {
    const e = finden(id);
    await bewertungSpeichern(e, e.staffel, null, `Staffel ${e.staffel} komplett`);
    await db.from("watchlist").update({ staffel: e.staffel + 1, folge: 0 }).eq("id", id);
    laden();
  };

  window.wlFertig = async id => {
    const e = finden(id);
    await bewertungSpeichern(e, null, null, e.art === "film" ? "Film" : "Die ganze Serie");
    await db.from("watchlist").update({ status: "gesehen" }).eq("id", id);
    laden();
  };

  window.wlNurBewerten = async id => {
    const e = finden(id);
    if (e.art === "film" || e.status === "gesehen") {
      await bewertungSpeichern(e, null, null, e.art === "film" ? "Film" : "Die ganze Serie");
    } else if (e.folge) {
      await bewertungSpeichern(e, e.staffel, e.folge, `Staffel ${e.staffel} · Folge ${e.folge}`);
    } else {
      return alert("Schaut zuerst eine Folge 😉");
    }
    laden();
  };

  window.wlFortschritt = async id => {
    const e = finden(id);
    const antwort = prompt("Bei welcher Staffel und Folge seid ihr? (z. B. 2 5)", `${e.staffel} ${e.folge}`);
    if (!antwort) return;
    const [staffel, folge] = antwort.match(/\d+/g)?.map(Number) || [];
    if (!staffel || folge === undefined) return alert("Bitte zwei Zahlen eingeben, z. B. 2 5");
    await db.from("watchlist").update({ staffel, folge }).eq("id", id);
    laden();
  };

  window.wlLoeschen = async id => {
    if (!confirm("Wirklich von der Liste löschen? Die Bewertungen gehen dabei auch verloren.")) return;
    await db.from("watchlist").delete().eq("id", id);
    laden();
  };

  // ---------- Reiter einbauen ----------
  function aktivieren() {
    document.querySelectorAll("[data-tab]").forEach(b => {
      const aktiv = b.dataset.tab === "watchlist";
      b.style.background = aktiv ? "#1f3a68" : "#f3f3f3";
      b.style.color = aktiv ? "white" : "#333";
    });
    document.querySelectorAll(".ex-bereich").forEach(d => { d.style.display = d.id === "tab-watchlist" ? "" : "none"; });
    window.scrollTo(0, 0);
    laden();
  }

  async function einbauen(nach) {
    const { data } = await db.from("personen").select("user_id, name");
    (data || []).forEach(p => { namen[p.user_id] = p.name; });

    const knopf = el(`<button style="flex:1 0 54px;padding:6px 0;font-size:20px;line-height:1.1;background:#f3f3f3;color:#333">🎬<div style="font-size:11px">Watchlist</div></button>`);
    knopf.dataset.tab = "watchlist";
    knopf.onclick = aktivieren;
    nach.after(knopf);
    nach.parentElement.style.overflowX = "auto";

    const bereich = el(HTML);
    bereich.id = "tab-watchlist";
    bereich.classList.add("ex-bereich");
    bereich.style.display = "none";
    document.getElementById("app").appendChild(bereich);
  }

  let versuche = 0;
  const warte = setInterval(() => {
    versuche++;
    const nach = document.querySelector('[data-tab="kochbuch"]') || (versuche > 20 && document.querySelector('[data-tab="essen"]'));
    if (nach && typeof ich !== "undefined" && ich) {
      clearInterval(warte);
      einbauen(nach);
    }
  }, 300);
})();
