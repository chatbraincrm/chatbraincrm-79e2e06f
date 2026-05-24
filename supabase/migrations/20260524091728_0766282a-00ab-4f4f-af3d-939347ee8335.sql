
CREATE TABLE IF NOT EXISTS public.lead_temperature_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  hot_threshold INTEGER NOT NULL DEFAULT 70 CHECK (hot_threshold BETWEEN 1 AND 100),
  cold_threshold INTEGER NOT NULL DEFAULT 35 CHECK (cold_threshold BETWEEN 0 AND 99),
  weight_bant INTEGER NOT NULL DEFAULT 40 CHECK (weight_bant BETWEEN 0 AND 100),
  weight_recency INTEGER NOT NULL DEFAULT 25 CHECK (weight_recency BETWEEN 0 AND 100),
  weight_engagement INTEGER NOT NULL DEFAULT 15 CHECK (weight_engagement BETWEEN 0 AND 100),
  weight_stage INTEGER NOT NULL DEFAULT 20 CHECK (weight_stage BETWEEN 0 AND 100),
  recency_cold_after_days INTEGER NOT NULL DEFAULT 14 CHECK (recency_cold_after_days BETWEEN 1 AND 365),
  engagement_full_at_messages INTEGER NOT NULL DEFAULT 20 CHECK (engagement_full_at_messages BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_temperature_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org temperature rules"
  ON public.lead_temperature_rules FOR SELECT
  USING (
    organization_id = public.get_user_organization(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Admins can manage org temperature rules"
  ON public.lead_temperature_rules FOR ALL
  USING (
    (organization_id = public.get_user_organization(auth.uid())
      AND public.has_role(auth.uid(), 'admin'))
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    (organization_id = public.get_user_organization(auth.uid())
      AND public.has_role(auth.uid(), 'admin'))
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER trg_lead_temperature_rules_updated_at
  BEFORE UPDATE ON public.lead_temperature_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.lead_temperature_rules (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_default_temperature_rules()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.lead_temperature_rules (organization_id)
  VALUES (NEW.id) ON CONFLICT (organization_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_default_temperature_rules ON public.organizations;
CREATE TRIGGER trg_create_default_temperature_rules
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.create_default_temperature_rules();

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS temperature_manual_override BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temperature_score INTEGER,
  ADD COLUMN IF NOT EXISTS temperature_updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.compute_lead_temperature(_lead_id UUID)
RETURNS TABLE(score INTEGER, temperature lead_temperature)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _lead RECORD; _rules RECORD;
  _bant_filled INTEGER := 0; _bant_total INTEGER := 17;
  _bant_pts NUMERIC := 0; _recency_pts NUMERIC := 0;
  _engagement_pts NUMERIC := 0; _stage_pts NUMERIC := 0;
  _final NUMERIC := 0; _hours_since NUMERIC; _max_hours NUMERIC;
  _msg_count INTEGER := 0; _stage_order INTEGER; _max_stage_order INTEGER;
  _temp lead_temperature; _category JSONB;
  _category_text TEXT; _key TEXT; _val TEXT; _weight_sum INTEGER;
BEGIN
  SELECT * INTO _lead FROM public.leads WHERE id = _lead_id;
  IF NOT FOUND THEN RETURN QUERY SELECT 0, 'cold'::lead_temperature; RETURN; END IF;

  SELECT * INTO _rules FROM public.lead_temperature_rules WHERE organization_id = _lead.organization_id;
  IF NOT FOUND THEN
    INSERT INTO public.lead_temperature_rules (organization_id) VALUES (_lead.organization_id)
    ON CONFLICT (organization_id) DO NOTHING;
    SELECT * INTO _rules FROM public.lead_temperature_rules WHERE organization_id = _lead.organization_id;
  END IF;

  FOREACH _category_text IN ARRAY ARRAY[
    COALESCE(_lead.bant_budget,''), COALESCE(_lead.bant_authority,''),
    COALESCE(_lead.bant_need,''),   COALESCE(_lead.bant_timing,'')
  ] LOOP
    IF _category_text <> '' AND LEFT(_category_text,1) = '{' THEN
      BEGIN
        _category := _category_text::JSONB;
        FOR _key, _val IN SELECT * FROM jsonb_each_text(_category) LOOP
          IF _val IS NOT NULL AND length(trim(_val)) > 0 THEN
            _bant_filled := _bant_filled + 1;
          END IF;
        END LOOP;
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END LOOP;
  _bant_pts := LEAST(_bant_filled,_bant_total)::NUMERIC/_bant_total::NUMERIC*_rules.weight_bant;

  IF _lead.last_contact_at IS NOT NULL THEN
    _hours_since := EXTRACT(EPOCH FROM (now()-_lead.last_contact_at))/3600.0;
    _max_hours := _rules.recency_cold_after_days*24.0;
    IF _hours_since <= 24 THEN _recency_pts := _rules.weight_recency;
    ELSIF _hours_since >= _max_hours THEN _recency_pts := 0;
    ELSE _recency_pts := _rules.weight_recency*(1-(_hours_since-24)/(_max_hours-24)); END IF;
  END IF;

  SELECT COUNT(*) INTO _msg_count FROM public.webchat_messages m
  JOIN public.webchat_conversations c ON c.id=m.conversation_id
  WHERE c.lead_id=_lead_id AND m.direction='inbound';
  _engagement_pts := LEAST(_msg_count,_rules.engagement_full_at_messages)::NUMERIC
                   /_rules.engagement_full_at_messages::NUMERIC*_rules.weight_engagement;

  IF _lead.current_stage_id IS NOT NULL THEN
    SELECT order_index INTO _stage_order FROM public.pipeline_stages WHERE id=_lead.current_stage_id;
    SELECT MAX(order_index) INTO _max_stage_order FROM public.pipeline_stages WHERE product_id=_lead.product_id;
    IF _stage_order IS NOT NULL AND _max_stage_order IS NOT NULL AND _max_stage_order > 0 THEN
      _stage_pts := _stage_order::NUMERIC/_max_stage_order::NUMERIC*_rules.weight_stage;
    END IF;
  END IF;

  _final := _bant_pts+_recency_pts+_engagement_pts+_stage_pts;
  _weight_sum := _rules.weight_bant+_rules.weight_recency+_rules.weight_engagement+_rules.weight_stage;
  IF _weight_sum > 0 THEN _final := _final*100.0/_weight_sum; END IF;
  _final := GREATEST(0,LEAST(100,_final));

  IF _final >= _rules.hot_threshold THEN _temp := 'hot';
  ELSIF _final < _rules.cold_threshold THEN _temp := 'cold';
  ELSE _temp := 'warm'; END IF;

  RETURN QUERY SELECT ROUND(_final)::INTEGER, _temp;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_lead_temperature()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _result RECORD;
BEGIN
  IF NEW.temperature_manual_override THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.bant_budget IS NOT DISTINCT FROM OLD.bant_budget
     AND NEW.bant_authority IS NOT DISTINCT FROM OLD.bant_authority
     AND NEW.bant_need IS NOT DISTINCT FROM OLD.bant_need
     AND NEW.bant_timing IS NOT DISTINCT FROM OLD.bant_timing
     AND NEW.last_contact_at IS NOT DISTINCT FROM OLD.last_contact_at
     AND NEW.current_stage_id IS NOT DISTINCT FROM OLD.current_stage_id
     AND NEW.product_id IS NOT DISTINCT FROM OLD.product_id
     AND NEW.temperature_manual_override IS NOT DISTINCT FROM OLD.temperature_manual_override
  THEN RETURN NEW; END IF;
  SELECT * INTO _result FROM public.compute_lead_temperature(NEW.id);
  NEW.temperature := _result.temperature;
  NEW.temperature_score := _result.score;
  NEW.temperature_updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_lead_temperature ON public.leads;
CREATE TRIGGER trg_refresh_lead_temperature
  BEFORE INSERT OR UPDATE OF
    bant_budget, bant_authority, bant_need, bant_timing,
    last_contact_at, current_stage_id, product_id, temperature_manual_override
  ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.refresh_lead_temperature();

CREATE OR REPLACE FUNCTION public.recompute_org_temperatures(_organization_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count INTEGER := 0; _lead RECORD; _result RECORD;
BEGIN
  FOR _lead IN
    SELECT id FROM public.leads
    WHERE organization_id = _organization_id AND temperature_manual_override = false
  LOOP
    SELECT * INTO _result FROM public.compute_lead_temperature(_lead.id);
    UPDATE public.leads
       SET temperature = _result.temperature,
           temperature_score = _result.score,
           temperature_updated_at = now()
     WHERE id = _lead.id;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$$;

DO $$ DECLARE _lead RECORD; _result RECORD;
BEGIN
  FOR _lead IN SELECT id FROM public.leads WHERE temperature_manual_override = false LOOP
    SELECT * INTO _result FROM public.compute_lead_temperature(_lead.id);
    UPDATE public.leads
       SET temperature = _result.temperature,
           temperature_score = _result.score,
           temperature_updated_at = now()
     WHERE id = _lead.id;
  END LOOP;
END$$;
