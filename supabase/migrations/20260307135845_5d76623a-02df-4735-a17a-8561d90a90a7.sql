
-- Phase 1.3: Alter transactions table to new spec

-- 1) Add missing columns
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS wallet_type varchar(20),
  ADD COLUMN IF NOT EXISTS balance_after numeric(14,2);

-- 2) Add check constraint on wallet_type
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_wallet_type_check') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_wallet_type_check
      CHECK (wallet_type IN ('recharge','personal','income'));
  END IF;
END $$;

-- 3) Drop old type column constraint if any, add new check
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_type_check') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
      CHECK (type IN ('deposit','withdrawal','vip_upgrade','vip_refund','task_reward','referral_deposit_commission','referral_task_commission','investment_apply','investment_return','investment_profit','salary','bonus','spin_prize','tax'));
  END IF;
END $$;

-- 4) Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON public.transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON public.transactions (user_id, type);

-- 5) Drop old RLS policies and create new ones
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "No direct inserts from client" ON public.transactions
  FOR INSERT WITH CHECK (false);

-- Keep admin full access
CREATE POLICY "Admins can manage all transactions" ON public.transactions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
