
-- 1) Fix withdrawals INSERT: block payment_password_verified bypass
DROP POLICY IF EXISTS "Users can insert their own withdrawals" ON public.withdrawals;
CREATE POLICY "Users can insert their own withdrawals"
  ON public.withdrawals FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND admin_notes IS NULL
    AND (payment_password_verified IS NOT TRUE)
  );

-- 2) Fix deposits INSERT: block forged payment data
DROP POLICY IF EXISTS "Users can insert their own deposits" ON public.deposits;
CREATE POLICY "Users can insert their own deposits"
  ON public.deposits FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND approved_by IS NULL
    AND approved_at IS NULL
    AND admin_notes IS NULL
    AND mp_payment_id IS NULL
    AND mp_qr_code IS NULL
    AND mp_qr_code_base64 IS NULL
    AND mp_ticket_url IS NULL
    AND (deposit_type IS NULL OR deposit_type = 'balance')
  );
