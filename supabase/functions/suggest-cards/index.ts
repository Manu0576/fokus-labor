// Fokus-Labor: Kartenvorschläge aus Heftseite (Text oder Foto)
// Nur für angemeldete Eltern. Der API-Schlüssel liegt als Secret ANTHROPIC_API_KEY bei Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nur POST" }, 405);

  // 1. Wer fragt? Nur Eltern dürfen die KI nutzen.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, key, { auth: { persistSession: false } });
  const { data: { user } } = await sb.auth.getUser(token);
  if (!user) return json({ error: "Bitte anmelden." }, 401);
  const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (prof?.role !== "parent") return json({ error: "Nur im Elternbereich verfügbar." }, 403);

  // 2. Eingabe prüfen
  let body: { text?: string; images?: { type: string; data: string }[]; n?: number; subject?: string };
  try { body = await req.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
  const text = String(body.text ?? "").slice(0, 12000).trim();
  const images = (body.images ?? []).slice(0, 3).filter((i) =>
    ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(i.type) && typeof i.data === "string");
  const n = Math.min(15, Math.max(3, Number(body.n) || 5));
  const subject = String(body.subject ?? "Allgemein").slice(0, 60);
  if (!text && !images.length) return json({ error: "Text oder Foto fehlt." }, 400);

  const prompt = `Du hilfst einer Mutter, für ihre Tochter (ca. 11–14 Jahre, österreichische Schule, ADHS) Abfrage-Karten zu erstellen.
Fach: ${subject}
Erstelle genau ${n} Karteikarten aus dem Lernstoff${images.length ? " auf dem Foto bzw. den Fotos" : ""}${text && images.length ? " und" : ""}${text ? " im Text unten" : ""}.
Regeln:
- Nur Inhalte aus dem Material. Nichts erfinden.
- Eine Sache pro Karte. Frage höchstens 15 Wörter, Antwort höchstens 12 Wörter.
- Einfache, klare Sprache auf Deutsch (Vokabeln in der Fremdsprache lassen).
- Mischung: Begriffe, Was/Warum/Wie-Fragen, bei Vokabeln Übersetzung.
- Die wichtigsten Inhalte zuerst.
Antworte ausschließlich mit einem JSON-Array, z. B. [{"q":"Wo findet die Fotosynthese statt?","a":"In den Chloroplasten"}]${text ? "\n\nLernstoff:\n" + text : ""}`;

  const content: unknown[] = images.map((i) => ({
    type: "image", source: { type: "base64", media_type: i.type, data: i.data },
  }));
  content.push({ type: "text", text: prompt });

  // 3. Claude fragen
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
      max_tokens: 2000,
      messages: [{ role: "user", content }],
    }),
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error("Anthropic", r.status, detail);
    return json({ error: r.status === 401 ? "API-Schlüssel fehlt oder ist falsch." :
      r.status === 429 ? "Gerade zu viele Anfragen. Bitte gleich nochmal." : "Die KI hat nicht geantwortet." }, 502);
  }
  const out = await r.json();
  const raw = (out.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  const s = raw.indexOf("["), e = raw.lastIndexOf("]");
  let cards: { q: string; a: string }[] = [];
  try { cards = JSON.parse(raw.slice(s, e + 1)); } catch { return json({ error: "Antwort war nicht lesbar. Bitte nochmal." }, 502); }
  cards = (Array.isArray(cards) ? cards : [])
    .map((c) => ({ q: String(c?.q ?? "").trim(), a: String(c?.a ?? "").trim() }))
    .filter((c) => c.q && c.a);
  return json({ cards });
});
