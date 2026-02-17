
-- Update handle_new_user to include phone and referred_by from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  RETURN NEW;
END;
$$;
