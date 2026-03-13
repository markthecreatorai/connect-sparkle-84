
-- 1) Ensure the protect_profile_sensitive_columns trigger is attached
-- This function already exists and blocks non-admins from changing financial fields
DROP TRIGGER IF EXISTS trigger_protect_profile_sensitive_columns ON public.profiles;
CREATE TRIGGER trigger_protect_profile_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- 2) Replace the INSERT policy on profiles to block financial field manipulation
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND (balance IS NULL OR balance = 0)
    AND (blocked_balance IS NULL OR blocked_balance = 0)
    AND (vip_level IS NULL OR vip_level = 0)
    AND vip_purchased_at IS NULL
    AND payment_password_hash IS NULL
  );

-- 3) Remove the insecure INSERT policy on daily_tasks
DROP POLICY IF EXISTS "Users can insert own daily tasks" ON public.daily_tasks;
