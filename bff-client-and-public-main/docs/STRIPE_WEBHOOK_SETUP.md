# Stripe API → transactions + entitlements

Merchant / account object on every transaction:
`mk_1La4NoLavWJ4R5kOSWUYbaQ6` (`STRIPE_MERCHANT_ID`)

This is **not** a Stripe secret key. The secret key (`sk_live_…` / `sk_test_…`) stays in Supabase secrets only.

## Checkout
1. Browser calls Edge Function `create-checkout` (preferred).
2. Function creates a Stripe Checkout Session tagged with `merchant_id`.
3. A **pending** row is written to `public.stripe_transactions`.
4. After pay, webhook marks the row **paid** and grants `subscriptions`.
5. If the function is down, the site falls back to existing Payment Links.

## SQL
1. `supabase/bff_multi_division_schema.sql`
2. `supabase/stripe_entitlements.sql`
3. `supabase/stripe_transactions.sql`

## Deploy
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_MERCHANT_ID=mk_1La4NoLavWJ4R5kOSWUYbaQ6

supabase functions deploy create-checkout --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

Webhook URL:
`https://<project-ref>.supabase.co/functions/v1/stripe-webhook`

Events:
- `checkout.session.completed`
- `payment_intent.succeeded`
- `invoice.paid`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

---

# Stripe webhook → Supabase subscriptions

## Goal
After a customer pays (Payment Link or Subscription), write a row to `public.subscriptions` so the site paywall (`PAYWALL.freePreview: false`) can unlock products.

## 1. SQL (Supabase SQL Editor)
Run in order:
1. `supabase/bff_multi_division_schema.sql` (profiles + subscriptions)
2. `supabase/stripe_entitlements.sql` (upsert helpers + purchases + stripe_events)
3. Optional: `expense-iq/supabase/schema.sql`

## 2. Deploy webhook (recommended: Edge Function)
```bash
# From a machine with Supabase CLI + project linked
supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
supabase functions deploy stripe-webhook --no-verify-jwt
```

Endpoint:
`https://<project-ref>.supabase.co/functions/v1/stripe-webhook`

## 3. Stripe Dashboard
**Developers → Webhooks → Add endpoint**

Events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## 4. Payment Link metadata
On each Payment Link (or Price), set metadata:
- `product_key` = `expense_iq` | `phase_i_growth` | `grant_readiness_package` | …

The site also appends `client_reference_id={userId}|{productId}` when the buyer is signed in.

Payment Link IDs are mapped in:
- `backend-example/stripe-webhook-supabase.js` → `PAYMENT_LINK_MAP`
- `supabase/functions/stripe-webhook/index.ts` → `PAYMENT_LINK_MAP`

## 5. Expense IQ when ready
1. Create Stripe Payment Link (subscription or one-time).
2. In `js/config.js`:
```js
PAYWALL: {
  freePreview: false,
  products: {
    expense_iq: {
      key: "expense_iq",
      name: "Expense IQ",
      stripeUrl: "https://buy.stripe.com/YOUR_LINK",
      stripeId: "plink_YOUR_ID",
      priceLabel: "Subscribe",
      comingSoon: false,
    },
  },
}
```
3. Add `plink_…: "expense_iq"` to both `PAYMENT_LINK_MAP`s.
4. Redeploy Edge Function if map changed.

## 6. Staff bypass
Profiles with role `principal | agent | associate | bookkeeper | csr` skip the paywall for app access (practice staff).

## 7. Test
1. Confirm email on a test user.
2. Open Expense IQ → should hit paywall (no free preview).
3. Complete test checkout with signed-in `client_reference_id`.
4. Check `subscriptions` table for `product_key` + `status = active`.
5. Reload Expense IQ → access granted.
