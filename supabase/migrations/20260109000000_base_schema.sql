-- Base schema: enums and core tables created outside migrations in the original project.
-- Must run before all other migrations.

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'seller', 'super_admin');
CREATE TYPE public.interaction_channel AS ENUM ('whatsapp', 'email', 'phone', 'instagram', 'telegram', 'other');
CREATE TYPE public.lead_temperature AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE public.notification_type AS ENUM ('cadence', 'urgency', 'opportunity', 'audit', 'system');
CREATE TYPE public.product_status AS ENUM ('draft', 'review', 'published', 'archived');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue');

-- 1. organizations (no deps)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    cnpj TEXT,
    logo_url TEXT,
    address JSONB,
    settings JSONB,
    features JSONB,
    status TEXT,
    owner_id UUID,
    plan_id TEXT,
    max_users INTEGER,
    max_products INTEGER,
    max_connections INTEGER,
    payment_policy TEXT,
    refund_policy TEXT,
    cakto_subscription_id TEXT,
    cakto_customer_email TEXT,
    presence_enabled BOOLEAN NOT NULL DEFAULT false,
    presence_jitter_pct NUMERIC NOT NULL DEFAULT 0.2,
    presence_recording_enabled BOOLEAN NOT NULL DEFAULT false,
    presence_typing_chars_per_sec NUMERIC NOT NULL DEFAULT 8,
    ai_debounce_ms INTEGER NOT NULL DEFAULT 1500,
    ai_dedup_enabled BOOLEAN NOT NULL DEFAULT true,
    ai_dedup_window_ms INTEGER NOT NULL DEFAULT 5000,
    ai_grouping_enabled BOOLEAN NOT NULL DEFAULT true,
    ai_grouping_window_ms INTEGER NOT NULL DEFAULT 3000,
    ai_grouping_max_ms INTEGER NOT NULL DEFAULT 10000,
    ai_typing_min_ms INTEGER NOT NULL DEFAULT 1000,
    ai_typing_max_ms INTEGER NOT NULL DEFAULT 4000,
    ai_single_processing_per_conversation BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. profiles (depends on organizations)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    default_theme TEXT,
    default_menu_state TEXT,
    default_connection_id UUID,
    booking_slug TEXT,
    booking_bio TEXT,
    farewell_message TEXT,
    work_start_time TEXT,
    work_end_time TEXT,
    recovery_whatsapp TEXT,
    guided_onboarding_completed_at TIMESTAMPTZ,
    guided_onboarding_skipped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. products (depends on organizations)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    status public.product_status DEFAULT 'draft',
    logo_url TEXT,
    banner_url TEXT,
    product_image_url TEXT,
    category TEXT,
    pricing JSONB,
    pitch_15s TEXT,
    pitch_30s TEXT,
    pitch_2min TEXT,
    icp TEXT,
    benefits TEXT,
    bonuses TEXT,
    guarantee TEXT,
    objections TEXT,
    knowledge_base TEXT,
    differentials TEXT[],
    payment_conditions TEXT,
    discount_policy TEXT,
    plans TEXT,
    external_links JSONB,
    settings JSONB,
    suite_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. pipeline_stages (depends on products)
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_won BOOLEAN DEFAULT false,
    is_lost BOOLEAN DEFAULT false,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. leads (depends on organizations, products, pipeline_stages)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    phone_normalized TEXT,
    company TEXT,
    position TEXT,
    notes TEXT,
    source TEXT,
    lead_origin TEXT,
    lead_channel TEXT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    current_stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
    assigned_to UUID,
    previous_assigned_to UUID,
    sdr_id UUID,
    closer_id UUID,
    deal_value NUMERIC,
    expected_close_date TIMESTAMPTZ,
    last_contact_at TIMESTAMPTZ,
    next_action TEXT,
    temperature public.lead_temperature,
    temperature_score NUMERIC,
    temperature_manual_override BOOLEAN NOT NULL DEFAULT false,
    temperature_updated_at TIMESTAMPTZ,
    bant_budget TEXT,
    bant_authority TEXT,
    bant_need TEXT,
    bant_timing TEXT,
    transfer_reason TEXT,
    transferred_at TIMESTAMPTZ,
    transferred_by UUID,
    cadence_day INTEGER,
    sector_id UUID,
    squad_id UUID,
    landing_page TEXT,
    referrer_url TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    utm_term TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. notifications (depends on products; admin_notifications FK added later by migration)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    type public.notification_type NOT NULL DEFAULT 'system',
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    metadata JSONB,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    admin_notification_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. webhooks (depends on organizations, products)
CREATE TABLE IF NOT EXISTS public.webhooks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    squad_id UUID,
    description TEXT,
    actions JSONB,
    identification_config JSONB,
    allowed_ips TEXT[],
    secret_key TEXT,
    is_active BOOLEAN DEFAULT true,
    is_test_mode BOOLEAN DEFAULT false,
    requests_count INTEGER DEFAULT 0,
    requests_this_month INTEGER DEFAULT 0,
    last_request_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. tasks (depends on leads, products, profiles)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT,
    status public.task_status,
    priority public.task_priority,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    user_id UUID NOT NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. user_product_assignments (depends on products)
CREATE TABLE IF NOT EXISTS public.user_product_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    assigned_by UUID,
    monthly_goal NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. webhook_logs (depends on leads, webhooks)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    request_method TEXT NOT NULL,
    request_headers JSONB,
    request_body JSONB,
    request_ip TEXT,
    parsed_fields JSONB,
    actions_executed JSONB,
    status TEXT,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. lead_stage_history (depends on leads, pipeline_stages)
CREATE TABLE IF NOT EXISTS public.lead_stage_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    exited_at TIMESTAMPTZ,
    days_in_stage NUMERIC
);

-- 12. user_roles (no FK deps on missing tables; auth.users implicit)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    role public.app_role NOT NULL DEFAULT 'seller',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Standard trigger function used by updated_at triggers across all migrations
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Helper functions used by RLS policies across all migrations
CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(org_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = user_id AND profiles.organization_id = org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = _user_id AND user_roles.role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization(user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, check_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1 AND user_roles.role = $2
  );
$$;

-- Enable RLS (Row Level Security) on base tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_product_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_stage_history ENABLE ROW LEVEL SECURITY;
