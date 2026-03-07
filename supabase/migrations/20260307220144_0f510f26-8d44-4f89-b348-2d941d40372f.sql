
-- Fix setup_referral_tree to NOT overwrite referral_code if already provided
CREATE OR REPLACE FUNCTION public.setup_referral_tree()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sponsor_b uuid;
  _sponsor_c uuid;
BEGIN
  -- Only generate code if not provided
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := public.generate_referral_code_standalone();
  END IF;

  NEW.level_a_referrer := NEW.referrer_id;

  IF NEW.referrer_id IS NOT NULL THEN
    SELECT referrer_id INTO _sponsor_b FROM public.referral_tree WHERE user_id = NEW.referrer_id;
    NEW.level_b_referrer := _sponsor_b;
    IF _sponsor_b IS NOT NULL THEN
      SELECT referrer_id INTO _sponsor_c FROM public.referral_tree WHERE user_id = _sponsor_b;
      NEW.level_c_referrer := _sponsor_c;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
