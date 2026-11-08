(() => {
  const ANLAESSE = ["🎄 Weihnachten", "🎂 Geburtstag", "💕 Jahrestag", "✨ Einfach so"];
  const namen = {};

  const el = html => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  const esc = t => schuetzen(String(t ?? ""));
  const leer = t => `<div class="meta">${t}</div>`;
  const anderer = () => Object.keys(namen).find(id => id !== ich.id);
  const andererName = () => esc(namen[anderer()] || "deinen Schatz");
  const linkHtml = l => l && /^https?:\/\//i.test(l) ? ` <a href="${esc(l)}" target="_blank" rel="noopener">🔗 Link</a>` : "";
  const auswahl = id => `<select id="${id}" style="width:100%;padding:10px;font-size:16px;margin:6px 0">${ANLAESSE.map(a => `<option>${a}</option>`).join("")}</select>`;
  const formular = (prefix, platzhalter, knopf) => `
    <input id="${prefix}Text" placeholder="${platzhalter}">
    <input id="${prefix}Link" placeholder="Link (optional)" style="margin-top:6px">
    ${auswahl(prefix + "Anlass")}
    <button onclick="${knopf}">Hinzufügen</button>`;

  const HTML = `
    <div>
      <div class="post">
        <div style="font-weight:600">🎁 Meine Wünsche</div>
        <div class="meta">Sieht ${"{{ANDERER}}"} – aber nicht, was davon schon besorgt ist 🤫</div>
        <div id="wuMeine"></div>
        ${formular("wuMein", "Was wünschst du dir?", "wuNeu()")}
      </div>
      <div class="post">
        <div style="font-weight:600" id="wuAndereTitel">💝 Wünsche</div>
        <div id="wuAndere"></div>
      </div>
      <div class="post">
        <div style="font-weight:600">🤫 Meine geheimen Geschenkideen</div>
        <div class="meta">Nur du siehst diese Liste.</div>
        <div id="wuIdeen"></div>
        ${formular("wuIdee", "Idee für ein Geschenk", "wuIdeeNeu()")}
      </div>
    </div>`;

  const zeile = (inhalt, knoepfe) => `
    <div style="display:flex;align-items:center;gap:8px;margin:8px 0">
      <div style="flex:1" class="kommentar">${inhalt}</div>${knoepfe}
    </div>`;
  const kleinerKnopf = (onclick, text, aktiv) =>
    `<button onclick="${onclick}" style="width:auto;background:${aktiv ? "#1f3a68" : "#f3f3f3"};color:${aktiv ? "white" : "#333"}">${text}</button>`;

  async function laden() {
    const [w, i] = await Promise.all([
      db.from("wuensche").select("*").order("erstellt_um"),
      db.from("geschenkideen").select("*").eq("erledigt", false).order("erstellt_um")
    ]);
    const alle = w.data || [];
    const anlass = x => `<span class="meta">${esc(x.anlass)}</span>`;

    document.getElementById("wuMeine").innerHTML = alle.filter(x => x.user_id === ich.id).map(x =>
      zeile(`${esc(x.text)}${linkHtml(x.link)}<br>${anlass(x)}`, kleinerKnopf(`wuLoeschen(${x.id})`, "🗑️"))
    ).join("") || leer("Noch keine Wünsche eingetragen");

    document.getElementById("wuAndereTitel").textContent = "💝 Wünsche von " + (namen[anderer()] || "deinem Schatz");
    document.getElementById("wuAndere").innerHTML = alle.filter(x => x.user_id !== ich.id).map(x => {
      const vonMir = x.besorgt_von === ich.id;
      const info = vonMir ? ' <span class="meta">· ✅ von dir besorgt</span>' : "";
      return zeile(`${esc(x.text)}${linkHtml(x.link)}<br>${anlass(x)}${info}`,
        kleinerKnopf(`wuBesorgt(${x.id}, ${vonMir})`, vonMir ? "✅" : "🎁", vonMir));
    }).join("") || leer("Noch keine Wünsche eingetragen");

    document.getElementById("wuIdeen").innerHTML = (i.data || []).map(x =>
      zeile(`${esc(x.text)}${linkHtml(x.link)}<br>${anlass(x)}`, kleinerKnopf(`wuIdeeFertig(${x.id})`, "✅"))
    ).join("") || leer("Noch keine Ideen");
  }

  function eingaben(prefix) {
    const text = document.getElementById(prefix + "Text").value.trim();
    const link = document.getElementById(prefix + "Link").value.trim() || null;
    const anlass = document.getElementById(prefix + "Anlass").value;
    return { text, link, anlass };
  }
  function leeren(prefix) {
    document.getElementById(prefix + "Text").value = "";
    document.getElementById(prefix + "Link").value = "";
  }

  window.wuNeu = async () => {
    const daten = eingaben("wuMein");
    if (!daten.text) return;
    const { error } = await db.from("wuensche").insert(daten);
    if (error) return alert("Fehler: " + error.message);
    leeren("wuMein");
    laden();
  };
  window.wuLoeschen = async id => {
    if (!confirm("Diesen Wunsch löschen?")) return;
    await db.from("wuensche").delete().eq("id", id);
    laden();
  };
  window.wuBesorgt = async (id, warVonMir) => {
    await db.from("wuensche").update({ besorgt_von: warVonMir ? null : ich.id }).eq("id", id);
    laden();
  };
  window.wuIdeeNeu = async () => {
    const daten = eingaben("wuIdee");
    if (!daten.text) return;
    const { error } = await db.from("geschenkideen").insert(daten);
    if (error) return alert("Fehler: " + error.message);
    leeren("wuIdee");
    laden();
  };
  window.wuIdeeFertig = async id => {
    await db.from("geschenkideen").update({ erledigt: true }).eq("id", id);
    laden();
  };

  function aktivieren() {
    document.querySelectorAll("[data-tab]").forEach(b => {
      const aktiv = b.dataset.tab === "wuensche";
      b.style.background = aktiv ? "#1f3a68" : "#f3f3f3";
      b.style.color = aktiv ? "white" : "#333";
    });
    document.querySelectorAll(".ex-bereich").forEach(d => { d.style.display = d.id === "tab-wuensche" ? "" : "none"; });
    window.scrollTo(0, 0);
    laden();
  }

  async function einbauen(nav, nachKnopf) {
    const { data } = await db.from("personen").select("user_id, name");
    (data || []).forEach(p => { namen[p.user_id] = p.name; });

    const knopf = el(`<button style="flex:1;padding:6px 0;font-size:20px;line-height:1.1;background:#f3f3f3;color:#333">🎁<div style="font-size:11px">Wünsche</div></button>`);
    knopf.dataset.tab = "wuensche";
    knopf.onclick = aktivieren;
    nachKnopf.after(knopf);

    nav.style.overflowX = "auto";
    [...nav.children].forEach(b => { b.style.flex = "1 0 54px"; });

    const bereich = el(HTML.replace("{{ANDERER}}", andererName()));
    bereich.id = "tab-wuensche";
    bereich.classList.add("ex-bereich");
    bereich.style.display = "none";
    document.getElementById("app").appendChild(bereich);
  }

  let versuche = 0;
  const warte = setInterval(() => {
    versuche++;
    const heute = document.querySelector('[data-tab="heute"]');
    const abc = document.querySelector('[data-tab="abc"]');
    if (heute && typeof ich !== "undefined" && ich && (abc || versuche > 20)) {
      clearInterval(warte);
      einbauen(heute.parentElement, abc || document.querySelector('[data-tab="liste"]') || heute);
    }
  }, 300);
})();
