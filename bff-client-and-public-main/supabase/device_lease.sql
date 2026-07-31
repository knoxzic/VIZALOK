-- ====================================================================
-- Device lease: online issue_device_lease() + offline cache contract
-- Run in Supabase SQL Editor after bff_multi_division_schema.sql
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.device_leases (
  lease_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  device_label TEXT DEFAULT 'web',
  expires_at TIMESTAMPTZ NOT NULL,
  signature TEXT NOT NULL,
  product_keys TEXT[] DEFAULT '{}',
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, device_id)
);

CREATE INDEX IF NOT EXISTS device_leases_profile_idx ON public.device_leases (profile_id);
CREATE INDEX IF NOT EXISTS device_leases_expiry_idx ON public.device_leases (expires_at);

ALTER TABLE public.device_leases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_leases_select_own ON public.device_leases;
CREATE POLICY device_leases_select_own
  ON public.device_leases FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- Secret for HMAC (set per project). Prefer vault in production.
-- For first deploy we derive from a project-local constant you should rotate.
CREATE OR REPLACE FUNCTION public.device_lease_hmac_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    current_setting('app.settings.device_lease_secret', true),
    'bff-rotate-me-device-lease-hmac-2026'
  );
$$;

/**
 * Issue / renew a signed lease for the current user + device.
 * Default TTL: 14 days (offline grace). Client refreshes every 12h online.
 */
CREATE OR REPLACE FUNCTION public.issue_device_lease(
  p_device_id text,
  p_device_label text DEFAULT 'web',
  p_ttl_hours int DEFAULT 336
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_expires timestamptz;
  v_lease_id uuid;
  v_payload text;
  v_sig text;
  v_products text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_device_id IS NULL OR length(trim(p_device_id)) < 4 THEN
    RAISE EXCEPTION 'device_id required';
  END IF;

  v_expires := NOW() + make_interval(hours => GREATEST(coalesce(p_ttl_hours, 336), 1));

  -- Active product keys from subscriptions (if table exists)
  BEGIN
    SELECT coalesce(array_agg(DISTINCT product_key), '{}')
      INTO v_products
    FROM public.subscriptions
    WHERE profile_id = v_uid
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > NOW());
  EXCEPTION WHEN undefined_table THEN
    v_products := '{}';
  END;

  v_lease_id := gen_random_uuid();
  v_payload := v_lease_id::text || '|' || v_uid::text || '|' || trim(p_device_id) || '|' || v_expires::text;
  v_sig := encode(
    hmac(v_payload::bytea, convert_to(public.device_lease_hmac_secret(), 'utf8'), 'sha256'),
    'hex'
  );

  INSERT INTO public.device_leases (
    lease_id, profile_id, device_id, device_label, expires_at, signature, product_keys, revoked, updated_at
  )
  VALUES (
    v_lease_id, v_uid, trim(p_device_id), coalesce(p_device_label, 'web'),
    v_expires, v_sig, v_products, FALSE, NOW()
  )
  ON CONFLICT (profile_id, device_id) DO UPDATE
    SET lease_id = EXCLUDED.lease_id,
        expires_at = EXCLUDED.expires_at,
        signature = EXCLUDED.signature,
        product_keys = EXCLUDED.product_keys,
        device_label = EXCLUDED.device_label,
        revoked = FALSE,
        updated_at = NOW()
  RETURNING lease_id INTO v_lease_id;

  RETURN jsonb_build_object(
    'lease_id', v_lease_id,
    'profile_id', v_uid,
    'device_id', trim(p_device_id),
    'expires_at', v_expires,
    'signature', v_sig,
    'product_keys', to_jsonb(v_products),
    'issued_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_device_lease(text, text, int) to authenticated;
