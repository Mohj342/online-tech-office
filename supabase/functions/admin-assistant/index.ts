// Admin assistant "Rafeeq": turns an admin's question into a structured READ-ONLY query plan.
// It never receives any site data. It only sees the (masked) question text and returns JSON; the browser runs the queries with the admin's own session.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const TABLES = ["job_seekers", "employer_requests", "inquiries", "listings", "reviews"];
const PERIODS = ["today", "yesterday", "week", "month", "all"];

const SYSTEM = `أنت «رفيق» في لوحة إدارة مكتب أونلاين تك. مهمتك تحويل سؤال الأدمن إلى خطة استعلام قراءة فقط. أنت لا ترى أي بيانات، ولا تجيب بأرقام أو أسماء من عندك أبدًا.
الجداول: job_seekers (الباحثون عن عمل)، employer_requests (طلبات الموظفين من الجهات)، inquiries (طلبات الخدمات)، listings (إعلانات السوق)، reviews (آراء العملاء).
الفترات: today (اليوم)، yesterday (أمس)، week (آخر 7 أيام)، month (آخر 30 يومًا)، all.
الحالات: لكل الجداول new = جديد. ولـ listings: pending = تنتظر المراجعة، published = منشور، rejected، sold. ولـ reviews: pending = تنتظر الموافقة. استخدم status فقط إن ذكر الأدمن حالة أو قال «جديد/معلق/ينتظر».
النص المخفي: قد ترى رموزًا مثل ‹q1› (نص بين علامات اقتباس) أو ‹n1› (رقم). إن أراد الأدمن البحث عن شخص أو رقم فضع الرمز نفسه في search ولا تخمّن محتواه.
إذا سأل سؤالًا عامًا مثل «وش عندنا اليوم/وش الجديد» فاعمل استعلامًا لكل جدول رئيسي مع count_only=false وperiod المناسبة.
الرد JSON فقط:
{"reply":"جملة قصيرة تمهيدية بدون أي أرقام أو أسماء","queries":[{"table":"...","period":"...","status":null|"...","search":null|"‹q1›","count_only":false}],"open_tab":null}
- queries حتى 5 عناصر. إن كان السؤال خارج نطاق لوحة الإدارة فاجعل queries فارغة وreply تقول ما تستطيع فعله.
- open_tab: اسم جدول إذا طلب الأدمن «افتح/روح لـ» تبويب معين، وإلا null.
- لا تطلب تعديلًا أو حذفًا أو نشرًا: أنت للقراءة فقط، وإن طلب ذلك فاشرح أنه يتم من التبويب بيده.`;

function json(o: unknown, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } }); }
async function db(path: string, init: RequestInit = {}, auth?: { token: string; key: string }) {
  const base = Deno.env.get("SUPABASE_URL")! + "/rest/v1/" + path;
  const key = auth ? auth.key : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bearer = auth ? auth.token : key;
  return fetch(base, { ...init, headers: { apikey: key, Authorization: "Bearer " + bearer, "Content-Type": "application/json", Prefer: "count=exact,return=minimal", ...(init.headers || {}) } });
}

function plan(o: any) {
  const out = { reply: "", queries: [] as any[], open_tab: null as string | null };
  out.reply = typeof o?.reply === "string" ? o.reply.slice(0, 300) : "";
  for (const q of (Array.isArray(o?.queries) ? o.queries : []).slice(0, 5)) {
    if (!TABLES.includes(q?.table)) continue;
    out.queries.push({
      table: q.table, period: PERIODS.includes(q.period) ? q.period : "all",
      status: typeof q.status === "string" && /^[a-z_]{2,20}$/.test(q.status) ? q.status : null,
      search: typeof q.search === "string" && /^‹[qn]\d{1,2}›$/.test(q.search) ? q.search : null,
      count_only: !!q.count_only,
    });
  }
  if (TABLES.includes(o?.open_tab)) out.open_tab = o.open_tab;
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const gKey = Deno.env.get("GEMINI_API_KEY"), aKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!gKey && !aKey) return json({ error: "not_configured" }, 503);

  // admin check: the caller's own session must be able to read admin_users
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""), apikey = req.headers.get("apikey") || "";
  if (!token || !apikey) return json({ error: "auth" }, 401);
  const chk = await db("admin_users?select=user_id&limit=1", { method: "GET" }, { token, key: apikey }).catch(() => null);
  const rows = chk && chk.ok ? await chk.json().catch(() => []) : [];
  if (!Array.isArray(rows) || !rows.length) return json({ error: "auth" }, 403);

  let body: any; try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-6)
    .filter((m: any) => m && m.role === "user" && typeof m.content === "string" && m.content.trim())
    .map((m: any) => ({ role: "user", content: m.content.slice(0, 400) }));
  if (!msgs.length) return json({ error: "bad_input" }, 400);

  const ip = "admin:" + token.slice(-12);
  const hour = new Date(Date.now() - 3600e3).toISOString();
  const c = await db(`ai_usage?select=id&limit=1&ip=eq.${encodeURIComponent(ip)}&at=gte.${hour}`, { method: "HEAD" });
  const n = /\/(\d+)$/.exec(c.headers.get("content-range") || "");
  if (n && +n[1] >= 80) return json({ error: "rate_limited" }, 429);
  await db("ai_usage", { method: "POST", body: JSON.stringify({ ip }) });

  let text = "";
  try {
    if (gKey) {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST", headers: { Authorization: "Bearer " + gKey, "content-type": "application/json" },
        body: JSON.stringify({ model: Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite", max_tokens: 500, messages: [{ role: "system", content: SYSTEM }, ...msgs] }),
      });
      if (!r.ok) { console.error("gemini", r.status, await r.text()); return json({ error: "upstream" }, 502); }
      text = String((await r.json()).choices?.[0]?.message?.content || "");
    } else {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "x-api-key": aKey!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 500, system: SYSTEM, messages: msgs }),
      });
      if (!r.ok) { console.error("anthropic", r.status, await r.text()); return json({ error: "upstream" }, 502); }
      text = ((await r.json()).content || []).map((x: any) => x.text || "").join("");
    }
  } catch (e) { console.error(e); return json({ error: "upstream" }, 502); }
  try { const m = /\{[\s\S]*\}/.exec(text); return json(plan(JSON.parse(m ? m[0] : text))); }
  catch { return json({ error: "parse" }, 502); }
});
