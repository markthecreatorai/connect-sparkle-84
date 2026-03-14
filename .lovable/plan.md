

## Analysis

Task videos are currently **hardcoded** as a `VIDEO_POOL` array in `src/pages/Tasks.tsx` with 30 YouTube video entries. There is no database table or admin interface to manage them. The admin needs to be able to add, edit, and remove videos, optionally associating them with specific VIP levels.

## Plan

### 1. Create `task_videos` database table

```sql
CREATE TABLE public.task_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_id text NOT NULL,
  title text NOT NULL,
  vip_level_code text DEFAULT NULL,  -- NULL = all levels
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.task_videos ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage task_videos" ON public.task_videos
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- All authenticated users can read active videos
CREATE POLICY "Users can read active task_videos" ON public.task_videos
  FOR SELECT TO authenticated USING (is_active = true);
```

Seed it with the existing 30 hardcoded videos (all with `vip_level_code = NULL` so they apply to all levels).

### 2. Create admin page `src/pages/admin/AdminTasks.tsx`

- Table listing all videos: YouTube ID, title, VIP level filter (dropdown: "Todos" or specific level), active toggle, sort order
- "Adicionar Vídeo" button with dialog (youtube_id, title, vip_level_code, is_active)
- Edit inline or via dialog
- Delete button with confirmation
- Reuses existing UI components (Card, Dialog, Input, Select, Switch, Button, Table)

### 3. Add route in `App.tsx`

Add `/admin/tasks` route with `AdminPage` wrapper.

### 4. Add nav item in `AdminLayout.tsx`

Add "Tarefas" link with `Video` icon to the admin sidebar.

### 5. Update `Tasks.tsx` to fetch from database

Replace the hardcoded `VIDEO_POOL` with a query to `task_videos` table, filtering by `is_active = true` and optionally by `vip_level_code` matching the user's level (or `NULL` for universal videos). Keep the same rotation logic using `sort_order`.

