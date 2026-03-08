import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    // Service role client for privileged operations
    const db = createClient(supabaseUrl, serviceKey);

    // Check admin role
    const { data: roleData } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Forbidden: admin only");

    const { action, ...params } = await req.json();
    const adminId = user.id;

    let result: Record<string, unknown> = {};

    switch (action) {
      case "approve_deposit":
        result = await approveDeposit(db, params.deposit_id, adminId);
        break;
      case "reject_deposit":
        result = await rejectDeposit(db, params.deposit_id, adminId, params.admin_notes ?? "");
        break;
      case "approve_withdrawal":
        result = await approveWithdrawal(db, params.withdrawal_id, adminId);
        break;
      case "reject_withdrawal":
        result = await rejectWithdrawal(db, params.withdrawal_id, adminId, params.admin_notes ?? "");
        break;
      case "update_password": {
        const { error: pwErr } = await db.auth.admin.updateUserById(params.user_id, { password: params.new_password });
        if (pwErr) throw new Error(pwErr.message);
        result = { user_id: params.user_id, password_updated: true };
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const isAuth = message.includes("Forbidden") || message.includes("Unauthorized") || message.includes("Missing authorization");
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: isAuth ? 403 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── helpers ────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type DB = any;

async function getSetting(db: DB, key: string) {
  const { data } = await db.from("platform_settings").select("value").eq("key", key).maybeSingle();
  return data?.value as Record<string, unknown> | null;
}

async function logActivity(
  db: DB,
  userId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await db.from("activity_logs").insert({ user_id: userId, action, details });
}

// ─── recalculate VIP ────────────────────────────────────────────

async function recalculateVip(db: DB, userId: string) {
  // Count valid referrals: referred_by = userId AND has approved deposit
  const { data: referrals } = await db
    .from("profiles")
    .select("id")
    .eq("referred_by", userId);

  if (!referrals || referrals.length === 0) return;

  const referralIds = referrals.map((r: { id: string }) => r.id);

  // Check which have approved deposits
  const { data: depositsData } = await db
    .from("deposits")
    .select("user_id")
    .in("user_id", referralIds)
    .eq("status", "approved");

  const validCount = new Set((depositsData ?? []).map((d: { user_id: string }) => d.user_id)).size;

  // Get VIP requirements
  const vipReqs = (await getSetting(db, "vip_requirements")) as Record<string, number> | null;
  const reqs = vipReqs ?? { "0": 0, "1": 3, "2": 6, "3": 10, "4": 15 };

  let newLevel = 0;
  const levels = [4, 3, 2, 1];
  for (const lvl of levels) {
    if (validCount >= (reqs[String(lvl)] ?? Infinity)) {
      newLevel = lvl;
      break;
    }
  }

  // Get current level
  const { data: profile } = await db
    .from("profiles")
    .select("vip_level")
    .eq("id", userId)
    .single();

  const currentLevel = profile?.vip_level ?? 0;

  if (newLevel !== currentLevel) {
    await db.from("profiles").update({ vip_level: newLevel }).eq("id", userId);
    await logActivity(db, userId, "vip_level_changed", {
      from: currentLevel,
      to: newLevel,
      valid_referrals: validCount,
    });
  }
}

// ─── APPROVE DEPOSIT ────────────────────────────────────────────

async function approveDeposit(db: DB, depositId: string, adminId: string) {
  // 1. Fetch deposit
  const { data: deposit, error } = await db
    .from("deposits")
    .select("*")
    .eq("id", depositId)
    .single();
  if (error || !deposit) throw new Error("Deposit not found");
  if (deposit.status !== "pending") throw new Error("Deposit already processed");

  const now = new Date().toISOString();

  // 2. Update deposit
  await db.from("deposits").update({
    status: "approved",
    approved_by: adminId,
    approved_at: now,
  }).eq("id", depositId);

  // 3. Update corresponding transaction
  await db.from("transactions").update({
    status: "approved",
    approved_by: adminId,
    approved_at: now,
  }).eq("reference_id", depositId).eq("type", "deposit");

  // 4. Credit depositor balance
  const { data: depositor } = await db
    .from("profiles")
    .select("balance, full_name, referred_by")
    .eq("id", deposit.user_id)
    .single();

  await db.from("profiles").update({
    balance: (depositor?.balance ?? 0) + deposit.amount,
  }).eq("id", deposit.user_id);

  // 5. Process commissions up the chain
  const commissionKeys = ["commission_n1", "commission_n2", "commission_n3"];
  const settings: Record<string, number> = {};
  for (const key of commissionKeys) {
    const s = await getSetting(db, key);
    settings[key] = (s as any)?.percent ?? 0;
  }

  const commissionsGenerated: Array<{ level: number; beneficiary: string; amount: number }> = [];
  let currentUserId: string | null = deposit.user_id;
  const depositorName = depositor?.full_name ?? "Usuário";

  // Walk up the referral chain
  const uplines: string[] = [];
  for (let level = 1; level <= 3; level++) {
    const { data: prof } = await db
      .from("profiles")
      .select("id, referred_by, balance")
      .eq("id", currentUserId!)
      .single();
    
    if (!prof?.referred_by) break;

    const uplineId = prof.referred_by;
    uplines.push(uplineId);

    const pct = settings[`commission_n${level}`] ?? 0;
    const commAmount = Math.round(deposit.amount * pct) / 100;

    if (commAmount > 0) {
      // Create commission record
      const { data: comm } = await db.from("commissions").insert({
        beneficiary_id: uplineId,
        source_user_id: deposit.user_id,
        deposit_id: depositId,
        level,
        percentage: pct,
        amount: commAmount,
      }).select("id").single();

      // Create transaction for upline
      await db.from("transactions").insert({
        user_id: uplineId,
        type: "commission",
        amount: commAmount,
        status: "approved",
        approved_at: now,
        approved_by: adminId,
        description: `Comissão N${level} de ${depositorName}`,
        reference_id: comm?.id ?? null,
      });

      // Credit upline balance
      const { data: uplineProfile } = await db
        .from("profiles")
        .select("balance")
        .eq("id", uplineId)
        .single();

      await db.from("profiles").update({
        balance: (uplineProfile?.balance ?? 0) + commAmount,
      }).eq("id", uplineId);

      commissionsGenerated.push({ level, beneficiary: uplineId, amount: commAmount });
    }

    currentUserId = uplineId;
  }

  // 6. Log activity
  await logActivity(db, adminId, "deposit_approved", {
    deposit_id: depositId,
    amount: deposit.amount,
    user_id: deposit.user_id,
    commissions: commissionsGenerated,
  });

  // 7. Recalculate VIP for all uplines (deposit may make depositor a "valid referral")
  for (const upId of uplines) {
    await recalculateVip(db, upId);
  }

  return { deposit_id: depositId, commissions: commissionsGenerated.length };
}

// ─── REJECT DEPOSIT ─────────────────────────────────────────────

async function rejectDeposit(db: DB, depositId: string, adminId: string, notes: string) {
  const { data: deposit } = await db.from("deposits").select("*").eq("id", depositId).single();
  if (!deposit) throw new Error("Deposit not found");
  if (deposit.status !== "pending") throw new Error("Deposit already processed");

  const now = new Date().toISOString();

  await db.from("deposits").update({
    status: "rejected",
    approved_by: adminId,
    approved_at: now,
    admin_notes: notes,
  }).eq("id", depositId);

  await db.from("transactions").update({
    status: "rejected",
    approved_by: adminId,
    approved_at: now,
  }).eq("reference_id", depositId).eq("type", "deposit");

  await logActivity(db, adminId, "deposit_rejected", {
    deposit_id: depositId,
    amount: deposit.amount,
    user_id: deposit.user_id,
    notes,
  });

  return { deposit_id: depositId };
}

// ─── APPROVE WITHDRAWAL ────────────────────────────────────────

async function approveWithdrawal(db: DB, withdrawalId: string, adminId: string) {
  const { data: wd } = await db.from("withdrawals").select("*").eq("id", withdrawalId).single();
  if (!wd) throw new Error("Withdrawal not found");
  if (wd.status !== "pending") throw new Error("Withdrawal already processed");

  const now = new Date().toISOString();

  await db.from("withdrawals").update({
    status: "approved",
    approved_by: adminId,
    approved_at: now,
  }).eq("id", withdrawalId);

  await db.from("transactions").update({
    status: "approved",
    approved_by: adminId,
    approved_at: now,
  }).eq("reference_id", withdrawalId).eq("type", "withdrawal");

  // Deduct from blocked_balance
  const { data: profile } = await db
    .from("profiles")
    .select("blocked_balance")
    .eq("id", wd.user_id)
    .single();

  await db.from("profiles").update({
    blocked_balance: Math.max((profile?.blocked_balance ?? 0) - wd.amount, 0),
  }).eq("id", wd.user_id);

  await logActivity(db, adminId, "withdrawal_approved", {
    withdrawal_id: withdrawalId,
    amount: wd.amount,
    net_amount: wd.net_amount,
    user_id: wd.user_id,
  });

  return { withdrawal_id: withdrawalId };
}

// ─── REJECT WITHDRAWAL ─────────────────────────────────────────

async function rejectWithdrawal(db: DB, withdrawalId: string, adminId: string, notes: string) {
  const { data: wd } = await db.from("withdrawals").select("*").eq("id", withdrawalId).single();
  if (!wd) throw new Error("Withdrawal not found");
  if (wd.status !== "pending") throw new Error("Withdrawal already processed");

  const now = new Date().toISOString();

  await db.from("withdrawals").update({
    status: "rejected",
    approved_by: adminId,
    approved_at: now,
    admin_notes: notes,
  }).eq("id", withdrawalId);

  await db.from("transactions").update({
    status: "rejected",
    approved_by: adminId,
    approved_at: now,
  }).eq("reference_id", withdrawalId).eq("type", "withdrawal");

  // Return funds to the correct wallet
  const walletType = wd.wallet_type || "personal";
  const { data: wallet } = await db
    .from("wallets")
    .select("id, balance")
    .eq("user_id", wd.user_id)
    .eq("wallet_type", walletType)
    .single();

  if (wallet) {
    await db.from("wallets").update({
      balance: (wallet.balance ?? 0) + wd.amount,
      updated_at: now,
    }).eq("id", wallet.id);
  }

  await logActivity(db, adminId, "withdrawal_rejected", {
    withdrawal_id: withdrawalId,
    amount: wd.amount,
    user_id: wd.user_id,
    notes,
  });

  return { withdrawal_id: withdrawalId };
}
