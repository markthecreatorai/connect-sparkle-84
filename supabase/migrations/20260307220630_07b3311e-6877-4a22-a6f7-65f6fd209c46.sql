
-- Create vip_levels table for task configuration per VIP level
CREATE TABLE public.vip_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  deposit_required numeric NOT NULL DEFAULT 0,
  daily_tasks integer NOT NULL DEFAULT 0,
  reward_per_task numeric NOT NULL DEFAULT 0,
  daily_income numeric NOT NULL DEFAULT 0,
  monthly_income numeric NOT NULL DEFAULT 0,
  yearly_income numeric NOT NULL DEFAULT 0,
  min_direct_referrals integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vip_levels ENABLE ROW LEVEL SECURITY;

-- Anyone can read vip_levels
CREATE POLICY "Anyone can read vip_levels" ON public.vip_levels FOR SELECT USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage vip_levels" ON public.vip_levels FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Seed data for intern + VIP 1-9
INSERT INTO public.vip_levels (level_code, display_name, deposit_required, daily_tasks, reward_per_task, daily_income, monthly_income, sort_order) VALUES
  ('intern', 'Estagiário', 0, 3, 1.00, 3.00, 90.00, 0),
  ('vip1', 'VIP 1', 200, 5, 1.60, 8.00, 240.00, 1),
  ('vip2', 'VIP 2', 500, 5, 3.20, 16.00, 480.00, 2),
  ('vip3', 'VIP 3', 1000, 5, 8.00, 40.00, 1200.00, 3),
  ('vip4', 'VIP 4', 3000, 5, 16.00, 80.00, 2400.00, 4),
  ('vip5', 'VIP 5', 5000, 5, 36.00, 180.00, 5400.00, 5),
  ('vip6', 'VIP 6', 10000, 5, 80.00, 400.00, 12000.00, 6),
  ('vip7', 'VIP 7', 30000, 5, 260.00, 1300.00, 39000.00, 7),
  ('vip8', 'VIP 8', 100000, 5, 860.00, 4300.00, 129000.00, 8),
  ('vip9', 'VIP 9', 500000, 5, 4600.00, 23000.00, 690000.00, 9);
