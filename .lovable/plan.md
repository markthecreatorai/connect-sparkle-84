

## Analysis

There are **two separate tables** managing VIP data that are not connected in the admin panel:

1. **`vip_levels`** — managed by `/admin/vip-levels`: display_name, deposit_required, daily_tasks, reward_per_task, daily_income, monthly_income, yearly_income, min_direct_referrals, is_available, sort_order
2. **`vip_plans`** — used by `/vip-plans` (client page) and the webhook for commissions: level, name, price, commission_a_pct, commission_b_pct, commission_c_pct, reward_a, reward_b, reward_c, color_hex

The admin page currently only edits `vip_levels`, so commission fields (percentages and reward values per referral level) are invisible to the admin.

---

## Plan

### 1. Restructure AdminVipLevels to manage both tables

Load data from both `vip_levels` and `vip_plans`, join them by level number (extracting from `level_code`). Display all fields in a unified card per level:

- **Existing fields**: display_name, deposit_required, daily_tasks, reward_per_task, daily_income, monthly_income, yearly_income, min_direct_referrals, is_available
- **New fields from vip_plans**: price, commission_a_pct, commission_b_pct, commission_c_pct, reward_a, reward_b, reward_c, color_hex

On save, update both tables for each level.

### 2. Add "Adicionar Nível" button with dialog

- Opens a Dialog with a form for all fields (both tables)
- Inserts into both `vip_levels` and `vip_plans` simultaneously
- Auto-generates `level_code` and `level` number based on next available

### 3. Add "Excluir Nível" button per card

- Confirmation dialog before deletion
- Deletes from both `vip_levels` and `vip_plans`
- Checks if any users are currently on that level before allowing deletion

### 4. Keep sync on save

When saving changes, both `vip_levels` and `vip_plans` are updated in the same operation, ensuring the client-facing `/vip-plans` page always reflects admin changes.

---

## Technical details

- No database migration needed -- both tables already have admin ALL policies
- The join key is: `vip_levels.level_code` = `"vip" + vip_plans.level` (e.g., "vip1" ↔ 1, "intern" ↔ 0)
- Components used: existing Dialog, Input, Switch, Button, Card from shadcn/ui
- File changed: `src/pages/admin/AdminVipLevels.tsx` (full rewrite)

