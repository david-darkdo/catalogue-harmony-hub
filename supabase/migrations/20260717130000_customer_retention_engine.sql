-- Build C Migration: Customer Retention Engine & Unified Communication system

-- 1. Rename existing tables and adjust constraints
ALTER TABLE IF EXISTS public.email_campaigns RENAME TO communication_campaigns;
ALTER TABLE IF EXISTS public.email_campaign_logs RENAME TO communication_delivery_logs;

-- Adjust table columns for communication_campaigns
ALTER TABLE public.communication_campaigns ADD COLUMN IF NOT EXISTS channel_types text[] DEFAULT '{"email"}'::text[];
ALTER TABLE public.communication_campaigns ADD COLUMN IF NOT EXISTS requested_review_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.communication_campaigns ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.communication_campaigns ADD COLUMN IF NOT EXISTS approval_notes text;
ALTER TABLE public.communication_campaigns ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false;
ALTER TABLE public.communication_campaigns ADD COLUMN IF NOT EXISTS ai_generation_metadata jsonb DEFAULT '{}'::jsonb;

-- Adjust table columns for communication_delivery_logs
ALTER TABLE public.communication_delivery_logs ADD COLUMN IF NOT EXISTS channel_type text DEFAULT 'email';
ALTER TABLE public.communication_delivery_logs ADD COLUMN IF NOT EXISTS device_token text;
ALTER TABLE public.communication_delivery_logs ADD COLUMN IF NOT EXISTS processing_time_ms integer;

-- 2. Create Global Communication/System Event Bus Table
CREATE TABLE IF NOT EXISTS public.communication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS communication_events_type_idx ON public.communication_events(event_type);
CREATE INDEX IF NOT EXISTS communication_events_user_idx ON public.communication_events(user_id);

-- 3. Create Customer Activity Log (Timeline)
CREATE TABLE IF NOT EXISTS public.customer_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS customer_activity_user_idx ON public.customer_activity(user_id);

-- 4. Create Customer Category/Brand Interests
CREATE TABLE IF NOT EXISTS public.customer_interests (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  score numeric DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, category)
);

-- 5. Create Customer Engagement Scores
CREATE TABLE IF NOT EXISTS public.customer_scores (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  health_score integer DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100) NOT NULL,
  segment text DEFAULT 'NEW' NOT NULL,
  manual_tags text[] DEFAULT '{}'::text[] NOT NULL,
  auto_tags text[] DEFAULT '{}'::text[] NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 6. Create Communication Devices PWA Table
CREATE TABLE IF NOT EXISTS public.communication_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_type text DEFAULT 'web_pwa' NOT NULL,
  os_version text,
  browser text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS communication_devices_user_idx ON public.communication_devices(user_id);

-- 7. Create Communication Preferences Table (Granular Event Channels)
CREATE TABLE IF NOT EXISTS public.communication_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  receive_marketing boolean DEFAULT true NOT NULL,
  receive_transactional boolean DEFAULT true NOT NULL,
  per_event_channels jsonb DEFAULT '{
    "product_updates": {"email": true, "push": true},
    "recommendations": {"email": true, "push": false},
    "price_drops": {"email": true, "push": true},
    "collection_reminders": {"email": true, "push": true}
  }'::jsonb NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 8. Create Multi-Channel Communication Templates & History Tables
CREATE TABLE IF NOT EXISTS public.communication_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  email_subject text,
  email_html text,
  push_title text,
  push_body text,
  variables jsonb DEFAULT '[]'::jsonb NOT NULL, -- e.g. ["customer_name", "product_name"]
  ai_generation_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.communication_templates_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.communication_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  email_subject text,
  email_html text,
  push_title text,
  push_body text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS template_history_idx ON public.communication_templates_history(template_id);

-- 9. Create Campaign Assets Table
CREATE TABLE IF NOT EXISTS public.communication_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.communication_campaigns(id) ON DELETE CASCADE,
  url text NOT NULL,
  asset_type text NOT NULL, -- banner, thumbnail, logo, media
  alt_text text,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS communication_assets_campaign_idx ON public.communication_assets(campaign_id);

-- 10. Create Delivery Queue Table
CREATE TABLE IF NOT EXISTS public.communication_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.communication_campaigns(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.communication_templates(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_type text NOT NULL, -- email, push
  recipient_address text, -- email or device push token
  subject text,
  body text,
  status text DEFAULT 'PENDING' NOT NULL, -- PENDING, PROCESSING, SENT, FAILED, DLQ
  retry_count integer DEFAULT 0 NOT NULL,
  max_retries integer DEFAULT 3 NOT NULL,
  error_log text,
  scheduled_for timestamptz DEFAULT now() NOT NULL,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS communication_queue_status_idx ON public.communication_queue(status);
CREATE INDEX IF NOT EXISTS communication_queue_scheduled_idx ON public.communication_queue(scheduled_for);

-- 11. Create Automation Engine Tables (Workflows, Steps, Runs)
CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL, -- user_login, product_viewed, favorites_changed, price_drop, collection_abandoned
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.automation_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  action_type text NOT NULL, -- send_template, wait
  template_id uuid REFERENCES public.communication_templates(id) ON DELETE SET NULL,
  wait_duration_seconds integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS automation_steps_wf_idx ON public.automation_steps(workflow_id);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.automation_workflows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_step_id uuid REFERENCES public.automation_steps(id) ON DELETE SET NULL,
  status text DEFAULT 'RUNNING' NOT NULL, -- RUNNING, COMPLETED, FAILED
  next_run_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS automation_runs_next_run_idx ON public.automation_runs(next_run_at) WHERE status = 'RUNNING';

-- 12. Create Client Favorites, Saved Searches, and Recently Viewed Tables
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  query text NOT NULL,
  filters jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS saved_searches_user_idx ON public.saved_searches(user_id);

CREATE TABLE IF NOT EXISTS public.recently_viewed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS recently_viewed_user_idx ON public.recently_viewed(user_id);

-- 13. Database Triggers for Automatic Preference and Score Seeding
CREATE OR REPLACE FUNCTION public.handle_new_profile_retention_setup()
RETURNS trigger AS $$
BEGIN
  -- Insert default preferences
  INSERT INTO public.communication_preferences (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert default customer scores
  INSERT INTO public.customer_scores (user_id, health_score, segment)
  VALUES (new.id, 100, 'NEW')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_profile_created_retention
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile_retention_setup();

-- 14. Enable Row Level Security (RLS) and Grant Permissions
ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_templates_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recently_viewed ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 15. Create RLS Policies for All New Tables

-- Admin Policy Helper Subqueries
CREATE POLICY "Admins manage communication campaigns" ON public.communication_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins manage communication delivery logs" ON public.communication_delivery_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins manage communication events" ON public.communication_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Users can insert events under their own ID, and read them
CREATE POLICY "Users insert own events" ON public.communication_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own events" ON public.communication_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Customer Activity Policies
CREATE POLICY "Admins manage customer activity" ON public.customer_activity FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Users read own activity" ON public.customer_activity FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own activity" ON public.customer_activity FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Customer Interests Policies
CREATE POLICY "Admins manage customer interests" ON public.customer_interests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Users read own interests" ON public.customer_interests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Customer Scores Policies
CREATE POLICY "Admins manage customer scores" ON public.customer_scores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Users read own scores" ON public.customer_scores FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Devices Policies
CREATE POLICY "Admins manage devices" ON public.communication_devices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Users manage own devices" ON public.communication_devices FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Preferences Policies
CREATE POLICY "Admins manage preferences" ON public.communication_preferences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Users manage own preferences" ON public.communication_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Templates and History Policies
CREATE POLICY "Admins manage templates" ON public.communication_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins manage templates history" ON public.communication_templates_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Assets Policies
CREATE POLICY "Admins manage communication assets" ON public.communication_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Queue Policies
CREATE POLICY "Admins manage queue" ON public.communication_queue FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Automation Workflows, Steps, Runs
CREATE POLICY "Admins manage workflows" ON public.automation_workflows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins manage steps" ON public.automation_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins manage runs" ON public.automation_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Favorites Policies
CREATE POLICY "Users manage own favorites" ON public.favorites FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read favorites" ON public.favorites FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Saved Searches Policies
CREATE POLICY "Users manage own saved searches" ON public.saved_searches FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read saved searches" ON public.saved_searches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Recently Viewed Policies
CREATE POLICY "Users manage own recently viewed" ON public.recently_viewed FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read recently viewed" ON public.recently_viewed FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- 16. Seed Seed Data for Workflows and default templates
INSERT INTO public.communication_templates (id, name, description, email_subject, email_html, push_title, push_body, variables)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'welcome_series_email_1', 'Welcome series email template', 'Welcome to Enreach Concepts, {{customer_name}}!', '<h1>Welcome, {{customer_name}}!</h1><p>We are thrilled to have you join our digital showroom. Explore our latest collections today!</p>', 'Welcome to Enreach!', 'Hi {{customer_name}}, thanks for joining us! Tap to browse.', '["customer_name"]'::jsonb),
  ('00000000-0000-0000-0000-000000000002', 'abandoned_collection_reminder', 'Abandoned collection follow-up', 'Did you forget something, {{customer_name}}?', '<p>Hi {{customer_name}}, we noticed you left some designs in your collection. Click here to check them out again!</p>', 'Forgotten Collection Reminder', 'Hi {{customer_name}}, items are waiting in your collection. Tap to open.', '["customer_name"]'::jsonb),
  ('00000000-0000-0000-0000-000000000003', 'inactive_customer_reengagement', 'Re-engage inactive customers', 'We miss you, {{customer_name}}!', '<p>Hi {{customer_name}}, we have not seen you around lately. Check out our latest products just added to the catalog!</p>', 'We miss you!', 'Hi {{customer_name}}, check out our brand new showcase items.', '["customer_name"]'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  description = excluded.description,
  email_subject = excluded.email_subject,
  email_html = excluded.email_html,
  push_title = excluded.push_title,
  push_body = excluded.push_body,
  variables = excluded.variables;

INSERT INTO public.automation_workflows (id, name, description, trigger_type, is_active)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Welcome Journey', 'Triggers immediately when a user creates their profile', 'user_login', true),
  ('22222222-2222-2222-2222-222222222222', 'Abandoned Collection Tracker', 'Follows up when collections are left inactive', 'collection_abandoned', true),
  ('33333333-3333-3333-3333-333333333333', 'Re-engagement Workflow', 'Encourages users to view products after period of inactivity', 'price_drop', true)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  trigger_type = excluded.trigger_type,
  is_active = excluded.is_active;

INSERT INTO public.automation_steps (id, workflow_id, step_number, action_type, template_id, wait_duration_seconds)
VALUES
  ('11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 1, 'send_template', '00000000-0000-0000-0000-000000000001', 0),
  ('22222222-2222-2222-2222-222222222223', '22222222-2222-2222-2222-222222222222', 1, 'send_template', '00000000-0000-0000-0000-000000000002', 86400),
  ('33333333-3333-3333-3333-333333333334', '33333333-3333-3333-3333-333333333333', 1, 'send_template', '00000000-0000-0000-0000-000000000003', 604800)
ON CONFLICT (id) DO UPDATE SET
  step_number = excluded.step_number,
  action_type = excluded.action_type,
  template_id = excluded.template_id,
  wait_duration_seconds = excluded.wait_duration_seconds;
