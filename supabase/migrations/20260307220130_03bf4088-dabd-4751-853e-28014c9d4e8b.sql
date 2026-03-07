
-- Update handle_new_user to pass the profile's referral_code to referral_tree
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _referred_by UUID;
  _new_code TEXT;
BEGIN
  IF NEW.raw_user_meta_data ->> 'referred_by' IS NOT NULL AND NEW.raw_user_meta_data ->> 'referred_by' <> '' THEN
    _referred_by := (NEW.raw_user_meta_data ->> 'referred_by')::UUID;
  ELSE
    _referred_by := NULL;
  END IF;

  -- Create profile (trigger_generate_referral_code fires and sets referral_code)
  INSERT INTO public.profiles (id, full_name, email, phone, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    _referred_by
  );

  -- Get the generated referral_code from profiles
  SELECT referral_code INTO _new_code FROM public.profiles WHERE id = NEW.id;

  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');

  -- Insert into referral_tree with SAME code as profile
  INSERT INTO public.referral_tree (user_id, referrer_id, referral_code)
  VALUES (NEW.id, _referred_by, _new_code);

  RETURN NEW;
END;
$$;
