
-- Remove overly permissive INSERT policy on activity_logs
DROP POLICY "System can insert activity logs" ON public.activity_logs;
