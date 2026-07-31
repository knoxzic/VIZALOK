-- Public web contact → leads (safe re-run)
-- Allows anonymous inserts for marketing site Contact form only.

-- Optional free-form note column for intake description
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Public insert (anon + authenticated) for web forms
DROP POLICY IF EXISTS "leads_insert_public_web" ON public.leads;
CREATE POLICY "leads_insert_public_web"
  ON public.leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    contact_name IS NOT NULL
    AND length(trim(contact_name)) > 0
    AND email IS NOT NULL
    AND length(trim(email)) > 3
  );

-- Note: SELECT remains staff-only via existing policies.
