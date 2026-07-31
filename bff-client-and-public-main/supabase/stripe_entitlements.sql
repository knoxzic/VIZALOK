-- ====================================================================
-- Stripe → subscriptions entitlements
-- Service-role only upsert used by webhook handlers.
-- Run after bff_multi_division_schema.sql (needs public.subscriptions)
-- ====================================================================

-- Optional: store one-time purchases for audit (packages)
CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(profile_id) ON DELETE SET NULL,
  email TEXT,
  product_key TEXT NOT NULL,
  stripe_payment_link TEXT,
  stripe_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  amount_total INT,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- No public policies — service role only (bypasses RLS)

/**
 * Upsert an entitlement row for a profile.
 * Called only with service_role from webhook.
 */
CREATE OR REPLACE FUNCTION public.upsert_subscription_entitlement(
  p_profile_id uuid,
  p_product_key text,
  p_status text DEFAULT 'active',
  p_stripe_customer_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_price_id text DEFAULT NULL,
  p_current_period_end timestamptz DEFAULT NULL
)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.subscriptions;
  v_status subscription_status;
BEGIN
  IF p_profile_id IS NULL OR p_product_key IS NULL OR length(trim(p_product_key)) < 1 THEN
    RAISE EXCEPTION 'profile_id and product_key required';
  END IF;

  BEGIN
    v_status := p_status::subscription_status;
  EXCEPTION WHEN others THEN
    v_status := 'active';
  END;

  INSERT INTO public.subscriptions (
    profile_id, product_key, status,
    stripe_customer_id, stripe_subscription_id, stripe_price_id,
    current_period_end, updated_at
  )
  VALUES (
    p_profile_id, trim(p_product_key), v_status,
    p_stripe_customer_id, p_stripe_subscription_id, p_stripe_price_id,
    p_current_period_end, NOW()
  )
  ON CONFLICT (profile_id, product_key) DO UPDATE
    SET status = EXCLUDED.status,
        stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, public.subscriptions.stripe_customer_id),
        stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, public.subscriptions.stripe_subscription_id),
        stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, public.subscriptions.stripe_price_id),
        current_period_end = COALESCE(EXCLUDED.current_period_end, public.subscriptions.current_period_end),
        updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

/**
 * Resolve profile_id from email (case-insensitive).
 */
CREATE OR REPLACE FUNCTION public.profile_id_for_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT profile_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
$$;

-- Not granted to authenticated — webhook uses service_role
REVOKE ALL ON FUNCTION public.upsert_subscription_entitlement(uuid, text, text, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_id_for_email(text) FROM PUBLIC;
