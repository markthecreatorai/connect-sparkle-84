
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can validate referral codes" ON public.referral_tree;

-- Create a SECURITY DEFINER function for referral code validation
CREATE OR REPLACE FUNCTION public.validate_referral_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT user_id FROM public.referral_tree WHERE referral_code = upper(_code) LIMIT 1;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;
