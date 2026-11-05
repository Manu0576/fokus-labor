/* Fokus-Labor: Login, Rollen und Sync */
const KEY = "fokuslabor.v1";
const C = window.FOKUS_CONFIG || {};
let sb = null, me = null, lastU = 0, pushTimer = null, pushing = false;

/* ---------- Zusammenführen von zwei Ständen (z. B. iPad und Laptop) ---------- */
function uniq(a) { return [...new Set(a)]; }
function maxMap(a = {}, b = {}) { const m = { ...b }; for (const k in a) m[k] = Math.max(a[k] || 0, b[k] || 0); return m; }
function mergeState(a, b) {
  if (!a || !Object.keys(a).length) return b;
  if (!b || !Object.keys(b).length) return a;
  const m = { ...b, ...a };
  m.xp = Math.max(a.xp || 0, b.xp || 0);
  m.days = uniq([...(a.days || []), ...(b.days || [])]).sort();
  m.frozen = uniq([...(a.frozen || []), ...(b.frozen || [])]);
  m.sprints = maxMap(a.sprints, b.sprints);
  m.xpDay = maxMap(a.xpDay, b.xpDay);
  m.revDay = maxMap(a.revDay, b.revDay);
  m.stats = maxMap(a.stats, b.stats);
  m.awarded = maxMap(a.awarded, b.awarded);
  m.checks = { ...(b.checks || {}) };
  for (const d in (a.checks || {})) { m.checks[d] = { ...(m.checks[d] || {}) }; for (const k in a.checks[d]) m.checks[d][k] = !!(a.checks[d][k] || m.checks[d][k]); }
  m.del = uniq([...(a.del || []), ...(b.del || [])].map(String));
  m.delEx = uniq([...(a.delEx || []), ...(b.delEx || [])].map(String));
  const cards = new Map();
  for (const c of [...(b.cards || []), ...(a.cards || [])]) {
    const k = String(c.id), o = cards.get(k);
    if (!o || (c.u || 0) >= (o.u || 0)) cards.set(k, c);
  }
  m.cards = [...cards.values()].filter(c => !m.del.includes(String(c.id)));
  const ex = new Map();
  for (const e of [...(b.exams || []), ...(a.exams || [])]) {
    const k = String(e.id), o = ex.get(k);
    if (!o) ex.set(k, JSON.parse(JSON.stringify(e)));
    else e.steps.forEach((s, i) => { if (o.steps[i] && s.done) o.steps[i].done = true; });
  }
  m.exams = [...ex.values()].filter(e => !m.delEx.includes(String(e.id))).sort((x, y) => x.d < y.d ? -1 : 1);
  const ja = a.jr || { done: 0 }, jb = b.jr || { done: 0 };
  m.jr = (ja.done >= jb.done ? { ...ja } : { ...jb });
  m.jr.log = { ...(jb.log || {}), ...(ja.log || {}) };
  m.jokers = (a._u || 0) >= (b._u || 0) ? (a.jokers || 0) : (b.jokers || 0);
  m._u = Math.max(a._u || 0, b._u || 0);
  return m;
}
window.mergeState = mergeState;

/* ---------- Oberfläche ---------- */
const $ = id => document.getElementById(id);
function show(view) { ["loginView", "childApp", "parentApp", "setupView"].forEach(v => { const el = $(v); if (el) el.hidden = v !== view; }); }
function setSync(txt) { document.querySelectorAll(".syncState").forEach(el => el.textContent = txt); }

async function pullState() {
  const { data, error } = await sb.from("kid_state").select("state").eq("family_id", me.family_id).single();
  if (error) throw error;
  return data && data.state && Object.keys(data.state).length ? data.state : null;
}

/* ---------- Kind ---------- */
async function startKid() {
  let local = null; try { local = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  let remote = null;
  try { remote = await pullState(); setSync("Gespeichert"); } catch (e) { setSync("Offline, wird später gespeichert"); }
  const init = mergeState(local, remote);
  lastU = remote ? (remote._u || 0) : 0;
  window.__INIT_STATE__ = init || null;
  window.__kidName = me.display_name || "";
  window.__sync = schedulePush;
  show("childApp");
  window.startChild();
  await takeInbox();
  if (!remote) schedulePush();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pullAgain(); });
  window.addEventListener("online", () => { schedulePush(); pullAgain(); });
}
function schedulePush() { clearTimeout(pushTimer); setSync("Speichert …"); pushTimer = setTimeout(push, 1500); }
async function push() {
  if (pushing) { schedulePush(); return; }
  pushing = true;
  try {
    const remote = await pullState();
    let cur = window.childApi.getS();
    if (remote && (remote._u || 0) > lastU && remote._u !== cur._u) {
      const m = mergeState(cur, remote); m._u = Date.now(); window.childApi.setS(m); cur = m;
    }
    const { error } = await sb.from("kid_state").update({ state: cur, updated_at: new Date().toISOString() }).eq("family_id", me.family_id);
    if (error) throw error;
    lastU = cur._u || 0;
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {}
    setSync("Gespeichert");
  } catch (e) { setSync("Offline, wird später gespeichert"); }
  finally { pushing = false; }
}
async function pullAgain() {
  try {
    const remote = await pullState();
    const cur = window.childApi.getS();
    if (remote && (remote._u || 0) > lastU && remote._u !== cur._u) {
      const m = mergeState(cur, remote); window.childApi.setS(m); lastU = remote._u || 0;
    }
    await takeInbox();
    setSync("Gespeichert");
  } catch (e) { setSync("Offline"); }
}
async function takeInbox() {
  try {
    const { data, error } = await sb.from("inbox").select("*").eq("family_id", me.family_id).order("created_at");
    if (error || !data || !data.length) return;
    window.childApi.applyInbox(data);
    await sb.from("inbox").delete().in("id", data.map(d => d.id));
  } catch (e) {}
}

/* ---------- Start ---------- */
const PKEY = "fokuslabor.profile";
async function enter(user) {
  // Benutzer aus der gespeicherten Anmeldung nehmen, ohne Internet-Prüfung beim Start
  if (!user) { const { data: { session } } = await sb.auth.getSession(); user = session && session.user; }
  if (!user) { show("loginView"); return; }
  let cached = null; try { cached = JSON.parse(localStorage.getItem(PKEY)); } catch (e) {}
  if (cached && cached.id !== user.id) cached = null;
  let p = null, err = null;
  for (let i = 0; i < 3 && !p; i++) {
    const r = await sb.from("profiles").select("role,family_id,display_name").eq("id", user.id).maybeSingle();
    p = r.data; err = r.error;
    if (!p && !err) break;                       // Antwort kam, aber kein Profil
    if (!p) await new Promise(res => setTimeout(res, 800));
  }
  if (!p && cached) p = cached;                  // offline oder langsam: letztes bekanntes Profil
  if (!p && err) { show("loginView"); $("loginErr").textContent = "Keine Verbindung. Bitte Internet prüfen und die App neu öffnen."; return; }
  if (!p) { show("loginView"); $("loginErr").textContent = "Dieses Konto ist noch keiner Familie zugeordnet. Siehe Anleitung, Schritt 5."; return; }
  try { localStorage.setItem(PKEY, JSON.stringify({ ...p, id: user.id })); } catch (e) {}
  me = p;
  if (p.role === "child") startKid();
  else { show("parentApp"); window.startParent(sb, me); }
}
async function boot() {
  if (!C.url || !C.key || !window.supabase) { show("setupView"); return; }
  sb = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "fokuslabor.auth", storage: window.localStorage } });
  window.__sb = sb;
  $("loginForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    const btn = $("loginBtn"); btn.disabled = true; $("loginErr").textContent = "";
    const { data, error } = await sb.auth.signInWithPassword({ email: $("loginEmail").value.trim(), password: $("loginPw").value });
    btn.disabled = false;
    if (error) { $("loginErr").textContent = "Das hat nicht geklappt. E-Mail und Passwort prüfen."; return; }
    enter(data.user);
  });
  document.querySelectorAll("[data-logout]").forEach(b => b.onclick = async () => {
    if (me && me.role === "child" && window.childApi) { clearTimeout(pushTimer); await push(); }
    try { localStorage.removeItem(KEY); localStorage.removeItem(PKEY); } catch (e) {}
    await sb.auth.signOut(); location.reload();
  });
  const { data: { session } } = await sb.auth.getSession();
  if (session) enter(session.user); else show("loginView");
}
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
boot();
