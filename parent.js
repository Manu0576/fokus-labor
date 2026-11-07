/* Fokus-Labor: Elternbereich */
window.startParent = function (sb, me) {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DAY = 86400000;
  const iso = d => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x.toISOString().slice(0, 10); };
  const today = () => iso(Date.now());
  const addDays = (s, n) => iso(new Date(s + "T12:00:00").getTime() + n * DAY);
  const fmt = s => new Date(s + "T12:00:00").toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "numeric" });
  const isWE = d => { const w = new Date(d + "T12:00:00").getDay(); return w === 0 || w === 6; };
  let S = null, kidName = "deine Tochter", pending = [];
  const TYPEL = { sa: "Schularbeit", test: "Test", wh: "Wiederholung" };
  const GOAL = 20;

  function toast(m) { const el = $("toast"); el.textContent = m; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2400); }

  /* Tabs */
  function go(name) {
    document.querySelectorAll("#pTabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name));
    document.querySelectorAll("#parentApp main > section").forEach(s => s.hidden = s.id !== "p-" + name);
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("#pTabs button").forEach(b => b.onclick = () => go(b.dataset.tab));

  /* Daten laden */
  async function load() {
    const [{ data: st }, { data: prof }, { data: inbox }] = await Promise.all([
      sb.from("kid_state").select("state,updated_at").eq("family_id", me.family_id).single(),
      sb.from("profiles").select("role,display_name").eq("family_id", me.family_id),
      sb.from("inbox").select("*").eq("family_id", me.family_id).order("created_at"),
    ]);
    S = (st && st.state) || {};
    S.__updated = st && st.updated_at;
    const kid = (prof || []).find(p => p.role === "child");
    if (kid && kid.display_name) kidName = kid.display_name;
    pending = inbox || [];
    document.querySelectorAll(".kidName").forEach(el => el.textContent = kidName);
    renderAll();
  }

  /* Überblick */
  function active(d) { return (S.days || []).includes(d) || (S.frozen || []).includes(d); }
  function streak() {
    let n = 0, d = today(); if (!active(d)) d = addDays(d, -1);
    for (let i = 0; i < 800; i++) { if (active(d)) { n++; d = addDays(d, -1); continue; } if (isWE(d)) { d = addDays(d, -1); continue; } break; }
    return n;
  }
  function levelOf(i) { const w = J[Math.min(i, J.length - 1)][0]; return LEVELS.findIndex(l => w >= l.from && w <= l.to); }
  function renderOverview() {
    const t = today();
    const cards = S.cards || [];
    const due = cards.filter(c => c.due <= t).length;
    const top = cards.filter(c => c.box >= 5).length;
    const stars = Object.values(S.awarded || {}).reduce((a, b) => a + b, 0);
    const done = (S.jr && S.jr.done) || 0;
    const L = LEVELS[levelOf(Math.min(done, J.length - 1))];
    const days = (S.days || []).slice().sort();
    const last = days[days.length - 1];
    const weekSpr = Object.entries(S.sprints || {}).filter(([d]) => d > addDays(t, -7)).reduce((a, [, n]) => a + n, 0);
    const xpToday = (S.xpDay || {})[t] || 0;
    const chk = (S.checks || {})[t] || {};
    const chkNames = { sleep: "Gut geschlafen", phone: "Handy weg", move: "Bewegt", water: "Gegessen/getrunken" };
    $("ovStats").innerHTML = [
      ["🔥 " + streak(), "Tage in Folge"], ["⭐ " + stars, "Sterne"], [String(S.xp || 0), "XP gesamt"],
      [done + " / " + J.length, "Nuggets"], [String(weekSpr), "Sprints, 7 Tage"], [String(due), "Karten fällig"],
    ].map(([b, s]) => `<div class="stat"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("");
    $("ovLevel").innerHTML = `<b>Stufe ${levelOf(Math.min(done, J.length - 1)) + 1}: ${esc(done >= J.length ? "Weltmeisterin" : L.n)}</b> · ${esc(L.th)}<br><span class="why">Zuletzt aktiv: ${last ? fmt(last) : "noch nie"} · heute ${Math.min(xpToday, GOAL)} von ${GOAL} XP Tagesziel · ${cards.length} Karten, ${top} davon im Langzeit-Speicher</span>`;
    const ck = Object.keys(chkNames).map(k => `<span class="chip ${chk[k] ? "mint" : ""}">${chk[k] ? "✓" : "–"} ${chkNames[k]}</span>`).join(" ");
    $("ovCheck").innerHTML = ck;
    const ex = (S.exams || []).filter(e => e.d >= t);
    $("ovExams").innerHTML = ex.length ? ex.map(e => {
      const d = e.steps.filter(s => s.done).length;
      const late = e.steps.filter(s => !s.done && s.date < t).length;
      return `<div class="li"><div class="txt"><b>${esc(e.n)}</b> · ${fmt(e.d)}<small>${d} von ${e.steps.length} Lernschritten erledigt${late ? " · " + late + " offen aus den letzten Tagen" : ""}${e.tp ? " · " + esc(e.tp) : ""}</small></div></div>`;
    }).join("") : `<p class="why">Keine Termine eingetragen.</p>`;
    $("ovUpdated").textContent = S.__updated ? "Stand: " + new Date(S.__updated).toLocaleString("de-AT", { dateStyle: "short", timeStyle: "short" }) : "";
  }

  /* Karten senden */
  let mode = "ai", n = 5, photos = [], proposals = [];
  const subj = () => $("pSubj").value.trim() || "Allgemein";
  document.querySelectorAll("#pMode button").forEach(b => b.onclick = () => {
    mode = b.dataset.m; document.querySelectorAll("#pMode button").forEach(x => x.setAttribute("aria-pressed", x === b));
    const panel = mode === "ex" ? "ai" : mode;
    ["ai", "list", "one"].forEach(m => $("p-mk-" + m).hidden = m !== panel);
    const ex = mode === "ex";
    $("pExExtra").hidden = !ex;
    $("pAiIntro").textContent = ex ? "Beschreib, welche Übungen du brauchst. Ein Foto der Merkseite oder Text hilft, damit die Übungen zum Unterricht passen (optional)." : "Foto der Heftseite oder Text einfügen. Die KI schlägt Fragen vor, du prüfst und schickst sie.";
    $("pAiTextLbl").textContent = ex ? "Text aus Heft oder Buch (optional)" : "Text aus Heft oder Buch";
    $("pAiGo").textContent = ex ? "Übungen erstellen" : "Fragen vorschlagen";
  });
  let level = "mittel";
  document.querySelectorAll("#pLevel button").forEach(b => b.onclick = () => { level = b.dataset.l; document.querySelectorAll("#pLevel button").forEach(x => x.setAttribute("aria-pressed", x === b)); });
  document.querySelectorAll("#pN button").forEach(b => b.onclick = () => { n = +b.dataset.n; document.querySelectorAll("#pN button").forEach(x => x.setAttribute("aria-pressed", x === b)); });
  async function sendCards(list) {
    if (!list.length) return;
    const rows = list.map(c => ({ family_id: me.family_id, kind: "card", payload: { s: subj(), q: c.q, a: c.a } }));
    const { error } = await sb.from("inbox").insert(rows);
    if (error) { toast("Senden hat nicht geklappt. Internet prüfen."); return false; }
    toast(list.length + " Karten an " + kidName + " geschickt");
    await load(); return true;
  }
  async function resize(file, idx) {
    const max = 1400;
    const draw = (src, w, h) => {
      const k = Math.min(1, max / Math.max(w, h));
      const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
      const d = c.toDataURL("image/jpeg", 0.8).split(",")[1];
      if (!d || d.length < 100) throw new Error("leer");
      return { type: "image/jpeg", data: d };
    };
    try {
      if (window.createImageBitmap) { const bmp = await createImageBitmap(file); const r = draw(bmp, bmp.width, bmp.height); bmp.close && bmp.close(); return r; }
    } catch (e) { /* weiter mit dem zweiten Weg */ }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("x")); i.src = url; });
      return draw(img, img.naturalWidth, img.naturalHeight);
    } catch (e) {
      throw new Error("Foto " + (idx + 1) + " konnte nicht gelesen werden. Bitte ein anderes Foto oder einen Screenshot davon probieren.");
    } finally { URL.revokeObjectURL(url); }
  }
  $("pPhoto").onchange = e => { photos = [...e.target.files].slice(0, 3); $("pPhotoName").innerHTML = photos.length ? photos.length + " Foto" + (photos.length > 1 ? "s" : "") + ` gewählt · <button type="button" id="pPhotoClear" style="font:inherit;border:0;background:none;color:var(--pink);text-decoration:underline;cursor:pointer;padding:0">entfernen</button>` : "Kein Foto";
    const cl = document.getElementById("pPhotoClear"); if (cl) cl.onclick = () => { photos = []; $("pPhoto").value = ""; $("pPhotoName").textContent = "Kein Foto"; }; };
  $("pAiGo").onclick = async () => {
    const text = $("pAiText").value.trim(), ex = mode === "ex", task = $("pTask").value.trim();
    if (ex && !task) { $("pAiStatus").textContent = "Bitte zuerst den Auftrag eintragen."; return; }
    if (!ex && !text && !photos.length) { $("pAiStatus").textContent = "Erst Text einfügen oder ein Foto wählen."; return; }
    $("pAiGo").disabled = true; $("pAiStatus").textContent = "Denke nach … (kann bis zu einer Minute dauern)"; $("pAiOut").innerHTML = ""; $("pAiTake").hidden = true;
    try {
      $("pAiStatus").textContent = photos.length ? "Bereite Fotos vor …" : "Denke nach … (kann bis zu einer Minute dauern)";
      const images = [];
      for (let i = 0; i < photos.length; i++) images.push(await resize(photos[i], i));
      $("pAiStatus").textContent = "Denke nach … (kann bis zu einer Minute dauern)";
      const t0 = Date.now();
      const { data, error } = await sb.functions.invoke("suggest-cards", { body: { text, images, n, subject: subj(), mode: ex ? "exercise" : "cards", task, level } });
      if (error) {
        const secs = Math.round((Date.now() - t0) / 1000);
        const ctx = error.context;
        if (ctx && typeof ctx.status === "number") {
          let detail = ""; try { const raw = await ctx.text(); try { const j = JSON.parse(raw); detail = j.error || j.message || j.msg || raw; } catch (x) { detail = raw; } } catch (x) {}
          throw new Error("Fehler " + ctx.status + " nach " + secs + " s" + (detail ? ": " + String(detail).slice(0, 160) : "") + ". Bitte Screenshot an Claude.");
        }
        throw new Error("Keine Antwort vom Server nach " + secs + " s (" + (error.message || error.name || "unbekannt") + "). Bitte Screenshot an Claude.");
      }
      proposals = (data && data.cards) || [];
      if (!proposals.length) { $("pAiStatus").textContent = "Keine brauchbaren Fragen gefunden. Mehr Text oder ein schärferes Foto probieren."; return; }
      $("pAiStatus").textContent = "Häkchen weg bei allem, was nicht passt. Texte kannst du ändern.";
      $("pAiOut").innerHTML = proposals.map((x, i) => `<div class="li"><input type="checkbox" id="ppr-${i}" checked style="width:24px;height:24px;accent-color:var(--mint);flex:none;margin-top:10px" aria-label="Karte ${i + 1}"><div class="txt" style="display:flex;flex-direction:column;gap:6px"><input type="text" id="pprq-${i}" value="${esc(x.q)}" aria-label="Frage"><input type="text" id="ppra-${i}" value="${esc(x.a)}" aria-label="Antwort" style="color:var(--mint);font-weight:700"></div></div>`).join("");
      $("pAiTake").hidden = false;
    } catch (e) { $("pAiStatus").textContent = e.message || "Das hat nicht geklappt."; }
    finally { $("pAiGo").disabled = false; }
  };
  $("pAiTake").onclick = async () => {
    const l = proposals.map((_, i) => ({ on: $("ppr-" + i).checked, q: $("pprq-" + i).value.trim(), a: $("ppra-" + i).value.trim() })).filter(x => x.on && x.q && x.a);
    if (await sendCards(l)) { $("pAiOut").innerHTML = ""; $("pAiTake").hidden = true; $("pAiText").value = ""; photos = []; $("pPhoto").value = ""; $("pPhotoName").textContent = "Kein Foto"; $("pAiStatus").textContent = ""; }
  };
  function parseList(txt) { return txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const m = l.split(/\s*(?:=|\t|;|\s[–—-]\s)\s*/); if (m.length < 2) return null; const q = m[0].trim(), a = m.slice(1).join(" ").trim(); return q && a ? { q, a } : null; }).filter(Boolean); }
  $("pListIn").oninput = () => { const k = parseList($("pListIn").value).length * ($("pListRev").checked ? 2 : 1); $("pListInfo").textContent = k + " Karten erkannt"; };
  $("pListRev").onchange = () => $("pListIn").oninput();
  $("pListGo").onclick = async () => { let l = parseList($("pListIn").value); if ($("pListRev").checked) l = l.concat(l.map(x => ({ q: x.a, a: x.q }))); if (await sendCards(l)) { $("pListIn").value = ""; $("pListIn").oninput(); } };
  $("pOneGo").onclick = async () => { const q = $("pQ").value.trim(), a = $("pA").value.trim(); if (!q || !a) { toast("Frage und Antwort ausfüllen"); return; } if (await sendCards([{ q, a }])) { $("pQ").value = ""; $("pA").value = ""; } };

  function renderCards() {
    const pc = pending.filter(p => p.kind === "card");
    $("pPending").innerHTML = pc.length ? `<p class="why" style="margin:0">${pc.length} Karten warten darauf, dass ${esc(kidName)} die App öffnet.</p>` : "";
    const by = {}; (S.cards || []).forEach(c => { (by[c.s] = by[c.s] || []).push(c); });
    $("pCardList").innerHTML = Object.keys(by).sort().map(s => `<details class="nug"><summary><span class="tt">${esc(s)}<small>${by[s].length} Karten · ${by[s].filter(c => c.box >= 5).length} im Langzeit-Speicher</small></span></summary><div class="body">${by[s].map(c => `<div class="li"><div class="txt"><b>${esc(c.q)}</b><small>${esc(c.a)} · Stufe ${c.box}</small></div></div>`).join("")}</div></details>`).join("") || `<p class="why">Noch keine Karten.</p>`;
  }

  /* Termine senden */
  let etype = "sa";
  document.querySelectorAll("#pEType button").forEach(b => b.onclick = () => { etype = b.dataset.t; document.querySelectorAll("#pEType button").forEach(x => x.setAttribute("aria-pressed", x === b)); $("pEDate").value = addDays(today(), { sa: 7, test: 4, wh: 2 }[etype]); });
  $("pEDate").value = addDays(today(), 7);
  $("pAddExam").onclick = async () => {
    const s = $("pESubj").value.trim(), d = $("pEDate").value, tp = $("pETopic").value.trim();
    if (!s || !d) { toast("Fach und Datum eintragen"); return; }
    if (d <= today()) { toast("Das Datum ist heute oder vorbei"); return; }
    const { error } = await sb.from("inbox").insert({ family_id: me.family_id, kind: "exam", payload: { type: etype, subj: s, d, tp } });
    if (error) { toast("Senden hat nicht geklappt."); return; }
    $("pESubj").value = ""; $("pETopic").value = ""; toast(TYPEL[etype] + " an " + kidName + " geschickt. Der Lernplan entsteht bei ihr."); load();
  };
  function renderExams() {
    const pe = pending.filter(p => p.kind === "exam");
    $("pExamList").innerHTML = pe.map(p => `<div class="li"><div class="txt"><b>${esc(TYPEL[p.payload.type] || "")} ${esc(p.payload.subj)}</b> · ${fmt(p.payload.d)}<small>wartet auf Abholung</small></div></div>`).join("") +
      ((S.exams || []).filter(e => e.d >= today()).map(e => `<div class="li"><div class="txt"><b>${esc(e.n)}</b> · ${fmt(e.d)}<small>${e.steps.filter(s => s.done).length} von ${e.steps.length} Schritten erledigt</small></div></div>`).join("")) || `<p class="why">Keine Termine.</p>`;
  }

  /* Nuggets ansehen */
  function renderNuggets() {
    const done = (S.jr && S.jr.done) || 0;
    $("pNugList").innerHTML = LEVELS.map((l, k) => `<details class="nug"><summary><span class="tt">Stufe ${k + 1}: ${esc(l.n)}<small>${esc(l.th)} · Wochen ${l.from}–${l.to}</small></span></summary><div class="body">` +
      J.map((n, i) => i).filter(i => J[i][0] >= l.from && J[i][0] <= l.to).map(i => `<div class="li"><div class="txt"><b>#${i + 1} ${esc(J[i][1])}</b> ${i < done ? "✓" : ""}<small>Woche ${J[i][0]} · ${esc(J[i][2])}</small><small><i>Übung:</i> ${esc(J[i][3])}</small><small><i>Karte:</i> ${esc(J[i][4])} = ${esc(J[i][5])}</small></div></div>`).join("") + `</div></details>`).join("");
  }

  /* Erinnerungen */
  const WD = [["1", "Mo"], ["2", "Di"], ["3", "Mi"], ["4", "Do"], ["5", "Fr"], ["6", "Sa"], ["7", "So"]];
  let SET = { goal: { spr: 1, cards: 25 }, rem: { days: {} } };
  async function loadSettings() {
    const { data } = await sb.from("family_settings").select("data").eq("family_id", me.family_id).maybeSingle();
    if (data && data.data) SET = { goal: { spr: 1, cards: 25, ...(data.data.goal || {}) }, rem: { days: {}, ...(data.data.rem || {}) } };
    $("gSpr").value = SET.goal.spr; $("gCards").value = SET.goal.cards;
    $("remTable").innerHTML = `<tr><th>Tag</th><th>An</th><th>Nachmittag</th><th>Abend (nur wenn noch offen)</th></tr>` +
      WD.map(([k, l]) => { const d = SET.rem.days[k] || {}; const def = +k <= 5;
        const on = d.on !== undefined ? d.on : false;
        return `<tr><td><b>${l}</b></td><td><input type="checkbox" id="ron-${k}" ${on ? "checked" : ""} aria-label="${l} an"></td>
        <td><input type="time" id="ra-${k}" value="${esc(d.a !== undefined ? d.a : (def ? "15:30" : "10:30"))}" aria-label="${l} Nachmittag"></td>
        <td><input type="time" id="re-${k}" value="${esc(d.e !== undefined ? d.e : (def ? "19:00" : "18:00"))}" aria-label="${l} Abend"></td></tr>`; }).join("");
    const { count } = await sb.from("push_subs").select("id", { count: "exact", head: true }).eq("family_id", me.family_id);
    $("remDev").innerHTML = count ? `<b>✓ Erinnerungen sind auf ${count} Gerät${count > 1 ? "en" : ""} eingeschaltet.</b>` : `<b>Noch auf keinem Gerät eingeschaltet.</b>`;
    $("remTest").disabled = !count;
  }
  $("remSave").onclick = async () => {
    const days = {}; WD.forEach(([k]) => { days[k] = { on: $("ron-" + k).checked, a: $("ra-" + k).value, e: $("re-" + k).value }; });
    const data = { goal: { spr: Math.max(1, +$("gSpr").value || 1), cards: Math.max(5, +$("gCards").value || 25) }, rem: { days } };
    const { error } = await sb.from("family_settings").upsert({ family_id: me.family_id, data, updated_at: new Date().toISOString() });
    $("remSaved").textContent = error ? "Speichern hat nicht geklappt. Internet prüfen." : "Gespeichert ✓";
    setTimeout(() => $("remSaved").textContent = "", 3000);
  };
  $("remTest").onclick = async () => {
    $("remTestMsg").textContent = "Schicke …";
    const { data, error } = await sb.functions.invoke("send-reminders", { body: { test: true } });
    $("remTestMsg").textContent = error ? "Das hat nicht geklappt. Ist die Funktion send-reminders eingerichtet?" : (data && data.sent ? "Test-Erinnerung verschickt. Sie sollte gleich am iPhone erscheinen." : "Kein Gerät erreicht. Bitte am iPhone Erinnerungen neu einschalten.");
  };

  function renderAll() { renderOverview(); renderCards(); renderExams(); renderNuggets(); }
  $("pRefresh").onclick = load;
  loadSettings();
  if (window.initParentTexts) sb.from("profiles").select("role,display_name").eq("family_id", me.family_id).then(({ data }) => { const k = (data || []).find(x => x.role === "child"); window.initParentTexts(sb, me, (k && k.display_name) || "deine Tochter"); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load(); });
  load();
};
