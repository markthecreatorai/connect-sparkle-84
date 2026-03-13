
-- 1) Add WITH CHECK to profiles UPDATE policy to explicitly block financial field changes
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND balance IS NOT DISTINCT FROM (SELECT balance FROM public.profiles WHERE id = auth.uid())
    AND blocked_balance IS NOT DISTINCT FROM (SELECT blocked_balance FROM public.profiles WHERE id = auth.uid())
    AND vip_level IS NOT DISTINCT FROM (SELECT vip_level FROM public.profiles WHERE id = auth.uid())
    AND vip_purchased_at IS NOT DISTINCT FROM (SELECT vip_purchased_at FROM public.profiles WHERE id = auth.uid())
    AND payment_password_hash IS NOT DISTINCT FROM (SELECT payment_password_hash FROM public.profiles WHERE id = auth.uid())
    AND referral_code IS NOT DISTINCT FROM (SELECT referral_code FROM public.profiles WHERE id = auth.uid())
    AND referred_by IS NOT DISTINCT FROM (SELECT referred_by FROM public.profiles WHERE id = auth.uid())
    AND is_active IS NOT DISTINCT FROM (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  );

-- 2) Restrict platform_config SELECT to only public keys via RPC (remove blanket read)
DROP POLICY IF EXISTS "Authenticated can read platform config" ON public.platform_config;
