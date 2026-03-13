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
    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const db = createClient(supabaseUrl, serviceKey);

    // Check admin role
    const { data: roleData } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Unauthorized: admin only");

    const { withdrawal_id } = await req.json();
    if (!withdrawal_id) throw new Error("withdrawal_id is required");

    // Fetch withdrawal
    const { data: withdrawal, error: wdErr } = await db
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawal_id)
      .single();

    if (wdErr || !withdrawal) throw new Error("Saque não encontrado");
    if (withdrawal.status !== "pending") throw new Error("Saque já processado");

    const now = new Date().toISOString();

    // Send PIX via Mercado Pago - using the payment endpoint with PIX transfer
    // MP uses POST /v1/payments for sending money via PIX
    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `payout-${withdrawal_id}`,
      },
      body: JSON.stringify({
        transaction_amount: withdrawal.net_amount,
        description: `Saque #${withdrawal_id.slice(0, 8)}`,
        payment_method_id: "pix",
        payer: {
          email: "pagamentos@plataforma.com",
        },
        point_of_interaction: {
          type: "PIX_TRANSFER",
          transaction_data: {
            bank_info: {
              pix_key: withdrawal.pix_key,
              pix_key_type: withdrawal.pix_key_type,
            },
          },
        },
        external_reference: withdrawal_id,
      }),
    });

    const mpData = await mpRes.json();
    console.log("MP payout response:", JSON.stringify(mpData));

    if (!mpRes.ok) {
      console.error("MP payout error:", JSON.stringify(mpData));
      throw new Error(mpData.message || "Erro ao enviar PIX via Mercado Pago");
    }

    // Update withdrawal status
    await db.from("withdrawals").update({
      status: "approved",
      approved_by: user.id,
      approved_at: now,
      processed_at: now,
      admin_notes: `MP Payment ID: ${mpData.id}`,
    }).eq("id", withdrawal_id);

    // Update transaction status
    await db.from("transactions").update({
      status: "approved",
      approved_by: user.id,
      approved_at: now,
    }).eq("reference_id", withdrawal_id);

    // Log
    await db.from("activity_logs").insert({
      user_id: user.id,
      action: "withdrawal_approved_mp",
      details: {
        withdrawal_id,
        mp_payment_id: mpData.id,
        amount: withdrawal.net_amount,
        pix_key: withdrawal.pix_key,
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      mp_payment_id: mpData.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes("Unauthorized") || message.includes("Missing") ? 403 : 400;
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
