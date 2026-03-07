
-- Allow users to insert their own daily_tasks
CREATE POLICY "Users can insert own daily tasks"
ON public.daily_tasks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own daily_tasks
CREATE POLICY "Users can update own daily tasks"
ON public.daily_tasks
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
