// Fokus-Labor: Erinnerungen verschicken
// Wird alle 5 Minuten vom Zeitplan (Cron) aufgerufen. Eltern können über den Elternbereich eine Test-Erinnerung schicken.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const TZ = "Europe/Vienna";
const DAYS: Record<string, string> = { Mon: "1", Tue: "2", Wed: "3", Thu: "4", Fri: "5", Sat: "6", Sun: "7" };

function viennaNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const hh = p.hour === "24" ? "00" : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, wd: DAYS[p.weekday], min: Number(hh) * 60 + Number(p.minute) };
}
const toMin = (t?: string) => { if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };

const MSG = {
  a: [
    "Zeit für dein Fokus-Labor, {n}! Ein Sprint oder eine Kartenrunde, dann ist der Tag geschafft.",
    "Hallo {n}! 15 Minuten Fokus, dann hast du frei. Los geht's 🚀",
    "{n}, deine Karten warten auf dich. Kurz und knackig!",
  ],
  e: [
    "{n}, noch ein kleiner Sprint vor dem Abend? Deine Flamme 🔥 freut sich.",
    "Fast geschafft für heute, {n}: 10–15 Minuten Fokus-Labor und du bist fertig.",
    "Noch kurz vor dem Abend, {n}: eine Kartenrunde, dann ist der Tag geschafft ✓",
  ],
};
const pick = (arr: string[], name: string, seed: number) => arr[seed % arr.length].replaceAll("{n}", name || "du");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
  webpush.setVapidDetails("https://manu0576.github.io/fokus-labor/", Deno.env.get("VAPID_PUBLIC_KEY") ?? "", Deno.env.get("VAPID_PRIVATE_KEY") ?? "");

  async function sendTo(familyId: string, payload: Record<string, string>) {
    const { data: kids } = await sb.from("profiles").select("id").eq("family_id", familyId).eq("role", "child");
    const ids = (kids ?? []).map((k) => k.id);
    if (!ids.length) return 0;
    const { data: subs } = await sb.from("push_subs").select("id,sub").in("user_id", ids);
    let n = 0;
    for (const s of subs ?? []) {
      try { await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 3600, urgency: "high" }); n++; }
      catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("id", s.id); // Gerät abgemeldet
        else console.error("push", code, String(e));
      }
    }
    return n;
  }

  // A) Test-Erinnerung aus dem Elternbereich
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return json({ error: "Bitte anmelden." }, 401);
    const { data: prof } = await sb.from("profiles").select("role,family_id").eq("id", user.id).single();
    if (prof?.role !== "parent") return json({ error: "Nur im Elternbereich verfügbar." }, 403);
    const { data: kid } = await sb.from("profiles").select("display_name").eq("family_id", prof.family_id).eq("role", "child").maybeSingle();
    const sent = await sendTo(prof.family_id, { title: "Fokus-Labor", body: `Test: So sieht deine Erinnerung aus, ${kid?.display_name || ""}! 🔔`, tag: "test" });
    return json({ sent });
  }

  // B) Zeitplan: alle 5 Minuten
  const now = viennaNow();
  const { data: fams } = await sb.from("family_settings").select("family_id,data");
  let total = 0;
  for (const f of fams ?? []) {
    const rem = f.data?.rem ?? {};
    const day = rem.days?.[now.wd];
    if (!day || !day.on) continue;
    const goal = f.data?.goal ?? {};
    const spr = Math.max(1, Number(goal.spr) || 1), cards = Math.max(1, Number(goal.cards) || 25);
    const { data: ks } = await sb.from("kid_state").select("state").eq("family_id", f.family_id).maybeSingle();
    const st = ks?.state ?? {};
    const done = (st.sprints?.[now.date] ?? 0) >= spr || (st.revDay?.[now.date] ?? 0) >= cards;
    if (done) continue;
    const { data: kid } = await sb.from("profiles").select("display_name").eq("family_id", f.family_id).eq("role", "child").maybeSingle();
    for (const slot of ["a", "e"] as const) {
      const t = toMin(slot === "a" ? day.a : day.e);
      if (t === null || now.min < t || now.min > t + 90) continue;
      const { error } = await sb.from("reminder_log").insert({ family_id: f.family_id, day: now.date, slot });
      if (error) continue; // schon geschickt
      total += await sendTo(f.family_id, {
        title: "Fokus-Labor",
        body: pick(MSG[slot], kid?.display_name ?? "", Number(now.date.slice(-2))),
        tag: "lernzeit",
      });
    }
  }
  return json({ ok: true, sent: total, at: now });
});
