
-- profiles: vip + tags
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vip_status boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];

DO $$ BEGIN CREATE TYPE public.account_status AS ENUM ('ACTIVE','SUSPENDED','BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS account_status public.account_status NOT NULL DEFAULT 'ACTIVE';

DO $$ BEGIN CREATE TYPE public.customer_note_type AS ENUM ('GENERAL','SALES','SUPPORT','VIP','FOLLOW_UP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  note text NOT NULL,
  note_type public.customer_note_type NOT NULL DEFAULT 'GENERAL',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_notes_customer_id_idx ON public.customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS customer_notes_created_at_idx ON public.customer_notes(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE TYPE public.email_campaign_status AS ENUM ('DRAFT','READY','SENDING','SENT','FAILED','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  banner_url text,
  body text NOT NULL DEFAULT '',
  target_segment text NOT NULL DEFAULT 'all_users',
  status public.email_campaign_status NOT NULL DEFAULT 'DRAFT',
  scheduled_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_campaigns_status_idx ON public.email_campaigns(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS email_campaigns_updated_at ON public.email_campaigns;
CREATE TRIGGER email_campaigns_updated_at BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.email_campaign_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_campaign_logs_campaign_idx ON public.email_campaign_logs(campaign_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaign_logs TO authenticated;
GRANT ALL ON public.email_campaign_logs TO service_role;
ALTER TABLE public.email_campaign_logs ENABLE ROW LEVEL SECURITY;

-- Policies (drop+recreate is idempotent; CREATE POLICY IF NOT EXISTS isn't supported)
DROP POLICY IF EXISTS "Admins read customer notes" ON public.customer_notes;
CREATE POLICY "Admins read customer notes" ON public.customer_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "Admins insert customer notes" ON public.customer_notes;
CREATE POLICY "Admins insert customer notes" ON public.customer_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "Admins update customer notes" ON public.customer_notes;
CREATE POLICY "Admins update customer notes" ON public.customer_notes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "Admins delete customer notes" ON public.customer_notes;
CREATE POLICY "Admins delete customer notes" ON public.customer_notes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Admins manage campaigns" ON public.email_campaigns;
CREATE POLICY "Admins manage campaigns" ON public.email_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Admins manage campaign logs" ON public.email_campaign_logs;
CREATE POLICY "Admins manage campaign logs" ON public.email_campaign_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Admins read all user_roles" ON public.user_roles;
CREATE POLICY "Admins read all user_roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "Admins update user_roles" ON public.user_roles;
CREATE POLICY "Admins update user_roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Admins read all collections" ON public.collections;
CREATE POLICY "Admins read all collections" ON public.collections FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
DROP POLICY IF EXISTS "Admins update all collections" ON public.collections;
CREATE POLICY "Admins update all collections" ON public.collections FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Extend inquiry_pipeline_status with additional stages
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['NEW','CONTACTED','NEGOTIATING','QUOTED','CLOSED','LOST'] LOOP
    BEGIN
      EXECUTE format('ALTER TYPE public.inquiry_pipeline_status ADD VALUE IF NOT EXISTS %L', v);
    EXCEPTION WHEN others THEN NULL; END;
  END LOOP;
END $$;
