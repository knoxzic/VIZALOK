-- ====================================================================
-- BEST FACE FORWARD CONSULTANTS, LLC - MULTI-DIVISION SQL SCHEMA
-- Idempotent / safe-to-re-run version for Supabase
-- Hardened RLS + compliance gates + append-only audit
-- + subscriptions paywall + email-confirmed profile bootstrap
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS (safe create)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('principal', 'agent', 'associate', 'bookkeeper', 'csr', 'read_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE service_line_type AS ENUM ('life', 'health', 'property', 'casualty', 'bookkeeping', 'advisory', 'tax', 'analysis');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM ('web_form', 'referral', 'cold_import', 'event', 'client_referral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_stage AS ENUM ('new', 'contacted', 'quoted', 'applied', 'bound', 'lost', 'nurture');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quote_status AS ENUM ('draft', 'presented', 'applied', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE policy_status AS ENUM ('active', 'lapsed', 'cancelled', 'renewed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE commission_type AS ENUM ('first_year', 'renewal', 'override');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE commission_status AS ENUM ('pending', 'paid', 'chargeback');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE client_entity_type AS ENUM ('individual', 'business');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE engagement_fee_structure AS ENUM ('hourly', 'flat', 'retainer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE engagement_status AS ENUM ('proposed', 'active', 'paused', 'completed', 'terminated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tax_return_status AS ENUM ('gathering_docs', 'in_prep', 'review', 'filed', 'amended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'written_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ====================================================================
-- 3. TABLES (IF NOT EXISTS)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    profile_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'read_only',
    licensed_lines service_line_type[] DEFAULT '{}',
    email_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
    product_key TEXT NOT NULL,
    status subscription_status NOT NULL DEFAULT 'incomplete',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (profile_id, product_key)
);

CREATE TABLE IF NOT EXISTS public.licenses_credentials (
    credential_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(profile_id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL,
    license_or_ptin_number TEXT,
    state_or_jurisdiction VARCHAR(10),
    issue_date DATE,
    expiration_date DATE,
    ce_credits_required DECIMAL(5,2) DEFAULT 0.00,
    ce_credits_completed DECIMAL(5,2) DEFAULT 0.00,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clients (
    client_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type client_entity_type NOT NULL DEFAULT 'individual',
    primary_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address JSONB,
    ssn_last4_or_ein TEXT,
    household_id UUID,
    converted_from_lead_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leads (
    lead_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source lead_source NOT NULL DEFAULT 'web_form',
    contact_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    lines_of_interest service_line_type[] DEFAULT '{}',
    score INT DEFAULT 0,
    stage lead_stage NOT NULL DEFAULT 'new',
    assigned_profile_id UUID REFERENCES public.profiles(profile_id),
    converted_client_id UUID REFERENCES public.clients(client_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quotes (
    quote_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.leads(lead_id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(client_id) ON DELETE SET NULL,
    carrier_id UUID NOT NULL,
    product_id UUID NOT NULL,
    line service_line_type NOT NULL,
    underwriting_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    premium_quoted DECIMAL(10,2) NOT NULL,
    status quote_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.policies (
    policy_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(client_id) ON DELETE RESTRICT,
    source_quote_id UUID REFERENCES public.quotes(quote_id) ON DELETE RESTRICT,
    carrier_id UUID NOT NULL,
    product_id UUID NOT NULL,
    line service_line_type NOT NULL,
    policy_number TEXT NOT NULL UNIQUE,
    effective_date DATE NOT NULL,
    term_months INT,
    premium DECIMAL(10,2) NOT NULL,
    face_amount_or_coverage_limit DECIMAL(12,2) NOT NULL,
    status policy_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commissions (
    commission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_id UUID NOT NULL REFERENCES public.policies(policy_id) ON DELETE RESTRICT,
    agent_id UUID NOT NULL REFERENCES public.profiles(profile_id) ON DELETE RESTRICT,
    commission_rate DECIMAL(5,4) NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    commission_type commission_type NOT NULL DEFAULT 'first_year',
    status commission_status NOT NULL DEFAULT 'pending',
    chargeback_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.engagements (
    engagement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(client_id) ON DELETE CASCADE,
    service_line service_line_type NOT NULL,
    fee_structure engagement_fee_structure NOT NULL,
    scope_of_work TEXT NOT NULL,
    status engagement_status NOT NULL DEFAULT 'proposed',
    engagement_letter_signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(client_id) ON DELETE CASCADE,
    account_code VARCHAR(20) NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    UNIQUE(client_id, account_code)
);

CREATE TABLE IF NOT EXISTS public.tax_returns (
    return_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID NOT NULL REFERENCES public.engagements(engagement_id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES public.clients(client_id) ON DELETE RESTRICT,
    tax_year INT NOT NULL,
    filing_status TEXT NOT NULL,
    due_diligence_checklist JSONB NOT NULL DEFAULT '{"form_8867_complete": false}'::jsonb,
    status tax_return_status NOT NULL DEFAULT 'gathering_docs',
    filed_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sub_preparers (
    sub_preparer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name TEXT NOT NULL,
    efin TEXT NOT NULL UNIQUE,
    ptin TEXT NOT NULL UNIQUE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.software_licenses (
    license_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sub_preparer_id UUID NOT NULL REFERENCES public.sub_preparers(sub_preparer_id),
    tax_year INT NOT NULL,
    wholesale_cost DECIMAL(10,2) NOT NULL,
    resale_price DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(profile_id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ====================================================================
-- 4. HELPER FUNCTIONS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_principal()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profile_id = auth.uid() AND role = 'principal'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profile_id = auth.uid()
      AND role IN ('principal', 'agent', 'associate', 'bookkeeper', 'csr')
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT LOG IS APPEND-ONLY: UPDATE and DELETE are not permitted.';
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_principal() THEN
    RAISE EXCEPTION 'Only a principal can change user roles.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_tax_due_diligence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'filed' AND (NEW.due_diligence_checklist->>'form_8867_complete')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION 'COMPLIANCE VIOLATION: Cannot mark tax return as filed without completing Form 8867 Due Diligence Checklist.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_sub_preparer_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_verified BOOLEAN;
BEGIN
    IF NEW.status = 'active' THEN
        SELECT is_verified INTO v_verified FROM public.sub_preparers WHERE sub_preparer_id = NEW.sub_preparer_id;
        IF v_verified IS NOT TRUE THEN
            RAISE EXCEPTION 'COMPLIANCE VIOLATION: Cannot activate software license for an unverified Sub-Preparer or invalid EFIN/PTIN.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Profile bootstrap on signup (confirmed flag tracks auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (profile_id, email, full_name, email_confirmed)
  VALUES (
    NEW.id,
    lower(coalesce(NEW.email, '')),
    coalesce(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'display_name', split_part(coalesce(NEW.email, 'user'), '@', 1)),
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (profile_id) DO UPDATE
    SET email = excluded.email,
        email_confirmed = (NEW.email_confirmed_at IS NOT NULL),
        updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- Keep email_confirmed in sync when user confirms
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL) THEN
    UPDATE public.profiles
    SET email_confirmed = TRUE, updated_at = NOW()
    WHERE profile_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_confirmed();


-- ====================================================================
-- 5. TRIGGERS
-- ====================================================================

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON public.audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

DROP TRIGGER IF EXISTS enforce_tax_due_diligence_gate ON public.tax_returns;
CREATE TRIGGER enforce_tax_due_diligence_gate
  BEFORE INSERT OR UPDATE ON public.tax_returns
  FOR EACH ROW EXECUTE FUNCTION public.check_tax_due_diligence();

DROP TRIGGER IF EXISTS enforce_sub_preparer_license_activation ON public.software_licenses;
CREATE TRIGGER enforce_sub_preparer_license_activation
  BEFORE INSERT OR UPDATE ON public.software_licenses
  FOR EACH ROW EXECUTE FUNCTION public.check_sub_preparer_verification();

DROP TRIGGER IF EXISTS profiles_protect_role ON public.profiles;
CREATE TRIGGER profiles_protect_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();


-- ====================================================================
-- 6. ENABLE RLS
-- ====================================================================

ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses_credentials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_returns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_preparers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.software_licenses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log             ENABLE ROW LEVEL SECURITY;


-- ====================================================================
-- 7. POLICIES
-- ====================================================================

-- PROFILES
DROP POLICY IF EXISTS "profiles_select_own_or_principal" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "profiles_select_own_or_principal"
  ON public.profiles FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_principal());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- SUBSCRIPTIONS (read own; writes via service role / Stripe webhook later)
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_principal_all" ON public.subscriptions;

CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_principal());

CREATE POLICY "subscriptions_principal_all"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_principal())
  WITH CHECK (public.is_principal());


-- LICENSES_CREDENTIALS
DROP POLICY IF EXISTS "licenses_select_own_or_principal" ON public.licenses_credentials;
DROP POLICY IF EXISTS "licenses_insert_own_or_principal" ON public.licenses_credentials;
DROP POLICY IF EXISTS "licenses_update_own_or_principal" ON public.licenses_credentials;
DROP POLICY IF EXISTS "licenses_delete_principal" ON public.licenses_credentials;

CREATE POLICY "licenses_select_own_or_principal"
  ON public.licenses_credentials FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_principal());

CREATE POLICY "licenses_insert_own_or_principal"
  ON public.licenses_credentials FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() OR public.is_principal());

CREATE POLICY "licenses_update_own_or_principal"
  ON public.licenses_credentials FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() OR public.is_principal())
  WITH CHECK (profile_id = auth.uid() OR public.is_principal());

CREATE POLICY "licenses_delete_principal"
  ON public.licenses_credentials FOR DELETE TO authenticated
  USING (public.is_principal());


-- CLIENTS
DROP POLICY IF EXISTS "clients_select_staff" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_staff" ON public.clients;
DROP POLICY IF EXISTS "clients_update_staff" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_principal" ON public.clients;
DROP POLICY IF EXISTS "Staff access to clients" ON public.clients;

CREATE POLICY "clients_select_staff"
  ON public.clients FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "clients_insert_staff"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "clients_update_staff"
  ON public.clients FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "clients_delete_principal"
  ON public.clients FOR DELETE TO authenticated
  USING (public.is_principal());


-- LEADS
DROP POLICY IF EXISTS "leads_select_staff" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_staff" ON public.leads;
DROP POLICY IF EXISTS "leads_update_assigned_or_principal" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_principal" ON public.leads;

CREATE POLICY "leads_select_staff"
  ON public.leads FOR SELECT TO authenticated
  USING (
    public.is_principal()
    OR assigned_profile_id = auth.uid()
    OR public.is_staff()
  );

CREATE POLICY "leads_insert_staff"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "leads_update_assigned_or_principal"
  ON public.leads FOR UPDATE TO authenticated
  USING (public.is_principal() OR assigned_profile_id = auth.uid())
  WITH CHECK (public.is_principal() OR assigned_profile_id = auth.uid());

CREATE POLICY "leads_delete_principal"
  ON public.leads FOR DELETE TO authenticated
  USING (public.is_principal());


-- QUOTES
DROP POLICY IF EXISTS "quotes_select_staff" ON public.quotes;
DROP POLICY IF EXISTS "quotes_insert_staff" ON public.quotes;
DROP POLICY IF EXISTS "quotes_update_staff" ON public.quotes;
DROP POLICY IF EXISTS "quotes_delete_principal" ON public.quotes;

CREATE POLICY "quotes_select_staff"
  ON public.quotes FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "quotes_insert_staff"
  ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "quotes_update_staff"
  ON public.quotes FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "quotes_delete_principal"
  ON public.quotes FOR DELETE TO authenticated
  USING (public.is_principal());


-- POLICIES
DROP POLICY IF EXISTS "policies_select_staff" ON public.policies;
DROP POLICY IF EXISTS "policies_insert_staff" ON public.policies;
DROP POLICY IF EXISTS "policies_update_staff" ON public.policies;
DROP POLICY IF EXISTS "policies_delete_principal" ON public.policies;

CREATE POLICY "policies_select_staff"
  ON public.policies FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "policies_insert_staff"
  ON public.policies FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "policies_update_staff"
  ON public.policies FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "policies_delete_principal"
  ON public.policies FOR DELETE TO authenticated
  USING (public.is_principal());


-- COMMISSIONS
DROP POLICY IF EXISTS "commissions_select_own_or_principal" ON public.commissions;
DROP POLICY IF EXISTS "commissions_insert_principal_or_bookkeeper" ON public.commissions;
DROP POLICY IF EXISTS "commissions_update_principal_or_bookkeeper" ON public.commissions;
DROP POLICY IF EXISTS "commissions_delete_principal" ON public.commissions;

CREATE POLICY "commissions_select_own_or_principal"
  ON public.commissions FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.is_principal() OR public.current_user_role() = 'bookkeeper');

CREATE POLICY "commissions_insert_principal_or_bookkeeper"
  ON public.commissions FOR INSERT TO authenticated
  WITH CHECK (public.is_principal() OR public.current_user_role() = 'bookkeeper');

CREATE POLICY "commissions_update_principal_or_bookkeeper"
  ON public.commissions FOR UPDATE TO authenticated
  USING (public.is_principal() OR public.current_user_role() = 'bookkeeper')
  WITH CHECK (public.is_principal() OR public.current_user_role() = 'bookkeeper');

CREATE POLICY "commissions_delete_principal"
  ON public.commissions FOR DELETE TO authenticated
  USING (public.is_principal());


-- ENGAGEMENTS
DROP POLICY IF EXISTS "engagements_select_staff" ON public.engagements;
DROP POLICY IF EXISTS "engagements_insert_staff" ON public.engagements;
DROP POLICY IF EXISTS "engagements_update_staff" ON public.engagements;
DROP POLICY IF EXISTS "engagements_delete_principal" ON public.engagements;

CREATE POLICY "engagements_select_staff"
  ON public.engagements FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "engagements_insert_staff"
  ON public.engagements FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "engagements_update_staff"
  ON public.engagements FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "engagements_delete_principal"
  ON public.engagements FOR DELETE TO authenticated
  USING (public.is_principal());


-- CHART OF ACCOUNTS
DROP POLICY IF EXISTS "coa_select_staff" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "coa_insert_staff" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "coa_update_staff" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "coa_delete_principal" ON public.chart_of_accounts;

CREATE POLICY "coa_select_staff"
  ON public.chart_of_accounts FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "coa_insert_staff"
  ON public.chart_of_accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "coa_update_staff"
  ON public.chart_of_accounts FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "coa_delete_principal"
  ON public.chart_of_accounts FOR DELETE TO authenticated
  USING (public.is_principal());


-- TAX RETURNS
DROP POLICY IF EXISTS "tax_returns_select_staff" ON public.tax_returns;
DROP POLICY IF EXISTS "tax_returns_insert_staff" ON public.tax_returns;
DROP POLICY IF EXISTS "tax_returns_update_staff" ON public.tax_returns;
DROP POLICY IF EXISTS "tax_returns_delete_principal" ON public.tax_returns;

CREATE POLICY "tax_returns_select_staff"
  ON public.tax_returns FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "tax_returns_insert_staff"
  ON public.tax_returns FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "tax_returns_update_staff"
  ON public.tax_returns FOR UPDATE TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "tax_returns_delete_principal"
  ON public.tax_returns FOR DELETE TO authenticated
  USING (public.is_principal());


-- SUB_PREPARERS
DROP POLICY IF EXISTS "sub_preparers_select_staff" ON public.sub_preparers;
DROP POLICY IF EXISTS "sub_preparers_mutate_principal" ON public.sub_preparers;

CREATE POLICY "sub_preparers_select_staff"
  ON public.sub_preparers FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "sub_preparers_mutate_principal"
  ON public.sub_preparers FOR ALL TO authenticated
  USING (public.is_principal())
  WITH CHECK (public.is_principal());


-- SOFTWARE_LICENSES
DROP POLICY IF EXISTS "software_licenses_select_staff" ON public.software_licenses;
DROP POLICY IF EXISTS "software_licenses_mutate_principal" ON public.software_licenses;

CREATE POLICY "software_licenses_select_staff"
  ON public.software_licenses FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "software_licenses_mutate_principal"
  ON public.software_licenses FOR ALL TO authenticated
  USING (public.is_principal())
  WITH CHECK (public.is_principal());


-- AUDIT_LOG
DROP POLICY IF EXISTS "audit_insert_own" ON public.audit_log;
DROP POLICY IF EXISTS "audit_select_principal" ON public.audit_log;
DROP POLICY IF EXISTS "Allow authenticated insert to audit log" ON public.audit_log;
DROP POLICY IF EXISTS "Principals can view audit logs" ON public.audit_log;

CREATE POLICY "audit_insert_own"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "audit_select_principal"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_principal());


-- ====================================================================
-- DONE
-- ====================================================================
-- Also run: expense-iq/supabase/schema.sql for Expense IQ org tables.
-- Auth → enable "Confirm email" (required for production gate).
-- Set BFF.config.PAYWALL.freePreview = false when Stripe is live.
