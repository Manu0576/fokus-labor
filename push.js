/* Fokus-Labor: Erinnerungen (Push-Mitteilungen) auf diesem Gerät ein- und ausschalten */
window.initPush = async function (sb, me) {
  const $ = id => document.getElementById(id);
  const card = $("remCard"); if (!card) return;
  const C = window.FOKUS_CONFIG || {};
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && C.vapidPublic;
  card.hidden = false;
  const txt = $("remTxt"), on = $("remOn"), off = $("remOff");
  const say = m => { txt.textContent = m; };

  if (!C.vapidPublic) { card.hidden = true; return; }
  if (isIOS && !standalone) { on.hidden = true; off.hidden = true; say("Erinnerungen gehen nur, wenn du das Fokus-Labor über das Symbol am Home-Bildschirm öffnest."); return; }
  if (!supported) { on.hidden = true; off.hidden = true; say("Dieses Gerät oder dieser Browser kann keine Erinnerungen anzeigen. Das ist okay: Am iPhone geht es."); return; }

  function b64ToU8(b) { const p = "=".repeat((4 - b.length % 4) % 4); const r = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); }
  const reg = await navigator.serviceWorker.ready;

  async function state() {
    const sub = await reg.pushManager.getSubscription();
    if (Notification.permission === "denied") { on.hidden = true; off.hidden = true; say("Mitteilungen sind für das Fokus-Labor ausgeschaltet. Einschalten: Einstellungen → Mitteilungen → Fokus-Labor."); return; }
    if (sub) { on.hidden = true; off.hidden = false; say("Erinnerungen sind auf diesem Gerät an 🔔 Am Abend kommt nur eine, wenn du an dem Tag noch nichts gemacht hast."); }
    else { on.hidden = false; off.hidden = true; say("Dein Handy erinnert dich an die Lernzeit. Am Abend nur, wenn du an dem Tag noch nichts gemacht hast."); }
  }
  on.onclick = async () => {
    on.disabled = true;
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { await state(); return; }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(C.vapidPublic) });
      const j = sub.toJSON();
      await sb.from("push_subs").delete().eq("endpoint", j.endpoint);
      const { error } = await sb.from("push_subs").insert({ family_id: me.family_id, endpoint: j.endpoint, sub: j, ua: navigator.userAgent.slice(0, 200) });
      if (error) throw error;
    } catch (e) { say("Das Einschalten hat nicht geklappt. Bitte Internet prüfen und nochmal probieren."); on.disabled = false; return; }
    on.disabled = false; await state();
  };
  off.onclick = async () => {
    const sub = await reg.pushManager.getSubscription();
    if (sub) { try { await sb.from("push_subs").delete().eq("endpoint", sub.endpoint); } catch (e) {} await sub.unsubscribe(); }
    await state();
  };
  await state();
};
