
-- Pipeline status enum
DO $$ BEGIN
  CREATE TYPE public.inquiry_pipeline_status AS ENUM ('NEW','CONTACTED','NEGOTIATING','QUOTED','CLOSED','LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- whatsapp_inquiries extensions
ALTER TABLE public.whatsapp_inquiries
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS inquiry_status public.inquiry_pipeline_status NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_whatsapp_inquiries_inquiry_status ON public.whatsapp_inquiries(inquiry_status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inquiries_assigned_admin ON public.whatsapp_inquiries(assigned_admin_id);

-- collections extensions
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS inquiry_status public.inquiry_pipeline_status NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_collections_inquiry_status ON public.collections(inquiry_status);

-- Generic updated_at trigger (function already exists, just attach)
DROP TRIGGER IF EXISTS set_whatsapp_inquiries_updated_at ON public.whatsapp_inquiries;
CREATE TRIGGER set_whatsapp_inquiries_updated_at
BEFORE UPDATE ON public.whatsapp_inquiries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_collections_updated_at ON public.collections;
CREATE TRIGGER set_collections_updated_at
BEFORE UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Stamp last_contacted_at when inquiry_status changes
CREATE OR REPLACE FUNCTION public.stamp_inquiry_last_contacted()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.inquiry_status IS DISTINCT FROM OLD.inquiry_status THEN
    NEW.last_contacted_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_inquiry_last_contacted ON public.whatsapp_inquiries;
CREATE TRIGGER stamp_inquiry_last_contacted
BEFORE UPDATE ON public.whatsapp_inquiries
FOR EACH ROW EXECUTE FUNCTION public.stamp_inquiry_last_contacted();

-- RLS: admins + super_admins manage all inquiries / collections
DROP POLICY IF EXISTS "Admins manage all inquiries" ON public.whatsapp_inquiries;
CREATE POLICY "Admins manage all inquiries" ON public.whatsapp_inquiries
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "Admins manage all collections" ON public.collections;
CREATE POLICY "Admins manage all collections" ON public.collections
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
