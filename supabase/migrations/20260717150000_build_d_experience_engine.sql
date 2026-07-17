-- Build D Migration: Release Preparation & Experience Engine

-- 1. Create Hero Videos Table
CREATE TABLE IF NOT EXISTS public.hero_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Create Trust Features Table
CREATE TABLE IF NOT EXISTS public.trust_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon_name text NOT NULL, -- e.g. "Shield", "Truck", "CreditCard", "Headphones"
  title text NOT NULL,
  description text NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Create Experience Security Audit Logs
CREATE TABLE IF NOT EXISTS public.experience_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS experience_audit_logs_user_idx ON public.experience_audit_logs(user_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.hero_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Define Security Policies
-- SELECT policies for public
CREATE POLICY "Anyone can view active hero videos" ON public.hero_videos FOR SELECT
  USING (is_active = true);

CREATE POLICY "Anyone can view trust features" ON public.trust_features FOR SELECT
  USING (true);

-- Admins manage everything
CREATE POLICY "Admins manage hero videos" ON public.hero_videos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins manage trust features" ON public.trust_features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admins read and write audit logs" ON public.experience_audit_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- 6. Grant Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_videos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trust_features TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experience_audit_logs TO authenticated;

GRANT SELECT ON public.hero_videos TO anon;
GRANT SELECT ON public.trust_features TO anon;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 7. Seed Initial Experience Data
INSERT INTO public.hero_videos (id, url, order_index, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-interior-design-39908-large.mp4', 0, true),
  ('a0000000-0000-0000-0000-000000000002', 'https://assets.mixkit.co/videos/preview/mixkit-architectural-model-design-details-39909-large.mp4', 1, true),
  ('a0000000-0000-0000-0000-000000000003', 'https://assets.mixkit.co/videos/preview/mixkit-spinning-architectural-plans-39910-large.mp4', 2, true)
ON CONFLICT (id) DO UPDATE SET
  url = excluded.url,
  order_index = excluded.order_index,
  is_active = excluded.is_active;

INSERT INTO public.trust_features (id, icon_name, title, description, order_index)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Shield', 'Premium Quality', 'Top grade luxury tiles and doors sourced from world-class manufacturers.', 0),
  ('b0000000-0000-0000-0000-000000000002', 'Truck', 'Nationwide Delivery', 'Safe, secured logistical dispatch to all states across Nigeria.', 1),
  ('b0000000-0000-0000-0000-000000000003', 'CreditCard', 'Secure Payment', '100% secure escrow verification and transaction logging.', 2),
  ('b0000000-0000-0000-0000-000000000004', 'Headphones', '24/7 Expert Support', 'Professional customer assistance from project specialists.', 3)
ON CONFLICT (id) DO UPDATE SET
  icon_name = excluded.icon_name,
  title = excluded.title,
  description = excluded.description,
  order_index = excluded.order_index;
