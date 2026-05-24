
-- 1) Fix search_path on plpgsql functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.normalize_phone_br(text) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 2) Make views run as invoker (respects caller RLS)
ALTER VIEW public.platform_branding_public SET (security_invoker = true);
ALTER VIEW public.v_agent_quality_30d SET (security_invoker = true);
ALTER VIEW public.public_booking_profiles SET (security_invoker = true);
