/**
 * Stripe webhook → Supabase subscriptions
 *
 * Deploy as:
 *   - Firebase Cloud Function (HTTPS), OR
 *   - Supabase Edge Function (port of this logic), OR
 *   - any Node server with raw body
 *
 * Env:
 *   STRIPE_SECRET_KEY=sk_...
 *   STRIPE_WEBHOOK_SECRET=whsec_...
 *   SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...   (never ship to browser)
 *
 * Stripe Dashboard → Developers → Webhooks → add endpoint
 * Events:
 *   checkout.session.completed
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   invoice.paid
 *
 * Payment Link metadata (recommended on each link):
 *   product_key = expense_iq | grant_readiness_package | phase_i_growth | ...
 *   Or set client_reference_id / success URL ?product=...
 */

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

/** Map Stripe Payment Link id → BFF product_key */
export const PAYMENT_LINK_MAP = {
  plink_1TzN0YLavWJ4R5kO8wjkMGcg: "financial_cleanup",
  plink_1TzMyyLavWJ4R5kOUio63mXr: "cfo_advisory",
  plink_1TzMxWLavWJ4R5kOA5VnTZiR: "monthly_bookkeeping",
  plink_1TzMvXLavWJ4R5kOW5CERSFD: "phase_ii_clarity",
  plink_1TzMtwLavWJ4R5kOF5vNNVQM: "phase_i_growth",
  plink_1TzMqCLavWJ4R5kOH8Bwhjhv: "nonprofit_startup",
  plink_1TzMpjLavWJ4R5kOSDVDwZyw: "strategic_plan",
  plink_1Ty20ILavWJ4R5kOGC6lqU14: "logistics_assessment",
  plink_1TxyfPLavWJ4R5kOa9n1tePK: "route_optimization",
  plink_1TxyeXLavWJ4R5kOwgRAQ9ar: "startup_readiness",
  plink_1TxycnLavWJ4R5kOscR0duYA: "transportation_startup",
  plink_1TxyVVLavWJ4R5kOvcx2f4nu: "operations_manual",
  plink_1TxyOeLavWJ4R5kO7eTiHzS2: "transportation_bundle",
  plink_1TdjN7LavWJ4R5kONg6S3Sa9: "grant_readiness_package",
  plink_1TdjLgLavWJ4R5kOtKS6mqB2: "grant_readiness_assessment",
  // Paste Expense IQ Payment Link id when ready:
  // plink_XXXX: "expense_iq",
};

/** Product keys that gate apps (subscriptions / long-lived entitlement) */
export const APP_PRODUCT_KEYS = new Set(["expense_iq", "full_suite", "academy"]);

function mapStatus(stripeStatus) {
  const s = String(stripeStatus || "active").toLowerCase();
  if (s === "trialing") return "trialing";
  if (s === "active") return "active";
  if (s === "past_due") return "past_due";
  if (s === "canceled" || s === "cancelled" || s === "unpaid") return "canceled";
  if (s === "incomplete" || s === "incomplete_expired") return "incomplete";
  return "active";
}

function resolveProductKey(sessionOrSub) {
  const meta = sessionOrSub.metadata || {};
  if (meta.product_key) return String(meta.product_key).trim();
  if (meta.product) return String(meta.product).trim();

  const plink =
    sessionOrSub.payment_link ||
    (typeof sessionOrSub.payment_link === "object" && sessionOrSub.payment_link?.id) ||
    null;
  const plinkId = typeof plink === "string" ? plink : null;
  if (plinkId && PAYMENT_LINK_MAP[plinkId]) return PAYMENT_LINK_MAP[plinkId];

  // client_reference_id can be product_key or user_id|product_key
  const ref = sessionOrSub.client_reference_id;
  if (ref && String(ref).includes("|")) {
    return String(ref).split("|")[1];
  }
  if (ref && !String(ref).includes("@") && String(ref).length < 64) {
    // might be product key
    if (!String(ref).startsWith("user_")) return String(ref);
  }
  return null;
}

function createSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function alreadyProcessed(sb, eventId) {
  const { data } = await sb.from("stripe_events").select("event_id").eq("event_id", eventId).maybeSingle();
  return !!data;
}

async function markProcessed(sb, event) {
  await sb.from("stripe_events").upsert({
    event_id: event.id,
    event_type: event.type,
    payload: event.data?.object || {},
  });
}

async function resolveProfileId(sb, email, clientReferenceId) {
  if (clientReferenceId) {
    const ref = String(clientReferenceId);
    // pattern: uuid or uuid|product
    const maybeUuid = ref.includes("|") ? ref.split("|")[0] : ref;
    if (/^[0-9a-f-]{36}$/i.test(maybeUuid)) {
      return maybeUuid;
    }
  }
  if (!email) return null;
  const { data, error } = await sb.rpc("profile_id_for_email", { p_email: email });
  if (error) {
    // fallback direct query
    const { data: row } = await sb
      .from("profiles")
      .select("profile_id")
      .eq("email", String(email).toLowerCase())
      .maybeSingle();
    return row?.profile_id || null;
  }
  return data || null;
}

async function grantEntitlement(sb, {
  profileId,
  productKey,
  status = "active",
  customerId,
  subscriptionId,
  priceId,
  periodEnd,
}) {
  if (!profileId || !productKey) return null;

  const { data, error } = await sb.rpc("upsert_subscription_entitlement", {
    p_profile_id: profileId,
    p_product_key: productKey,
    p_status: status,
    p_stripe_customer_id: customerId || null,
    p_stripe_subscription_id: subscriptionId || null,
    p_stripe_price_id: priceId || null,
    p_current_period_end: periodEnd || null,
  });

  if (error) {
    // Direct upsert fallback
    const { data: row, error: e2 } = await sb
      .from("subscriptions")
      .upsert(
        {
          profile_id: profileId,
          product_key: productKey,
          status,
          stripe_customer_id: customerId || null,
          stripe_subscription_id: subscriptionId || null,
          stripe_price_id: priceId || null,
          current_period_end: periodEnd || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id,product_key" }
      )
      .select()
      .maybeSingle();
    if (e2) throw e2;
    return row;
  }
  return data;
}

async function recordPurchase(sb, row) {
  await sb.from("purchases").upsert(row, { onConflict: "stripe_session_id" });
}

/**
 * Core handler — pass verified Stripe event.
 */
export async function handleStripeEvent(event) {
  const sb = createSupabase();

  if (await alreadyProcessed(sb, event.id)) {
    return { ok: true, duplicate: true };
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const email =
        session.customer_details?.email ||
        session.customer_email ||
        session.metadata?.email ||
        null;
      const productKey = resolveProductKey(session) || session.metadata?.product_key;
      const profileId = await resolveProfileId(sb, email, session.client_reference_id);

      if (productKey && profileId) {
        // One-time packages: active entitlement, no end (lifetime access flag)
        // Recurring: period end filled on subscription events
        const isApp = APP_PRODUCT_KEYS.has(productKey);
        const periodEnd = isApp ? null : null; // lifetime null = always active in client
        await grantEntitlement(sb, {
          profileId,
          productKey,
          status: "active",
          customerId: session.customer || null,
          subscriptionId: session.subscription || null,
          periodEnd,
        });
      }

      if (productKey) {
        await recordPurchase(sb, {
          profile_id: profileId,
          email,
          product_key: productKey,
          stripe_payment_link:
            typeof session.payment_link === "string" ? session.payment_link : null,
          stripe_session_id: session.id,
          stripe_customer_id: session.customer || null,
          amount_total: session.amount_total,
          currency: session.currency || "usd",
          status: "paid",
        });
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object;
      const productKey =
        resolveProductKey(sub) ||
        sub.metadata?.product_key ||
        "expense_iq";
      const email = sub.metadata?.email || null;
      let profileId = sub.metadata?.profile_id || null;
      if (!profileId && email) {
        profileId = await resolveProfileId(sb, email, null);
      }
      // Prefer client_reference stored in metadata at checkout
      if (!profileId && sub.metadata?.supabase_user_id) {
        profileId = sub.metadata.supabase_user_id;
      }

      if (profileId && productKey) {
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        await grantEntitlement(sb, {
          profileId,
          productKey,
          status: mapStatus(sub.status),
          customerId: sub.customer || null,
          subscriptionId: sub.id,
          priceId: sub.items?.data?.[0]?.price?.id || null,
          periodEnd,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const productKey = resolveProductKey(sub) || sub.metadata?.product_key || "expense_iq";
      const profileId =
        sub.metadata?.profile_id ||
        sub.metadata?.supabase_user_id ||
        (await resolveProfileId(sb, sub.metadata?.email, null));
      if (profileId && productKey) {
        await grantEntitlement(sb, {
          profileId,
          productKey,
          status: "canceled",
          customerId: sub.customer || null,
          subscriptionId: sub.id,
          periodEnd: new Date().toISOString(),
        });
      }
      break;
    }

    default:
      break;
  }

  await markProcessed(sb, event);
  return { ok: true };
}

/**
 * Express / Firebase style entry (raw body required).
 */
export async function stripeWebhookHttp(req, res) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    const raw = req.rawBody || req.body;
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature failed", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const result = await handleStripeEvent(event);
    return res.json({ received: true, ...result });
  } catch (err) {
    console.error("Webhook handler error", err);
    return res.status(500).json({ error: err.message || "handler failed" });
  }
}

// Firebase CommonJS export helper
export default { handleStripeEvent, stripeWebhookHttp, PAYMENT_LINK_MAP };
