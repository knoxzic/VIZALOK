/**
 * Supabase Edge Function: stripe-webhook
 *
 * Deploy:
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 *
 * Secrets:
 *   supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
 *   (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are provided automatically)
 *
 * Stripe endpoint URL:
 *   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
 */

import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MERCHANT_ID =
  Deno.env.get("STRIPE_MERCHANT_ID") || "mk_1La4NoLavWJ4R5kOSWUYbaQ6";

const PAYMENT_LINK_MAP: Record<string, string> = {
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
  // plink_YOUR_EXPENSE_IQ: "expense_iq",
};

function mapStatus(s: string): string {
  const x = (s || "active").toLowerCase();
  if (["trialing", "active", "past_due", "canceled", "incomplete"].includes(x)) return x;
  if (x === "cancelled" || x === "unpaid") return "canceled";
  return "active";
}

function resolveProductKey(obj: Record<string, unknown>): string | null {
  const meta = (obj.metadata || {}) as Record<string, string>;
  if (meta.product_key) return meta.product_key.trim();
  if (meta.product) return meta.product.trim();
  const plink = obj.payment_link;
  if (typeof plink === "string" && PAYMENT_LINK_MAP[plink]) return PAYMENT_LINK_MAP[plink];
  const ref = obj.client_reference_id;
  if (typeof ref === "string" && ref.includes("|")) return ref.split("|")[1];
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!stripeKey || !whSecret || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing env secrets" }), { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Idempotency
  const { data: seen } = await sb
    .from("stripe_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (seen) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async function profileFor(email: string | null, ref: string | null) {
    if (ref && /^[0-9a-f-]{36}/i.test(ref)) {
      return ref.includes("|") ? ref.split("|")[0] : ref;
    }
    if (!email) return null;
    const { data } = await sb.rpc("profile_id_for_email", { p_email: email });
    if (data) return data as string;
    const { data: row } = await sb
      .from("profiles")
      .select("profile_id")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    return row?.profile_id || null;
  }

  async function recordTx(row: {
    profileId?: string | null;
    email?: string | null;
    productKey?: string | null;
    kind?: string;
    status?: string;
    amount?: number | null;
    currency?: string | null;
    sessionId?: string | null;
    paymentIntentId?: string | null;
    chargeId?: string | null;
    invoiceId?: string | null;
    customerId?: string | null;
    paymentLink?: string | null;
    extra?: Record<string, unknown>;
  }) {
    const { error } = await sb.rpc("upsert_stripe_transaction", {
      p_merchant_id: MERCHANT_ID,
      p_profile_id: row.profileId || null,
      p_email: row.email || null,
      p_product_key: row.productKey || null,
      p_kind: row.kind || "checkout",
      p_status: row.status || "paid",
      p_amount_total: row.amount ?? null,
      p_currency: row.currency || "usd",
      p_stripe_session_id: row.sessionId || null,
      p_stripe_payment_intent_id: row.paymentIntentId || null,
      p_stripe_charge_id: row.chargeId || null,
      p_stripe_invoice_id: row.invoiceId || null,
      p_stripe_customer_id: row.customerId || null,
      p_stripe_payment_link: row.paymentLink || null,
      p_metadata: { merchant_id: MERCHANT_ID, ...(row.extra || {}) },
    });
    if (error) console.error("stripe_transactions", error);
  }

  async function grant(
    profileId: string,
    productKey: string,
    status: string,
    extra: Record<string, unknown> = {}
  ) {
    const { error } = await sb.rpc("upsert_subscription_entitlement", {
      p_profile_id: profileId,
      p_product_key: productKey,
      p_status: status,
      p_stripe_customer_id: (extra.customerId as string) || null,
      p_stripe_subscription_id: (extra.subscriptionId as string) || null,
      p_stripe_price_id: (extra.priceId as string) || null,
      p_current_period_end: (extra.periodEnd as string) || null,
    });
    if (error) {
      await sb.from("subscriptions").upsert(
        {
          profile_id: profileId,
          product_key: productKey,
          status,
          stripe_customer_id: extra.customerId || null,
          stripe_subscription_id: extra.subscriptionId || null,
          stripe_price_id: extra.priceId || null,
          current_period_end: extra.periodEnd || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id,product_key" }
      );
    }
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = session.customer_details?.email || session.customer_email || null;
      const productKey = resolveProductKey(session as unknown as Record<string, unknown>);
      const profileId = await profileFor(
        email,
        session.client_reference_id
      );
      if (productKey && profileId) {
        await grant(profileId, productKey, "active", {
          customerId: session.customer,
          subscriptionId: session.subscription,
        });
      }
      await recordTx({
        profileId,
        email,
        productKey,
        kind: session.mode === "subscription" ? "subscription" : "checkout",
        status: "paid",
        amount: session.amount_total,
        currency: session.currency,
        sessionId: session.id,
        paymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
        customerId: typeof session.customer === "string" ? session.customer : null,
        paymentLink: typeof session.payment_link === "string" ? session.payment_link : null,
        extra: { event: event.type },
      });
      if (productKey) {
        await sb.from("purchases").upsert(
          {
            profile_id: profileId,
            email,
            product_key: productKey,
            stripe_payment_link:
              typeof session.payment_link === "string" ? session.payment_link : null,
            stripe_session_id: session.id,
            stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
            amount_total: session.amount_total,
            currency: session.currency || "usd",
            status: "paid",
          },
          { onConflict: "stripe_session_id" }
        );
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const productKey =
        resolveProductKey(sub as unknown as Record<string, unknown>) ||
        sub.metadata?.product_key ||
        "expense_iq";
      const profileId =
        sub.metadata?.profile_id ||
        sub.metadata?.supabase_user_id ||
        (await profileFor(sub.metadata?.email || null, null));
      if (profileId && productKey) {
        await grant(String(profileId), productKey, mapStatus(sub.status), {
          customerId: sub.customer,
          subscriptionId: sub.id,
          priceId: sub.items?.data?.[0]?.price?.id,
          periodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        });
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      const meta = (pi.metadata || {}) as Record<string, string>;
      const profileId = await profileFor(meta.email || null, meta.profile_id || null);
      await recordTx({
        profileId,
        email: meta.email || null,
        productKey: meta.product_key || resolveProductKey(pi as unknown as Record<string, unknown>),
        kind: "payment_intent",
        status: "paid",
        amount: pi.amount_received ?? pi.amount,
        currency: pi.currency,
        paymentIntentId: pi.id,
        customerId: typeof pi.customer === "string" ? pi.customer : null,
        extra: { event: event.type },
      });
    }

    if (event.type === "invoice.paid") {
      const inv = event.data.object as Stripe.Invoice;
      const meta = (inv.metadata || {}) as Record<string, string>;
      const profileId = await profileFor(inv.customer_email || meta.email || null, meta.profile_id || null);
      await recordTx({
        profileId,
        email: inv.customer_email || meta.email || null,
        productKey: meta.product_key || resolveProductKey(inv as unknown as Record<string, unknown>),
        kind: "invoice",
        status: "paid",
        amount: inv.amount_paid,
        currency: inv.currency,
        invoiceId: inv.id,
        paymentIntentId: typeof inv.payment_intent === "string" ? inv.payment_intent : null,
        customerId: typeof inv.customer === "string" ? inv.customer : null,
        extra: { event: event.type },
      });
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const productKey =
        resolveProductKey(sub as unknown as Record<string, unknown>) ||
        sub.metadata?.product_key ||
        "expense_iq";
      const profileId =
        sub.metadata?.profile_id ||
        sub.metadata?.supabase_user_id ||
        (await profileFor(sub.metadata?.email || null, null));
      if (profileId && productKey) {
        await grant(String(profileId), productKey, "canceled", {
          customerId: sub.customer,
          subscriptionId: sub.id,
          periodEnd: new Date().toISOString(),
        });
      }
    }

    await sb.from("stripe_events").upsert({
      event_id: event.id,
      event_type: event.type,
      payload: event.data.object as unknown as Record<string, unknown>,
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
