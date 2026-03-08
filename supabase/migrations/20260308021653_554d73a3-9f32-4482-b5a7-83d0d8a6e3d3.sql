
-- Daily check-ins
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  streak_count integer NOT NULL DEFAULT 1,
  reward_amount numeric NOT NULL DEFAULT 0.50,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkins" ON public.daily_checkins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "No direct client inserts on checkins" ON public.daily_checkins
  FOR INSERT WITH CHECK (false);

-- Spin history
CREATE TABLE IF NOT EXISTS public.spin_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  spin_date date NOT NULL DEFAULT CURRENT_DATE,
  prize_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.spin_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spins" ON public.spin_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "No direct client inserts on spins" ON public.spin_history
  FOR INSERT WITH CHECK (false);
