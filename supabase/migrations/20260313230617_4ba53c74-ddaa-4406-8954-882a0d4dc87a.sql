
-- 1) Fix deposits INSERT: force status=pending, no admin fields
DROP POLICY IF EXISTS "Users can insert their own deposits" ON public.deposits;
CREATE POLICY "Users can insert their own deposits"
  ON public.deposits FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND admin_notes IS NULL
  );

-- 2) Fix withdrawals INSERT: force status=pending, no admin fields
DROP POLICY IF EXISTS "Users can insert their own withdrawals" ON public.withdrawals;
CREATE POLICY "Users can insert their own withdrawals"
  ON public.withdrawals FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND admin_notes IS NULL
  );

-- 3) Fix profiles INSERT: block referred_by manipulation (it's set by handle_new_user trigger)
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
    AND referred_by IS NULL
  );
