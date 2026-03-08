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
    const body = await req.json();
    console.log("MP Webhook received:", JSON.stringify(body));

    // Mercado Pago sends notifications with action "payment.created" or "payment.updated"
    if (body.type !== "payment" && body.action !== "payment.updated") {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_payment_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    // Fetch payment details from Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const payment = await mpRes.json();

    if (!mpRes.ok) {
      console.error("MP fetch error:", JSON.stringify(payment));
      throw new Error("Failed to fetch payment from MP");
    }

    console.log(`Payment ${paymentId} status: ${payment.status}`);

    // Only process approved payments
    if (payment.status !== "approved") {
      return new Response(JSON.stringify({ ok: true, status: payment.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // Find deposit by mp_payment_id
    const { data: deposit, error: depErr } = await db
      .from("deposits")
      .select("*")
      .eq("mp_payment_id", String(paymentId))
      .maybeSingle();

    if (depErr || !deposit) {
      console.error("Deposit not found for payment:", paymentId);
      return new Response(JSON.stringify({ ok: true, skipped: "deposit_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already processed
    if (deposit.status !== "pending") {
      return new Response(JSON.stringify({ ok: true, skipped: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const depositType = deposit.deposit_type || "balance";

    // Update deposit status
    await db.from("deposits").update({
      status: "approved",
      approved_at: now,
    }).eq("id", deposit.id);

    // Update transaction status
    await db.from("transactions").update({
      status: "approved",
      approved_at: now,
    }).eq("reference_id", deposit.id);

    if (depositType === "vip_upgrade") {
      // VIP upgrade: extract level code from admin_notes
      const vipCode = deposit.admin_notes?.replace("VIP upgrade: ", "") || "";

      // Find the VIP plan by level code → use vip_plans table
      // The admin_notes has the vip level code, map it to vip_plans
      const levelNum = vipCode === "intern" ? 0 : Number(vipCode.replace("vip", ""));

      const { data: plan } = await db
        .from("vip_plans")
        .select("*")
        .eq("level", levelNum)
        .maybeSingle();

      if (plan) {
        // Use distribute_vip_commissions function
        const { data: result, error: commErr } = await db.rpc("distribute_vip_commissions", {
          _user_id: deposit.user_id,
          _vip_plan_id: plan.id,
          _payment_id: `mp_${paymentId}`,
        });

        console.log("VIP commission result:", JSON.stringify(result), commErr);
      } else {
        // Fallback: just update VIP level
        await db.from("profiles").update({
          vip_level: levelNum,
          vip_purchased_at: now,
        }).eq("id", deposit.user_id);
      }

      // Log
      await db.from("activity_logs").insert({
        user_id: deposit.user_id,
        action: "vip_upgrade_paid",
        details: { deposit_id: deposit.id, mp_payment_id: paymentId, vip_code: vipCode, amount: deposit.amount },
      });
    } else {
      // Normal balance deposit: credit recharge wallet
      const { data: wallet } = await db
        .from("wallets")
        .select("id, balance")
        .eq("user_id", deposit.user_id)
        .eq("wallet_type", "recharge")
        .single();

      if (wallet) {
        await db.from("wallets").update({
          balance: (wallet.balance ?? 0) + deposit.amount,
          updated_at: now,
        }).eq("id", wallet.id);
      }

      // Distribute deposit commissions
      await db.rpc("distribute_deposit_commissions", {
        p_user_id: deposit.user_id,
        p_deposit_amount: deposit.amount,
      });

      // Log
      await db.from("activity_logs").insert({
        user_id: deposit.user_id,
        action: "deposit_auto_approved",
        details: { deposit_id: deposit.id, mp_payment_id: paymentId, amount: deposit.amount },
      });
    }

    return new Response(JSON.stringify({ ok: true, processed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Webhook error:", message);
    // Return 200 so MP doesn't retry indefinitely on errors
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
