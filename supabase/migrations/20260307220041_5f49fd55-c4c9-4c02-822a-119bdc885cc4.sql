
-- Fix handle_new_user to also insert into referral_tree
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _referred_by UUID;
BEGIN
  -- Resolve referred_by from metadata
  IF NEW.raw_user_meta_data ->> 'referred_by' IS NOT NULL AND NEW.raw_user_meta_data ->> 'referred_by' <> '' THEN
    _referred_by := (NEW.raw_user_meta_data ->> 'referred_by')::UUID;
  ELSE
    _referred_by := NULL;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, full_name, email, phone, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    _referred_by
  );

  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  -- Insert into referral_tree (the before_referral_insert trigger will populate levels)
  INSERT INTO public.referral_tree (user_id, referrer_id)
  VALUES (NEW.id, _referred_by);

  RETURN NEW;
END;
$$;

-- Backfill: insert existing users into referral_tree
INSERT INTO public.referral_tree (user_id, referrer_id)
SELECT p.id, p.referred_by
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.referral_tree rt WHERE rt.user_id = p.id)
ORDER BY p.created_at;
