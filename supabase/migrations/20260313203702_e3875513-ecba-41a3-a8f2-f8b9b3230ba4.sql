
-- Remove the insecure UPDATE policy that allows users to modify their own task records directly
-- Task completion is handled securely via the complete_daily_task() SECURITY DEFINER function
DROP POLICY IF EXISTS "Users can update own daily tasks" ON public.daily_tasks;
