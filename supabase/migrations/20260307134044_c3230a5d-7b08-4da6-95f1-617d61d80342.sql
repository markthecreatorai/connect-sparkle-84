
-- 1) Create wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_type varchar(20) NOT NULL CHECK (wallet_type IN ('recharge','personal','income')),
  balance numeric(14,2) DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, wallet_type)
);

-- 2) Create trigger function to auto-create 3 wallets
CREATE OR REPLACE FUNCTION public.create_user_wallets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, wallet_type)
  VALUES
    (NEW.id, 'recharge'),
    (NEW.id, 'personal'),
    (NEW.id, 'income')
  ON CONFLICT (user_id, wallet_type) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3) Create trigger on profiles (fires after profile creation, which happens for every new user)
DROP TRIGGER IF EXISTS trg_create_user_wallets ON public.profiles;
CREATE TRIGGER trg_create_user_wallets
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_wallets();

-- 4) Backfill wallets for existing users
INSERT INTO public.wallets (user_id, wallet_type)
SELECT p.id, wt.wallet_type
FROM public.profiles p
CROSS JOIN (VALUES ('recharge'), ('personal'), ('income')) AS wt(wallet_type)
ON CONFLICT (user_id, wallet_type) DO NOTHING;

-- 5) Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallets"
  ON public.wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "No direct wallet updates"
  ON public.wallets
  FOR UPDATE
  TO authenticated
  USING (false);
