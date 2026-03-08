
-- 1. Drop the broad referrer SELECT policy that exposes sensitive data
DROP POLICY IF EXISTS "Users can view referred profiles" ON public.profiles;

-- 2. Create a restricted referrer view function
CREATE OR REPLACE FUNCTION public.get_referral_profiles(_referrer_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  referral_code text,
  vip_level integer,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.referral_code, p.vip_level, p.is_active, p.created_at
  FROM public.profiles p
  WHERE p.referred_by = _referrer_id;
$$;

-- 3. Restrict platform_settings: drop world-readable policy, make admin-only read
DROP POLICY IF EXISTS "Authenticated can read platform settings" ON public.platform_settings;

-- 4. Create a safe function for regular users to read non-sensitive settings
CREATE OR REPLACE FUNCTION public.get_public_platform_settings(_keys text[])
RETURNS TABLE (key text, value jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.key, ps.value
  FROM public.platform_settings ps
  WHERE ps.key = ANY(_keys)
    AND ps.key NOT IN ('internal_secrets', 'api_keys', 'payment_credentials');
$$;

-- 5. Restrict platform_config: drop world-readable policy
DROP POLICY IF EXISTS "Authenticated can read platform config" ON public.platform_config;

-- 6. Create safe function for platform_config too
CREATE OR REPLACE FUNCTION public.get_public_platform_config(_keys text[])
RETURNS TABLE (key varchar, value jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pc.key, pc.value
  FROM public.platform_config pc
  WHERE pc.key = ANY(_keys);
$$;

-- Re-add read policy for authenticated users on platform_config (non-sensitive data used broadly)
CREATE POLICY "Authenticated can read platform config"
ON public.platform_config FOR SELECT
TO authenticated
USING (true);
