CREATE OR REPLACE FUNCTION public.recompute_org_temperatures(_organization_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
  _lead_id uuid;
BEGIN
  FOR _lead_id IN
    SELECT id FROM public.leads
    WHERE organization_id = _organization_id
      AND COALESCE(temperature_manual_override, false) = false
  LOOP
    PERFORM public.compute_lead_temperature(_lead_id);
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_org_temperatures(uuid) TO authenticated;