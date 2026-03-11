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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    console.log("Asaas webhook received:", JSON.stringify(body));

    const event = body.event;
    const payment = body.payment;

    if (!payment || !payment.id) {
      return new Response(JSON.stringify({ ok: true, message: "No payment data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only process confirmed/received payments
    const confirmedEvents = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];
    if (!confirmedEvents.includes(event)) {
      console.log(`Ignoring event: ${event}`);
      return new Response(JSON.stringify({ ok: true, message: `Ignored event: ${event}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const asaasPaymentId = payment.id;
    const externalReference = payment.externalReference; // deposit_id

    // Find deposit by Asaas payment ID or external reference
    let deposit: any = null;

    if (externalReference) {
      const { data } = await db
        .from("deposits")
        .select("*")
        .eq("id", externalReference)
        .single();
      deposit = data;
    }

    if (!deposit) {
      const { data } = await db
        .from("deposits")
        .select("*")
        .eq("mp_payment_id", asaasPaymentId)
        .single();
      deposit = data;
    }

    if (!deposit) {
      console.error("Deposit not found for payment:", asaasPaymentId);
      return new Response(JSON.stringify({ ok: false, error: "Deposit not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: already approved
    if (deposit.status === "approved") {
      console.log("Deposit already approved:", deposit.id);
      return new Response(JSON.stringify({ ok: true, message: "Already processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const depositAmount = Number(deposit.amount);
    const userId = deposit.user_id;
    const isVipUpgrade = deposit.deposit_type === "vip_upgrade";

    // Approve deposit
    await db.from("deposits").update({
      status: "approved",
      approved_at: now,
      admin_notes: deposit.admin_notes
        ? `${deposit.admin_notes} | asaas_confirmed:${asaasPaymentId}`
        : `asaas_confirmed:${asaasPaymentId}`,
    }).eq("id", deposit.id);

    if (isVipUpgrade) {
      // Extract VIP level code from admin_notes
      const vipMatch = deposit.admin_notes?.match(/vip_upgrade:(\w+)/);
      const vipLevelCode = vipMatch?.[1];

      if (vipLevelCode) {
        // Get VIP level number
        const levelNum = vipLevelCode === "intern" ? 0 : Number(vipLevelCode.replace("vip", ""));

        // Update profile VIP level
        await db.from("profiles").update({
          vip_level: levelNum,
          vip_purchased_at: now,
          updated_at: now,
        }).eq("id", userId);

        // Credit recharge wallet
        const { data: wallet } = await db
          .from("wallets")
          .select("id, balance")
          .eq("user_id", userId)
          .eq("wallet_type", "recharge")
          .single();

        if (wallet) {
          const newBalance = Number(wallet.balance ?? 0) + depositAmount;
          await db.from("wallets").update({
            balance: newBalance,
            updated_at: now,
          }).eq("id", wallet.id);

          // Transaction record
          await db.from("transactions").insert({
            user_id: userId,
            type: "deposit",
            wallet_type: "recharge",
            amount: depositAmount,
            balance_after: newBalance,
            description: `Depósito VIP upgrade: ${vipLevelCode}`,
            status: "completed",
            reference_id: deposit.id,
            metadata: { asaas_payment_id: asaasPaymentId, vip_level_code: vipLevelCode },
          });
        }

        // Distribute VIP commissions if applicable
        try {
          // Find vip_plan matching this level code
          const { data: vipPlan } = await db
            .from("vip_plans")
            .select("id, level")
            .eq("level", levelNum)
            .single();

          if (vipPlan) {
            await db.rpc("distribute_vip_commissions", {
              _user_id: userId,
              _vip_plan_id: vipPlan.id,
              _payment_id: asaasPaymentId,
            });
          }
        } catch (err) {
          console.error("Commission distribution error:", err);
        }

        // Distribute deposit commissions
        try {
          await db.rpc("distribute_deposit_commissions", {
            p_user_id: userId,
            p_deposit_amount: depositAmount,
          });
        } catch (err) {
          console.error("Deposit commission error:", err);
        }
      }
    } else {
      // Normal balance deposit → credit recharge wallet
      const { data: wallet } = await db
        .from("wallets")
        .select("id, balance")
        .eq("user_id", userId)
        .eq("wallet_type", "recharge")
        .single();

      if (wallet) {
        const newBalance = Number(wallet.balance ?? 0) + depositAmount;
        await db.from("wallets").update({
          balance: newBalance,
          updated_at: now,
        }).eq("id", wallet.id);

        await db.from("transactions").insert({
          user_id: userId,
          type: "deposit",
          wallet_type: "recharge",
          amount: depositAmount,
          balance_after: newBalance,
          description: "Depósito via PIX",
          status: "completed",
          reference_id: deposit.id,
          metadata: { asaas_payment_id: asaasPaymentId },
        });
      }

      // Distribute deposit commissions
      try {
        await db.rpc("distribute_deposit_commissions", {
          p_user_id: userId,
          p_deposit_amount: depositAmount,
        });
      } catch (err) {
        console.error("Deposit commission error:", err);
      }
    }

    // Log activity
    await db.from("activity_logs").insert({
      user_id: userId,
      action: "deposit_confirmed_asaas",
      details: {
        deposit_id: deposit.id,
        amount: depositAmount,
        asaas_payment_id: asaasPaymentId,
        deposit_type: deposit.deposit_type,
        event,
      },
    });

    console.log("Deposit approved:", deposit.id, "Amount:", depositAmount);

    return new Response(JSON.stringify({ ok: true, deposit_id: deposit.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Webhook error:", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
