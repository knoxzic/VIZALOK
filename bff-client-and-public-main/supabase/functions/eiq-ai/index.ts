/**
 * Supabase Edge Function: eiq-ai
 *
 * Server-side proxy for Expense IQ's AI calls (receipt extraction, quick-add
 * parsing). Holds the xAI/Grok API key — the browser never sees it.
 *
 * Unlike stripe-webhook, this function is called directly by signed-in users
 * from the browser, so it is deployed WITH JWT verification on (default —
 * do NOT pass --no-verify-jwt) and additionally checks org membership itself.
 *
 * Deploy:
 *   supabase functions deploy eiq-ai
 *
 * Secrets:
 *   supabase secrets set XAI_API_KEY=xai-...
 *   supabase secrets set XAI_MODEL=grok-4.5   (optional; confirm current model id before setting)
 *   (SUPABASE_URL + SUPABASE_ANON_KEY are provided automatically)
 *
 * Called from the client via:
 *   supabase.functions.invoke("eiq-ai", { body: { action, orgId, ... } })
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const RECEIPT_SYSTEM_PROMPT =
  'You read receipt photos and extract structured data. Respond with ONLY a JSON object, no prose, no markdown fences. Shape: {"vendor":string,"date":"YYYY-MM-DD","total":number,"category":string,"items":[{"name":string,"amount":number}]}. If a field is unreadable, make a best guess or use an empty string / 0.';

function quickAddSystemPrompt(today: string) {
  return `Today's date is ${today}. Turn the user's plain-language request into ONLY a JSON object, no prose: {"type":"task"|"booking","title":string,"date":"YYYY-MM-DD or empty","time":"HH:MM 24h or empty","notes":string}.`;
}

function parseJsonLoose(text: string): Record<string, unknown> {
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

async function callGrok(
  apiKey: string,
  model: string,
  messages: unknown[]
): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, response_format: { type: "json_object" } }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Grok API error (${res.status}): ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = String(payload.action || "");
  const orgId = String(payload.orgId || "");
  if (!orgId) return json({ error: "orgId is required" }, 400);
  if (action !== "extract_receipt" && action !== "quick_add_task") {
    return json({ error: "Unknown action" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const authHeader = req.headers.get("authorization") || "";
  if (!supabaseUrl || !anonKey) {
    return json({ error: "Server misconfigured (missing Supabase env)" }, 500);
  }
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  // Client scoped to the caller's own JWT — RLS/RPC run as that user, not as service role.
  const sb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: isMember, error: memberErr } = await sb.rpc("eiq_is_org_member", {
    p_org_id: orgId,
  });
  if (memberErr) {
    return json({ error: "Could not verify org membership: " + memberErr.message }, 401);
  }
  if (!isMember) {
    return json({ error: "Forbidden: not a member of this organization" }, 403);
  }

  const apiKey = Deno.env.get("XAI_API_KEY") || "";
  const model = Deno.env.get("XAI_MODEL") || "grok-4.5";
  if (!apiKey) {
    return json({ error: "AI extraction is not configured yet." }, 500);
  }

  try {
    if (action === "extract_receipt") {
      const image = String(payload.image || "");
      if (!image) return json({ error: "image is required" }, 400);
      const content = await callGrok(apiKey, model, [
        { role: "system", content: RECEIPT_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract this receipt." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ]);
      const parsed = parseJsonLoose(content);
      return json(parsed);
    }

    // action === "quick_add_task"
    const text = String(payload.text || "");
    if (!text) return json({ error: "text is required" }, 400);
    const today = new Date().toISOString().slice(0, 10);
    const content = await callGrok(apiKey, model, [
      { role: "system", content: quickAddSystemPrompt(today) },
      { role: "user", content: text },
    ]);
    const parsed = parseJsonLoose(content);
    return json(parsed);
  } catch (err) {
    return json({ error: (err as Error).message || "AI request failed" }, 502);
  }
});
