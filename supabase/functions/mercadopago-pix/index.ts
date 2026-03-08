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

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { amount, description, deposit_type, vip_level_code } = await req.json();

    if (!amount || amount < 1) throw new Error("Valor inválido");

    // Create Mercado Pago PIX payment
    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${user.id}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: description || "Depósito via PIX",
        payment_method_id: "pix",
        payer: {
          email: user.email,
        },
        notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      }),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("MP error:", JSON.stringify(mpData));
      throw new Error(mpData.message || "Erro ao gerar cobrança PIX");
    }

    const pixInfo = mpData.point_of_interaction?.transaction_data;
    const qrCode = pixInfo?.qr_code ?? "";
    const qrCodeBase64 = pixInfo?.qr_code_base64 ?? "";
    const ticketUrl = pixInfo?.ticket_url ?? "";

    // Save deposit with MP payment info using service role
    const db = createClient(supabaseUrl, serviceKey);

    const { data: deposit, error: depErr } = await db.from("deposits").insert({
      user_id: user.id,
      amount,
      status: "pending",
      deposit_type: deposit_type || "balance",
      mp_payment_id: String(mpData.id),
      mp_qr_code: qrCode,
      mp_qr_code_base64: qrCodeBase64,
      mp_ticket_url: ticketUrl,
      admin_notes: vip_level_code ? `VIP upgrade: ${vip_level_code}` : null,
    }).select("id").single();

    if (depErr) {
      console.error("Deposit insert error:", depErr);
      throw new Error("Erro ao salvar depósito");
    }

    // Create pending transaction
    await db.from("transactions").insert({
      user_id: user.id,
      type: deposit_type === "vip_upgrade" ? "vip_upgrade" : "deposit",
      amount,
      description: description || "Depósito via PIX",
      wallet_type: "recharge",
      status: "pending",
      reference_id: deposit.id,
    });

    return new Response(JSON.stringify({
      ok: true,
      deposit_id: deposit.id,
      mp_payment_id: mpData.id,
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      ticket_url: ticketUrl,
      expires_at: mpData.date_of_expiration,
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
