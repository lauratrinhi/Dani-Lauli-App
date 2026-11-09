(() => {
  const namen = {};
  let ansicht = "offen";
  let gewaehltesBild = null;
  let zielRezept = null;

  const el = html => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  const esc = t => schuetzen(String(t ?? ""));
  const leer = t => `<div class="meta" style="text-align:center">${t}</div>`;
  const grau = "width:auto;background:#f3f3f3;color:#333";

  const HTML = `
    <div>
      <div class="post">
        <details id="kbFormular">
          <summary style="font-weight:600">➕ Neues Gericht eintragen</summary>
          <input id="kbTitel" placeholder="Was wollen wir kochen?" style="margin-top:8px">
          <textarea id="kbRezept" rows="6" placeholder="Zutaten und Zubereitung …" style="margin-top:6px"></textarea>
          <input id="kbLink" placeholder="Link zum Rezept (optional)" style="margin-top:6px">
          <button onclick="document.getElementById('kbDatei').click()" style="margin-top:6px;background:#f3f3f3;color:#333">📷 Bild hinzufügen (optional)</button>
          <div id="kbBildName" class="meta"></div>
          <button onclick="kbSpeichern()" style="margin-top:6px">Speichern</button>
        </details>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <button id="kbOffen" onclick="kbAnsicht('offen')" style="flex:1">🍳 Wollen wir kochen</button>
        <button id="kbGekocht" onclick="kbAnsicht('gekocht')" style="flex:1;background:#f3f3f3;color:#333">✅ Schon gekocht</button>
      </div>
      <div id="kbListe"></div>
      <input id="kbDatei" type="file" accept="image/*" class="versteckt">
      <input id="kbDateiNachher" type="file" accept="image/*" class="versteckt">
    </div>`;

  function verkleinern(datei) {
    return new Promise((ok, fehler) => {
      const bild = new Image();
      bild.onload = () => {
        const f = Math.min(1, 1200 / Math.max(bild.width, bild.height));
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

  async function bildHochladen(datei) {
    const blob = await verkleinern(datei);
    const pfad = ich.id + "/rezept-" + Date.now() + ".jpg";
    const { error } = await db.storage.from("medien").upload(pfad, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    return pfad;
  }

  async function laden() {
    const { data } = await db.from("rezepte").select("*")
      .eq("gekocht", ansicht === "gekocht").order("erstellt_um", { ascending: false });
    const rezepte = data || [];
    const pfade = rezepte.filter(r => r.bild_pfad).map(r => r.bild_pfad);
    const urls = {};
    if (pfade.length) {
      const { data: links } = await db.storage.from("medien").createSignedUrls(pfade, 3600);
      (links || []).forEach(l => { if (l.signedUrl) urls[l.path] = l.signedUrl; });
    }
    document.getElementById("kbListe").innerHTML = rezepte.map(r => `
      <div class="post">
        ${r.bild_pfad && urls[r.bild_pfad] ? `<img src="${urls[r.bild_pfad]}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px">` : ""}
        <div style="font-weight:700;font-size:18px;margin-top:6px">${esc(r.titel)}</div>
        <div class="meta">von ${esc(namen[r.user_id] || "?")} · ${new Date(r.erstellt_um).toLocaleDateString("de-DE")}</div>
        ${r.rezept ? `<details style="margin-top:6px"><summary class="meta">📖 Rezept anzeigen</summary><div class="kommentar" style="white-space:pre-wrap;margin-top:6px">${esc(r.rezept)}</div></details>` : ""}
        ${r.link && /^https?:\/\//i.test(r.link) ? `<div class="kommentar"><a href="${esc(r.link)}" target="_blank" rel="noopener">🔗 Zum Rezept</a></div>` : ""}
        <div style="display:flex;gap:6px;margin-top:8px">
          <button onclick="kbGekochtUmschalten(${r.id}, ${r.gekocht})" style="flex:1">${r.gekocht ? "↩️ Nochmal kochen" : "✅ Gekocht!"}</button>
          <button onclick="kbBildAendern(${r.id})" style="${grau}">📷</button>
          <button onclick="kbLoeschen(${r.id})" style="${grau}">🗑️</button>
        </div>
      </div>`).join("") || leer(ansicht === "gekocht" ? "Noch nichts gekocht" : "Noch keine Gerichte eingetragen 🍳");
  }

  window.kbAnsicht = art => {
    ansicht = art;
    document.getElementById("kbOffen").style.cssText = art === "offen" ? "flex:1" : "flex:1;background:#f3f3f3;color:#333";
    document.getElementById("kbGekocht").style.cssText = art === "gekocht" ? "flex:1" : "flex:1;background:#f3f3f3;color:#333";
    laden();
  };

  window.kbSpeichern = async () => {
    const titel = document.getElementById("kbTitel").value.trim();
    if (!titel) return alert("Bitte gib dem Gericht einen Namen.");
    try {
      const bild_pfad = gewaehltesBild ? await bildHochladen(gewaehltesBild) : null;
      const { error } = await db.from("rezepte").insert({
        titel,
        rezept: document.getElementById("kbRezept").value.trim() || null,
        link: document.getElementById("kbLink").value.trim() || null,
        bild_pfad
      });
      if (error) throw error;
      ["kbTitel", "kbRezept", "kbLink"].forEach(id => { document.getElementById(id).value = ""; });
      gewaehltesBild = null;
      document.getElementById("kbBildName").textContent = "";
      document.getElementById("kbFormular").open = false;
      kbAnsicht("offen");
    } catch (e) {
      alert("Speichern hat nicht geklappt: " + e.message);
    }
  };

  window.kbGekochtUmschalten = async (id, warGekocht) => {
    await db.from("rezepte").update({ gekocht: !warGekocht }).eq("id", id);
    laden();
  };

  window.kbBildAendern = id => {
    zielRezept = id;
    document.getElementById("kbDateiNachher").click();
  };

  window.kbLoeschen = async id => {
    if (!confirm("Dieses Gericht löschen?")) return;
    await db.from("rezepte").delete().eq("id", id);
    laden();
  };

  function aktivieren() {
    document.querySelectorAll("[data-tab]").forEach(b => {
      const aktiv = b.dataset.tab === "kochbuch";
      b.style.background = aktiv ? "#1f3a68" : "#f3f3f3";
      b.style.color = aktiv ? "white" : "#333";
    });
    document.querySelectorAll(".ex-bereich").forEach(d => { d.style.display = d.id === "tab-kochbuch" ? "" : "none"; });
    window.scrollTo(0, 0);
    laden();
  }

  async function einbauen(nach) {
    const { data } = await db.from("personen").select("user_id, name");
    (data || []).forEach(p => { namen[p.user_id] = p.name; });

    const knopf = el(`<button style="flex:1 0 54px;padding:6px 0;font-size:20px;line-height:1.1;background:#f3f3f3;color:#333">📖<div style="font-size:11px">Kochbuch</div></button>`);
    knopf.dataset.tab = "kochbuch";
    knopf.onclick = aktivieren;
    nach.after(knopf);
    nach.parentElement.style.overflowX = "auto";

    const bereich = el(HTML);
    bereich.id = "tab-kochbuch";
    bereich.classList.add("ex-bereich");
    bereich.style.display = "none";
    document.getElementById("app").appendChild(bereich);

    document.getElementById("kbDatei").onchange = ev => {
      gewaehltesBild = ev.target.files[0] || null;
      document.getElementById("kbBildName").textContent = gewaehltesBild ? "📷 Bild ausgewählt" : "";
    };
    document.getElementById("kbDateiNachher").onchange = async ev => {
      const datei = ev.target.files[0];
      ev.target.value = "";
      if (!datei || !zielRezept) return;
      try {
        const bild_pfad = await bildHochladen(datei);
        await db.from("rezepte").update({ bild_pfad }).eq("id", zielRezept);
        laden();
      } catch (e) {
        alert("Bild konnte nicht hochgeladen werden: " + e.message);
      }
    };
  }

  const warte = setInterval(() => {
    const essen = document.querySelector('[data-tab="essen"]');
    if (essen && typeof ich !== "undefined" && ich) {
      clearInterval(warte);
      einbauen(essen);
    }
  }, 300);
})();
