

# Plan: Revamp Guide Page with Complete Information Tables

## Overview
Update the `/guide` page to include all the detailed tables and information provided: VIP task earnings with 30/360 day salaries, referral deposit commission values per VIP level, task commission values per VIP level, detailed wallet explanations, withdrawal process details, and the AvengersPay company presentation.

## Changes

### 1. Update `src/pages/Guide.tsx`

**VIP Levels Table (Section 2)** -- Add two new columns: "Salario 30 Dias" and "Salario 360 Dias" using `monthly_income` and computed `yearly_income` (or `daily_income * 360`). Add the "R$/Tarefa" column already present.

**Referral Commissions - Deposit/Activation (Section 4)** -- Replace the current simple percentage list with a full table showing per-VIP-level values:
- Columns: Nivel | Valor Recarga | % Recompensa (A-B-C) | Nivel A (R$) | Nivel B (R$) | Nivel C (R$)
- Computed from `vipLevels` data: `deposit_required * 0.12`, `* 0.04`, `* 0.02`

**Referral Commissions - Task (new sub-section in Section 4)** -- Add a second table for task commissions:
- Columns: Nivel | Comissao por Subordinado (R$) | % Comissao (A-B-C) | Nivel A | Nivel B | Nivel C
- Computed from `vipLevels`: `daily_income * 0.05`, `* 0.03`, `* 0.01`

**Wallets Section (Section 1)** -- Expand with the detailed explanation about Saldo Pessoal vs Saldo de Renda, emphasizing the separation of individual earnings vs network earnings.

**Withdrawal Section (Section 6)** -- Add details about PIX, selecting which wallet to withdraw from, the requirement that wallets cannot be mixed in a single withdrawal.

**New Section: About AvengersPay** -- Add a new accordion section with the company presentation content (mission, how it works, gamification theme).

### Technical Notes
- All commission values are computed client-side from the `vipLevels` array (already fetched)
- No database changes needed
- Filter out "intern" level from commission tables (no deposit = no commission)
- Add `Shield, Star, Zap` icons from lucide-react for the new section
