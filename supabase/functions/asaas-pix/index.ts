import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ASAAS_BASE = "https://sandbox.asaas.com/api/v3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY");
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY not configured");

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

    const db = createClient(supabaseUrl, serviceKey);

    const { amount, description, deposit_type, vip_level_code } = await req.json();
    if (!amount || amount <= 0) throw new Error("Valor inválido");

    // Fetch user profile
    const { data: profile } = await db
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .single();

    // Step 1: Create or find customer in Asaas
    let customerId: string | null = null;
    const searchRes = await fetch(
      `${ASAAS_BASE}/customers?email=${encodeURIComponent(profile?.email || user.email || "")}`,
      { headers: { access_token: ASAAS_API_KEY } }
    );
    const searchData = await searchRes.json();

    if (searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id;
    } else {
      const createRes = await fetch(`${ASAAS_BASE}/customers`, {
        method: "POST",
        headers: {
          access_token: ASAAS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profile?.full_name || "Cliente",
          email: profile?.email || user.email || undefined,
          phone: profile?.phone || undefined,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        console.error("Asaas customer create error:", JSON.stringify(createData));
        throw new Error("Erro ao criar cliente no Asaas");
      }
      customerId = createData.id;
    }

    // Step 2: Create deposit record
    const { data: deposit, error: depErr } = await db
      .from("deposits")
      .insert({
        user_id: user.id,
        amount,
        status: "pending",
        deposit_type: deposit_type || "balance",
        admin_notes: vip_level_code ? `vip_upgrade:${vip_level_code}` : null,
      })
      .select("id")
      .single();

    if (depErr || !deposit) {
      console.error("Deposit insert error:", depErr);
      throw new Error("Erro ao registrar depósito");
    }

    // Step 3: Create PIX payment via Asaas
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // 1 day from now
    const dueDateStr = dueDate.toISOString().split("T")[0]; // YYYY-MM-DD

    const paymentRes = await fetch(`${ASAAS_BASE}/payments`, {
      method: "POST",
      headers: {
        access_token: ASAAS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: amount,
        dueDate: dueDateStr,
        description: description || "Depósito na plataforma",
        externalReference: deposit.id,
      }),
    });

    const paymentData = await paymentRes.json();
    if (!paymentRes.ok) {
      console.error("Asaas payment create error:", JSON.stringify(paymentData));
      // Clean up deposit
      await db.from("deposits").delete().eq("id", deposit.id);
      throw new Error(paymentData.errors?.[0]?.description || "Erro ao criar cobrança PIX");
    }

    console.log("Asaas payment created:", paymentData.id);

    // Step 4: Get PIX QR Code
    const pixRes = await fetch(`${ASAAS_BASE}/payments/${paymentData.id}/pixQrCode`, {
      headers: { access_token: ASAAS_API_KEY },
    });
    const pixData = await pixRes.json();

    if (!pixRes.ok) {
      console.error("Asaas PIX QR error:", JSON.stringify(pixData));
      throw new Error("Erro ao gerar QR Code PIX");
    }

    // Update deposit with Asaas payment ID
    await db.from("deposits").update({
      mp_payment_id: paymentData.id,
      mp_qr_code: pixData.payload,
      mp_qr_code_base64: pixData.encodedImage,
    }).eq("id", deposit.id);

    return new Response(
      JSON.stringify({
        ok: true,
        deposit_id: deposit.id,
        qr_code: pixData.payload,
        qr_code_base64: pixData.encodedImage,
        expires_at: pixData.expirationDate,
        asaas_payment_id: paymentData.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const isAuth = message.includes("Unauthorized") || message.includes("Missing");
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      {
        status: isAuth ? 401 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
