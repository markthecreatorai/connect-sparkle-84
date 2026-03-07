
-- Allow anyone to check if a referral_code exists (needed for registration validation)
CREATE POLICY "Anyone can validate referral codes"
ON public.referral_tree
FOR SELECT
TO anon, authenticated
USING (true);
