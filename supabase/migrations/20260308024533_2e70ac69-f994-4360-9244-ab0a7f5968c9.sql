CREATE OR REPLACE FUNCTION public.get_auth_email_by_phone(_phone text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email FROM auth.users u
  WHERE u.raw_user_meta_data->>'phone' = _phone
  LIMIT 1;
$$;