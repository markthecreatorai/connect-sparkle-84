
-- 1) Create referral_tree table
CREATE TABLE IF NOT EXISTS public.referral_tree (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  level_a_referrer uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  level_b_referrer uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  level_c_referrer uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referral_code text UNIQUE NOT NULL DEFAULT '',
  vip_level text NOT NULL DEFAULT 'intern',
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Standalone referral code generator (checks both tables)
CREATE OR REPLACE FUNCTION public.generate_referral_code_standalone()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(
      SELECT 1 FROM public.referral_tree WHERE referral_code = new_code
      UNION ALL
      SELECT 1 FROM public.profiles WHERE referral_code = new_code
    ) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

-- 3) setup_referral_tree trigger function
CREATE OR REPLACE FUNCTION public.setup_referral_tree()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sponsor_b uuid;
  _sponsor_c uuid;
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := public.generate_referral_code_standalone();
  END IF;
  NEW.level_a_referrer := NEW.referrer_id;
  IF NEW.referrer_id IS NOT NULL THEN
    SELECT referrer_id INTO _sponsor_b FROM public.referral_tree WHERE user_id = NEW.referrer_id;
    NEW.level_b_referrer := _sponsor_b;
    IF _sponsor_b IS NOT NULL THEN
      SELECT referrer_id INTO _sponsor_c FROM public.referral_tree WHERE user_id = _sponsor_b;
      NEW.level_c_referrer := _sponsor_c;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Trigger
DROP TRIGGER IF EXISTS before_referral_insert ON public.referral_tree;
CREATE TRIGGER before_referral_insert
  BEFORE INSERT ON public.referral_tree
  FOR EACH ROW
  EXECUTE FUNCTION public.setup_referral_tree();

-- 5) Indexes
CREATE INDEX IF NOT EXISTS idx_referral_referrer ON public.referral_tree (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_code ON public.referral_tree (referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_level_a ON public.referral_tree (level_a_referrer);
CREATE INDEX IF NOT EXISTS idx_referral_level_b ON public.referral_tree (level_b_referrer);
CREATE INDEX IF NOT EXISTS idx_referral_level_c ON public.referral_tree (level_c_referrer);

-- 6) RLS
ALTER TABLE public.referral_tree ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral data" ON public.referral_tree;
CREATE POLICY "Users can view own referral data"
  ON public.referral_tree FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their direct referrals" ON public.referral_tree;
CREATE POLICY "Users can view their direct referrals"
  ON public.referral_tree FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "Admins can manage referral_tree" ON public.referral_tree;
CREATE POLICY "Admins can manage referral_tree"
  ON public.referral_tree FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "No direct client inserts on referral_tree" ON public.referral_tree;
CREATE POLICY "No direct client inserts on referral_tree"
  ON public.referral_tree FOR INSERT
  TO authenticated
  WITH CHECK (false);
