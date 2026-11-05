/* Fokus-Labor: Texte im Elternbereich kontrollieren lassen und freigeben */
window.initParentTexts = function (sb, me, kidName) {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = m => { const el = $("toast"); el.textContent = m; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2600); };
  let rows = [], cur = null, draft = null;

  async function load() {
    const { data } = await sb.from("texts").select("*").eq("family_id", me.family_id).order("created_at", { ascending: false }).limit(40);
    rows = data || [];
    const open = rows.filter(t => t.status === "eingereicht").length;
    $("ptBadge").textContent = open ? " (" + open + ")" : "";
    $("ptList").innerHTML = rows.map(t => {
      const d = new Date(t.created_at).toLocaleString("de-AT", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
      return `<button class="li ptrow" data-id="${t.id}" style="text-align:left;cursor:pointer;font:inherit;color:inherit;width:100%"><span class="txt"><b>${esc(t.art || t.fach)} · ${d}</b><small>${esc((t.angabe || "").slice(0, 90))} · ${t.words || "?"} Wörter</small></span><span class="chip ${t.status === "freigegeben" ? "mint" : "pink"}">${t.status === "freigegeben" ? "freigegeben" : "neu"}</span></button>`;
    }).join("") || `<p class="why">Noch keine Texte. ${esc(kidName)} kann Texte in der Werkstatt unter „Meine Texte“ oder in der Englisch-Baustelle mit „An Mama schicken“ abgeben.</p>`;
    $("ptList").querySelectorAll(".ptrow").forEach(b => b.onclick = () => openText(b.dataset.id));
  }

  async function openText(id) {
    cur = rows.find(t => t.id === id); if (!cur) return;
    draft = cur.review || null;
    if (!draft) { const { data } = await sb.from("text_drafts").select("draft").eq("text_id", id).maybeSingle(); draft = data ? data.draft : null; }
    $("ptListBox").hidden = true; $("ptDetail").hidden = false;
    $("ptHead").textContent = (cur.art || cur.fach) + " · " + (cur.words || "?") + " Wörter";
    $("ptAng").textContent = cur.angabe || "";
    $("ptText").textContent = cur.text;
    $("ptNote").value = cur.note || "";
    $("ptScores").checked = !!cur.show_scores;
    $("ptStatus").textContent = cur.status === "freigegeben" ? "Bereits freigegeben. Du kannst Änderungen nochmal freigeben." : "";
    renderDraft();
    window.scrollTo(0, 0);
  }
  function renderDraft() {
    const el = $("ptReview");
    if (!draft) { el.innerHTML = `<p class="why">Noch nicht kontrolliert.</p>`; return; }
    const r = draft, LBL = { task: "Aufgabe", organisation: "Aufbau", vocabulary: "Wortschatz", grammar: "Grammatik" };
    const sum = r.scores ? Object.values(r.scores).reduce((a, b) => a + (+b || 0), 0) : null;
    el.innerHTML = `
      <label class="f" for="ptSum">Gesamteindruck<textarea id="ptSum">${esc(r.summary || "")}</textarea></label>
      ${r.scores ? `<div class="fbscores">${Object.keys(LBL).map(k => `<span class="chip">${LBL[k]} ${esc(r.scores[k])}/5</span>`).join("")}<span class="chip mint">gesamt ${sum}/20</span></div>` : ""}
      <h4>Gelungen</h4>${(r.praise || []).map((x, i) => `<label class="check on" for="pp-${i}"><input type="checkbox" id="pp-${i}" checked><span>${esc(x)}</span></label>`).join("")}
      <h4>Fehler (Häkchen weg = wird nicht angezeigt)</h4>${(r.fixes || []).map((f, i) => `<label class="check on" for="pf-${i}"><input type="checkbox" id="pf-${i}" checked><span><span class="fbw">${esc(f.wrong)}</span> → <b>${esc(f.right)}</b><small>${esc(f.why)}</small></span></label>`).join("")}
      ${(r.content || []).length ? `<h4>Inhalt</h4>${r.content.map((x, i) => `<label class="check on" for="pc-${i}"><input type="checkbox" id="pc-${i}" checked><span>${esc(x)}</span></label>`).join("")}` : ""}
      <h4>Tipps</h4>${(r.next || []).map((x, i) => `<label class="check on" for="pn-${i}"><input type="checkbox" id="pn-${i}" checked><span>${esc(x)}</span></label>`).join("")}`;
    el.querySelectorAll(".check input").forEach(c => c.onchange = () => c.closest(".check").classList.toggle("on", c.checked));
  }
  function collect() {
    if (!draft) return null;
    const pick = (arr, p) => (arr || []).filter((_, i) => { const c = $(p + i); return !c || c.checked; });
    return { ...draft, summary: ($("ptSum") || {}).value || draft.summary, praise: pick(draft.praise, "pp-"), fixes: pick(draft.fixes, "pf-"), content: pick(draft.content, "pc-"), next: pick(draft.next, "pn-") };
  }

  $("ptCheck").onclick = async () => {
    if (!cur) return;
    $("ptCheck").disabled = true; $("ptStatus").textContent = "Claude kontrolliert … (bis zu einer Minute)";
    try {
      const { data, error } = await sb.functions.invoke("suggest-cards", { body: { mode: "review", text: cur.text, art: cur.art, angabe: cur.angabe, subject: cur.fach } });
      if (error) { let m = "Das hat nicht geklappt."; try { const j = await error.context.json(); if (j.error) m = j.error; } catch (e) {} throw new Error(m); }
      draft = data.review;
      await sb.from("text_drafts").upsert({ text_id: cur.id, family_id: me.family_id, draft, updated_at: new Date().toISOString() });
      $("ptStatus").textContent = "Fertig. Prüfe die Punkte, nimm Häkchen weg, wenn etwas nicht passt, und gib frei.";
      renderDraft();
    } catch (e) { $("ptStatus").textContent = e.message || "Das hat nicht geklappt."; }
    finally { $("ptCheck").disabled = false; }
  };
  $("ptRelease").onclick = async () => {
    if (!cur) return;
    const review = collect(), note = $("ptNote").value.trim();
    if (!review && !note) { $("ptStatus").textContent = "Erst kontrollieren lassen oder eine Nachricht schreiben."; return; }
    const { error } = await sb.from("texts").update({ review, note, show_scores: $("ptScores").checked, status: "freigegeben", released_at: new Date().toISOString() }).eq("id", cur.id);
    if (error) { $("ptStatus").textContent = "Freigeben hat nicht geklappt."; return; }
    toast("Feedback für " + kidName + " freigegeben ✓"); back(); load();
  };
  $("ptDelete").onclick = () => { $("ptDelConfirm").hidden = false; };
  $("ptDelNo").onclick = () => { $("ptDelConfirm").hidden = true; };
  $("ptDelYes").onclick = async () => { await sb.from("texts").delete().eq("id", cur.id); $("ptDelConfirm").hidden = true; back(); load(); };
  function back() { $("ptDetail").hidden = true; $("ptListBox").hidden = false; cur = null; draft = null; }
  $("ptBack").onclick = back;
  load();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !cur) load(); });
};
