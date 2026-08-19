-- ====================================================================
-- Stripe transactions ledger (checkout + charges + invoices)
-- Run after stripe_entitlements.sql
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.stripe_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id TEXT,
  profile_id UUID REFERENCES public.profiles(profile_id) ON DELETE SET NULL,
  email TEXT,
  product_key TEXT,
  kind TEXT NOT NULL DEFAULT 'checkout',
  status TEXT NOT NULL DEFAULT 'pending',
  amount_total INT,
  currency TEXT DEFAULT 'usd',
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_invoice_id TEXT,
  stripe_customer_id TEXT,
  stripe_payment_link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS stripe_transactions_session_uidx
  ON public.stripe_transactions (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stripe_transactions_pi_uidx
  ON public.stripe_transactions (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS stripe_transactions_profile_idx
  ON public.stripe_transactions (profile_id);

CREATE INDEX IF NOT EXISTS stripe_transactions_email_idx
  ON public.stripe_transactions (lower(email));

ALTER TABLE public.stripe_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stripe_tx_own_select ON public.stripe_transactions;
CREATE POLICY stripe_tx_own_select ON public.stripe_transactions
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

CREATE OR REPLACE FUNCTION public.upsert_stripe_transaction(
  p_merchant_id text DEFAULT NULL,
  p_profile_id uuid DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_product_key text DEFAULT NULL,
  p_kind text DEFAULT 'checkout',
  p_status text DEFAULT 'paid',
  p_amount_total int DEFAULT NULL,
  p_currency text DEFAULT 'usd',
  p_stripe_session_id text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL,
  p_stripe_charge_id text DEFAULT NULL,
  p_stripe_invoice_id text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_stripe_payment_link text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.stripe_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.stripe_transactions;
BEGIN
  IF p_stripe_session_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.stripe_transactions WHERE stripe_session_id = p_stripe_session_id;
  ELSIF p_stripe_payment_intent_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.stripe_transactions WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;
  END IF;

  IF v_row.transaction_id IS NOT NULL THEN
    UPDATE public.stripe_transactions SET
      merchant_id = COALESCE(p_merchant_id, merchant_id),
      profile_id = COALESCE(p_profile_id, profile_id),
      email = COALESCE(p_email, email),
      product_key = COALESCE(p_product_key, product_key),
      kind = COALESCE(p_kind, kind),
      status = COALESCE(p_status, status),
      amount_total = COALESCE(p_amount_total, amount_total),
      currency = COALESCE(p_currency, currency),
      stripe_payment_intent_id = COALESCE(p_stripe_payment_intent_id, stripe_payment_intent_id),
      stripe_charge_id = COALESCE(p_stripe_charge_id, stripe_charge_id),
      stripe_invoice_id = COALESCE(p_stripe_invoice_id, stripe_invoice_id),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      stripe_payment_link = COALESCE(p_stripe_payment_link, stripe_payment_link),
      metadata = COALESCE(p_metadata, metadata),
      updated_at = NOW()
    WHERE transaction_id = v_row.transaction_id
    RETURNING * INTO v_row;
    RETURN v_row;
  END IF;

  INSERT INTO public.stripe_transactions (
    merchant_id, profile_id, email, product_key, kind, status,
    amount_total, currency, stripe_session_id, stripe_payment_intent_id,
    stripe_charge_id, stripe_invoice_id, stripe_customer_id, stripe_payment_link, metadata
  ) VALUES (
    p_merchant_id, p_profile_id, p_email, p_product_key, COALESCE(p_kind, 'checkout'), COALESCE(p_status, 'paid'),
    p_amount_total, COALESCE(p_currency, 'usd'), p_stripe_session_id, p_stripe_payment_intent_id,
    p_stripe_charge_id, p_stripe_invoice_id, p_stripe_customer_id, p_stripe_payment_link,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_stripe_transaction(
  text, uuid, text, text, text, text, int, text, text, text, text, text, text, text, jsonb
) FROM PUBLIC;
