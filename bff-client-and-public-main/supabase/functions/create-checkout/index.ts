/**
 * Supabase Edge Function: create-checkout
 *
 * Creates a Stripe Checkout Session for a BFF catalog product and
 * records a pending row in public.stripe_transactions.
 *
 * Deploy:
 *   supabase functions deploy create-checkout --no-verify-jwt
 *
 * Secrets:
 *   supabase secrets set STRIPE_SECRET_KEY=sk_live_... \
 *     STRIPE_MERCHANT_ID=mk_1La4NoLavWJ4R5kOSWUYbaQ6
 */

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MERCHANT_ID =
  Deno.env.get("STRIPE_MERCHANT_ID") || "mk_1La4NoLavWJ4R5kOSWUYbaQ6";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CatalogItem = {
  name: string;
  amount: number;
  mode: "payment" | "subscription";
  interval?: "month" | "year";
};

const CATALOG: Record<string, CatalogItem> = {
  grant_readiness_assessment: { name: "Grant Ready Assessment™", amount: 49700, mode: "payment" },
  grant_readiness_package: { name: "Grant Readiness Package™", amount: 150000, mode: "payment" },
  nonprofit_startup: { name: "Nonprofit Startup Package", amount: 299500, mode: "payment" },
  strategic_plan: { name: "Strategic Plan", amount: 350000, mode: "payment" },
  phase_i_growth: { name: "Phase I Business Growth Package", amount: 49700, mode: "payment" },
  phase_ii_clarity: { name: "Phase II Financial Clarity", amount: 75000, mode: "payment" },
  monthly_bookkeeping: { name: "Monthly Bookkeeping", amount: 35000, mode: "subscription", interval: "month" },
  cfo_advisory: { name: "CFO Advisory", amount: 75000, mode: "subscription", interval: "month" },
  financial_cleanup: { name: "Business Financial Cleanup", amount: 150000, mode: "payment" },
  logistics_assessment: { name: "Logistics Business Assessment", amount: 49700, mode: "payment" },
  route_optimization: { name: "Route Optimization Review", amount: 49700, mode: "payment" },
  startup_readiness: { name: "Startup Readiness Assessment", amount: 49700, mode: "payment" },
  transportation_startup: { name: "Transportation Startup Package", amount: 199700, mode: "payment" },
  operations_manual: { name: "Operations Manual", amount: 99700, mode: "payment" },
  transportation_bundle: { name: "Transportation Success Bundle", amount: 299700, mode: "payment" },
  diy_starter: { name: "D.I.Y Starter Kit", amount: 19700, mode: "payment" },
  funding_readiness: { name: "Funding Readiness Assessment", amount: 49700, mode: "payment" },
  childcare_accelerator: { name: "Child Care Funding Accelerator", amount: 299700, mode: "payment" },
  first_two_grants: { name: "First 2 Grants — Done For You", amount: 75000, mode: "payment" },
  academy_enroll: { name: "Business Academy Enrollment", amount: 49700, mode: "payment" },
  expense_iq: { name: "Expense IQ", amount: 4900, mode: "subscription", interval: "month" },
  full_suite: { name: "BFF Full Suite", amount: 150000, mode: "subscription", interval: "month" },
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!stripeKey || !supabaseUrl || !serviceKey) {
    return json({ error: "Stripe API is not configured on the server." }, 500);
  }

  let payload: {
    productKey?: string;
    successUrl?: string;
    cancelUrl?: string;
    email?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const productKey = String(payload.productKey || "").trim();
  const item = CATALOG[productKey];
  if (!item) return json({ error: "Unknown product" }, 400);

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let profileId: string | null = null;
  let email = String(payload.email || "").trim().toLowerCase() || null;
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (jwt && jwt !== (Deno.env.get("SUPABASE_ANON_KEY") || "")) {
    try {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await userClient.auth.getUser();
      if (data?.user?.id) profileId = data.user.id;
      if (data?.user?.email) email = data.user.email.toLowerCase();
    } catch {
      /* guest checkout */
    }
  }

  const origin = req.headers.get("origin") || "https://bestfaceforwardconsultants.com";
  const successUrl =
    payload.successUrl ||
    `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}&product=${encodeURIComponent(productKey)}`;
  const cancelUrl = payload.cancelUrl || `${origin}/`;

  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: item.amount,
      product_data: {
        name: item.name,
        metadata: { product_key: productKey, merchant_id: MERCHANT_ID },
      },
      ...(item.mode === "subscription"
        ? { recurring: { interval: item.interval || "month" } }
        : {}),
    },
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: item.mode,
      line_items: [lineItem],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email || undefined,
      client_reference_id: profileId ? `${profileId}|${productKey}` : productKey,
      metadata: {
        product_key: productKey,
        merchant_id: MERCHANT_ID,
        profile_id: profileId || "",
      },
      subscription_data:
        item.mode === "subscription"
          ? {
              metadata: {
                product_key: productKey,
                merchant_id: MERCHANT_ID,
                profile_id: profileId || "",
                email: email || "",
              },
            }
          : undefined,
      allow_promotion_codes: true,
    });

    await sb.rpc("upsert_stripe_transaction", {
      p_merchant_id: MERCHANT_ID,
      p_profile_id: profileId,
      p_email: email,
      p_product_key: productKey,
      p_kind: item.mode,
      p_status: "pending",
      p_amount_total: item.amount,
      p_currency: "usd",
      p_stripe_session_id: session.id,
      p_metadata: { merchant_id: MERCHANT_ID, source: "create-checkout" },
    });

    return json({ url: session.url, sessionId: session.id, merchantId: MERCHANT_ID });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message || "Checkout failed" }, 500);
  }
});
