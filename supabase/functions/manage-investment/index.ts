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

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const db = createClient(supabaseUrl, serviceKey);
    const { action, ...params } = await req.json();

    if (action === "create") {
      return await createInvestment(db, user.id, params);
    }
    if (action === "redeem") {
      return await redeemInvestment(db, user.id, params.investment_id);
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// deno-lint-ignore no-explicit-any
type DB = any;

function respond(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function createInvestment(db: DB, userId: string, params: { amount: number; duration_days: number }) {
  const { amount, duration_days } = params;
  if (!amount || amount < 50) throw new Error("Valor mínimo: R$50");
  if (![7, 10, 15, 30].includes(duration_days)) throw new Error("Período inválido");

  // Get interest rate
  const { data: config } = await db.from("platform_config").select("value").eq("key", "investment_plans").single();
  if (!config) throw new Error("Config not found");
  const rates = config.value as Record<string, number>;
  const rate = rates[String(duration_days)];
  if (rate === undefined) throw new Error("Período sem taxa configurada");

  // Get wallets (debit order: income → personal → recharge)
  const { data: wallets } = await db
    .from("wallets")
    .select("id, wallet_type, balance")
    .eq("user_id", userId);

  if (!wallets || wallets.length === 0) throw new Error("Carteiras não encontradas");

  const walletMap: Record<string, { id: string; balance: number }> = {};
  for (const w of wallets) {
    walletMap[w.wallet_type] = { id: w.id, balance: Number(w.balance || 0) };
  }

  const totalAvailable = (walletMap.income?.balance || 0) + (walletMap.personal?.balance || 0) + (walletMap.recharge?.balance || 0);
  if (totalAvailable < amount) throw new Error("Saldo insuficiente");

  // Calculate debit breakdown
  let remaining = amount;
  const fromIncome = Math.min(remaining, walletMap.income?.balance || 0);
  remaining -= fromIncome;
  const fromPersonal = Math.min(remaining, walletMap.personal?.balance || 0);
  remaining -= fromPersonal;
  const fromRecharge = Math.min(remaining, walletMap.recharge?.balance || 0);

  const now = new Date();
  const maturesAt = new Date(now.getTime() + duration_days * 24 * 60 * 60 * 1000).toISOString();
  const profitAmount = Number((amount * rate / 100).toFixed(2));

  // Debit wallets
  const deductions: Array<{ type: string; amount: number }> = [];
  if (fromIncome > 0) deductions.push({ type: "income", amount: fromIncome });
  if (fromPersonal > 0) deductions.push({ type: "personal", amount: fromPersonal });
  if (fromRecharge > 0) deductions.push({ type: "recharge", amount: fromRecharge });

  for (const d of deductions) {
    const w = walletMap[d.type];
    const newBal = Number((w.balance - d.amount).toFixed(2));
    await db.from("wallets").update({ balance: newBal, updated_at: now.toISOString() }).eq("id", w.id);
    await db.from("transactions").insert({
      user_id: userId,
      type: "investment_apply",
      wallet_type: d.type,
      amount: -d.amount,
      balance_after: newBal,
      description: `Aplicação ${duration_days}d a ${rate}%`,
      status: "completed",
    });
  }

  // Create investment record
  const { data: inv } = await db.from("investments").insert({
    user_id: userId,
    total_amount: amount,
    from_income: fromIncome,
    from_personal: fromPersonal,
    from_recharge: fromRecharge,
    interest_rate: rate,
    duration_days,
    profit_amount: profitAmount,
    matures_at: maturesAt,
    status: "active",
  }).select("id").single();

  return respond({
    investment_id: inv?.id,
    amount,
    profit_amount: profitAmount,
    matures_at: maturesAt,
    from_income: fromIncome,
    from_personal: fromPersonal,
    from_recharge: fromRecharge,
  });
}

async function redeemInvestment(db: DB, userId: string, investmentId: string) {
  if (!investmentId) throw new Error("ID do investimento é obrigatório");

  const { data: inv } = await db
    .from("investments")
    .select("*")
    .eq("id", investmentId)
    .eq("user_id", userId)
    .single();

  if (!inv) throw new Error("Investimento não encontrado");
  if (inv.status !== "active" && inv.status !== "matured") throw new Error("Investimento já resgatado");

  const now = new Date();
  if (new Date(inv.matures_at) > now) throw new Error("Investimento ainda não venceu");

  // Get wallets
  const { data: wallets } = await db.from("wallets").select("id, wallet_type, balance").eq("user_id", userId);
  const walletMap: Record<string, { id: string; balance: number }> = {};
  for (const w of wallets ?? []) {
    walletMap[w.wallet_type] = { id: w.id, balance: Number(w.balance || 0) };
  }

  // Return to origin wallets
  const returns: Array<{ type: string; amount: number }> = [];
  if (Number(inv.from_income) > 0) returns.push({ type: "income", amount: Number(inv.from_income) });
  if (Number(inv.from_personal) > 0) returns.push({ type: "personal", amount: Number(inv.from_personal) });
  if (Number(inv.from_recharge) > 0) returns.push({ type: "recharge", amount: Number(inv.from_recharge) });

  for (const r of returns) {
    const w = walletMap[r.type];
    if (!w) continue;
    const newBal = Number((w.balance + r.amount).toFixed(2));
    await db.from("wallets").update({ balance: newBal, updated_at: now.toISOString() }).eq("id", w.id);
    w.balance = newBal;
    await db.from("transactions").insert({
      user_id: userId,
      type: "investment_return",
      wallet_type: r.type,
      amount: r.amount,
      balance_after: newBal,
      description: `Resgate de investimento`,
      status: "completed",
    });
  }

  // Profit goes to personal wallet
  const profitAmount = Number(inv.profit_amount || 0);
  if (profitAmount > 0) {
    const pw = walletMap.personal;
    if (pw) {
      const newBal = Number((pw.balance + profitAmount).toFixed(2));
      await db.from("wallets").update({ balance: newBal, updated_at: now.toISOString() }).eq("id", pw.id);
      await db.from("transactions").insert({
        user_id: userId,
        type: "investment_profit",
        wallet_type: "personal",
        amount: profitAmount,
        balance_after: newBal,
        description: `Juros de investimento (${inv.interest_rate}%)`,
        status: "completed",
      });
    }
  }

  // Update investment status
  await db.from("investments").update({ status: "returned", returned_at: now.toISOString() }).eq("id", investmentId);

  return respond({ redeemed: true, profit: profitAmount });
}
