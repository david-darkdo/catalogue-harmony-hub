
-- App settings (single-row company contact info), publicly readable
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_whatsapp text,
  sales_whatsapp text,
  company_email text,
  company_address text,
  map_url text,
  facebook_url text,
  instagram_url text,
  tiktok_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App settings are publicly readable"
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert app settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete app settings"
  ON public.app_settings FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial row
INSERT INTO public.app_settings (
  support_whatsapp, sales_whatsapp, company_email, company_address,
  map_url, facebook_url, instagram_url, tiktok_url
) VALUES (
  '+1234567890', '+1234567890', 'hello@stoneworks.example',
  '123 Stoneworks Ave, Showroom District',
  'https://maps.google.com/?q=Stoneworks',
  'https://facebook.com/stoneworks',
  'https://instagram.com/stoneworks',
  'https://tiktok.com/@stoneworks'
);

-- Allow guests to create whatsapp inquiries (public lead capture)
DROP POLICY IF EXISTS "Anyone can create whatsapp inquiries" ON public.whatsapp_inquiries;
CREATE POLICY "Anyone can create whatsapp inquiries"
  ON public.whatsapp_inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Make collection readable when shared via link (public collections via id)
DROP POLICY IF EXISTS "Collections readable by anyone with id" ON public.collections;
CREATE POLICY "Collections readable by anyone with id"
  ON public.collections FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Collection items readable by anyone" ON public.collection_items;
CREATE POLICY "Collection items readable by anyone"
  ON public.collection_items FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.collections TO anon;
GRANT SELECT ON public.collection_items TO anon;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (auth_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (auth_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
