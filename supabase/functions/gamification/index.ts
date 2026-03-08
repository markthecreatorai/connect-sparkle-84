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
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Decode JWT payload directly (stateless, no session lookup)
    const token = authHeader.replace("Bearer ", "");
    const payloadB64url = token.split(".")[1];
    if (!payloadB64url) throw new Error("Unauthorized");
    // Convert base64url to standard base64
    const payloadB64 = payloadB64url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(payloadB64));
    const userId = payload.sub as string;
    if (!userId) throw new Error("Unauthorized");

    const db = createClient(supabaseUrl, serviceKey);
    const { action } = await req.json();

    if (action === "checkin") {
      return await doCheckin(db, userId);
    }
    if (action === "spin") {
      return await doSpin(db, userId);
    }
    if (action === "status") {
      return await getStatus(db, userId);
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const isAuthError = message.includes("Unauthorized") || message.includes("Missing authorization");
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: isAuthError ? 401 : 200,
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

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

async function getStatus(db: DB, userId: string) {
  const today = todayStr();

  const [checkinRes, spinRes, streakRes] = await Promise.all([
    db.from("daily_checkins").select("id").eq("user_id", userId).eq("checkin_date", today).maybeSingle(),
    db.from("spin_history").select("id").eq("user_id", userId).eq("spin_date", today).maybeSingle(),
    db.from("daily_checkins").select("streak_count").eq("user_id", userId).order("checkin_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return respond({
    checkin_done: !!checkinRes.data,
    spin_done: !!spinRes.data,
    streak: streakRes.data?.streak_count ?? 0,
  });
}

async function doCheckin(db: DB, userId: string) {
  const today = todayStr();

  // Check if already done today
  const { data: existing } = await db
    .from("daily_checkins")
    .select("id")
    .eq("user_id", userId)
    .eq("checkin_date", today)
    .maybeSingle();

  if (existing) throw new Error("Check-in já realizado hoje");

  // Calculate streak
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const { data: lastCheckin } = await db
    .from("daily_checkins")
    .select("streak_count, checkin_date")
    .eq("user_id", userId)
    .order("checkin_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let streak = 1;
  if (lastCheckin?.checkin_date === yesterdayStr) {
    streak = (lastCheckin.streak_count ?? 0) + 1;
  }

  const reward = 0.50;

  // Insert checkin
  await db.from("daily_checkins").insert({
    user_id: userId,
    checkin_date: today,
    streak_count: streak,
    reward_amount: reward,
  });

  // Credit personal wallet
  const { data: wallet } = await db
    .from("wallets")
    .select("id, balance")
    .eq("user_id", userId)
    .eq("wallet_type", "personal")
    .single();

  if (wallet) {
    const newBal = Number((Number(wallet.balance || 0) + reward).toFixed(2));
    await db.from("wallets").update({ balance: newBal, updated_at: new Date().toISOString() }).eq("id", wallet.id);
    await db.from("transactions").insert({
      user_id: userId,
      type: "bonus",
      wallet_type: "personal",
      amount: reward,
      balance_after: newBal,
      description: "Check-in diário",
      status: "completed",
    });
  }

  return respond({ streak, reward });
}

async function doSpin(db: DB, userId: string) {
  const today = todayStr();

  // Check if already spun today
  const { data: existing } = await db
    .from("spin_history")
    .select("id")
    .eq("user_id", userId)
    .eq("spin_date", today)
    .maybeSingle();

  if (existing) throw new Error("Você já girou a roleta hoje");

  // Weighted random prize
  const prizes = [
    { amount: 1, weight: 40 },
    { amount: 5, weight: 25 },
    { amount: 10, weight: 15 },
    { amount: 20, weight: 10 },
    { amount: 50, weight: 5 },
    { amount: 100, weight: 3 },
    { amount: 0, weight: 2 },
  ];

  const totalWeight = prizes.reduce((s, p) => s + p.weight, 0);
  let roll = Math.random() * totalWeight;
  let prize = 0;
  for (const p of prizes) {
    roll -= p.weight;
    if (roll <= 0) {
      prize = p.amount;
      break;
    }
  }

  // Record spin
  await db.from("spin_history").insert({
    user_id: userId,
    spin_date: today,
    prize_amount: prize,
  });

  // Credit if won
  if (prize > 0) {
    const { data: wallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("user_id", userId)
      .eq("wallet_type", "personal")
      .single();

    if (wallet) {
      const newBal = Number((Number(wallet.balance || 0) + prize).toFixed(2));
      await db.from("wallets").update({ balance: newBal, updated_at: new Date().toISOString() }).eq("id", wallet.id);
      await db.from("transactions").insert({
        user_id: userId,
        type: "spin_prize",
        wallet_type: "personal",
        amount: prize,
        balance_after: newBal,
        description: `Prêmio da roleta: R$${prize.toFixed(2)}`,
        status: "completed",
      });
    }
  }

  return respond({ prize });
}
