
-- 1) daily_tasks
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_date date NOT NULL DEFAULT current_date,
  tasks_completed int NOT NULL DEFAULT 0,
  tasks_required int NOT NULL DEFAULT 0,
  reward_per_task numeric(10,2) NOT NULL DEFAULT 0,
  total_earned numeric(10,2) NOT NULL DEFAULT 0,
  vip_level varchar(20) NOT NULL,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, task_date)
);

-- 2) withdrawals - already exists, add missing columns
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS tax_amount numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_type varchar(20),
  ADD COLUMN IF NOT EXISTS payment_password_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- 3) investments
CREATE TABLE IF NOT EXISTS public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount numeric(14,2) NOT NULL,
  from_recharge numeric(14,2) DEFAULT 0,
  from_personal numeric(14,2) DEFAULT 0,
  from_income numeric(14,2) DEFAULT 0,
  interest_rate numeric(5,2) NOT NULL,
  duration_days int NOT NULL,
  profit_amount numeric(14,2) NOT NULL DEFAULT 0,
  status varchar(20) DEFAULT 'active',
  started_at timestamptz DEFAULT now(),
  matures_at timestamptz NOT NULL,
  returned_at timestamptz
);

-- 4) team_positions
CREATE TABLE IF NOT EXISTS public.team_positions (
  id serial PRIMARY KEY,
  position_code varchar(30) UNIQUE NOT NULL,
  display_name varchar(50) NOT NULL,
  required_direct_referrals int DEFAULT 0,
  required_total_team int DEFAULT 0,
  monthly_salary numeric(10,2) NOT NULL DEFAULT 0,
  sort_order int DEFAULT 0
);

-- 5) platform_config
CREATE TABLE IF NOT EXISTS public.platform_config (
  key varchar(50) PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Validation triggers instead of CHECK constraints
CREATE OR REPLACE FUNCTION public.validate_investment_amount()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.total_amount <= 0 THEN
    RAISE EXCEPTION 'total_amount must be > 0';
  END IF;
  IF NEW.status NOT IN ('active','matured','returned') THEN
    RAISE EXCEPTION 'invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_investment ON public.investments;
CREATE TRIGGER trg_validate_investment BEFORE INSERT OR UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.validate_investment_amount();

-- RLS: daily_tasks
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own tasks" ON public.daily_tasks;
CREATE POLICY "Users can view own tasks" ON public.daily_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage daily_tasks" ON public.daily_tasks;
CREATE POLICY "Admins can manage daily_tasks" ON public.daily_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS: investments
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own investments" ON public.investments;
CREATE POLICY "Users can view own investments" ON public.investments FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can manage investments" ON public.investments;
CREATE POLICY "Admins can manage investments" ON public.investments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS: team_positions
ALTER TABLE public.team_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Positions viewable by all" ON public.team_positions;
CREATE POLICY "Positions viewable by all" ON public.team_positions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage team_positions" ON public.team_positions;
CREATE POLICY "Admins can manage team_positions" ON public.team_positions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS: platform_config
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Config viewable by all" ON public.platform_config;
CREATE POLICY "Config viewable by all" ON public.platform_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can manage platform_config" ON public.platform_config;
CREATE POLICY "Admins can manage platform_config" ON public.platform_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
