
-- 1. Create vip_plans table
CREATE TABLE public.vip_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level integer NOT NULL UNIQUE,
  name text NOT NULL,
  price numeric NOT NULL,
  commission_a_pct numeric NOT NULL DEFAULT 0.12,
  commission_b_pct numeric NOT NULL DEFAULT 0.04,
  commission_c_pct numeric NOT NULL DEFAULT 0.02,
  reward_a numeric NOT NULL,
  reward_b numeric NOT NULL,
  reward_c numeric NOT NULL,
  color_hex text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz DEFAULT now()
);

-- RLS for vip_plans (public read, admin write)
ALTER TABLE public.vip_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vip_plans" ON public.vip_plans
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage vip_plans" ON public.vip_plans
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Update commissions table: add new columns
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'vip_purchase',
  ADD COLUMN IF NOT EXISTS origin_payment_id text,
  ADD COLUMN IF NOT EXISTS vip_plan_id uuid REFERENCES public.vip_plans(id);

CREATE INDEX IF NOT EXISTS idx_commissions_origin_payment_id ON public.commissions(origin_payment_id);

-- 3. Add vip_purchased_at to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vip_purchased_at timestamptz;
