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

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const db = createClient(supabaseUrl, serviceKey);

    const { data: roleData } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Forbidden: admin only");

    const { withdrawal_id } = await req.json();
    if (!withdrawal_id) throw new Error("withdrawal_id required");

    // Fetch withdrawal
    const { data: wd, error: wdErr } = await db
      .from("withdrawals")
      .select("*, profiles!withdrawals_user_id_fkey(full_name, email, phone)")
      .eq("id", withdrawal_id)
      .single();
    if (wdErr || !wd) throw new Error("Withdrawal not found");
    if (wd.status !== "pending") throw new Error("Withdrawal already processed");

    const profile = wd.profiles as any;
    const now = new Date().toISOString();

    // Map PIX key type to Asaas format
    const pixTypeMap: Record<string, string> = {
      cpf: "CPF",
      cnpj: "CNPJ",
      email: "EMAIL",
      telefone: "PHONE",
      phone: "PHONE",
      aleatoria: "EVP",
      evp: "EVP",
    };
    const asaasPixType = pixTypeMap[wd.pix_key_type?.toLowerCase()] || "EVP";

    // Step 1: Create or find customer in Asaas
    let customerId: string | null = null;

    // Search by email
    const searchRes = await fetch(`${ASAAS_BASE}/customers?email=${encodeURIComponent(profile?.email || "")}`, {
      headers: { "access_token": ASAAS_API_KEY },
    });
    const searchData = await searchRes.json();

    if (searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id;
    } else {
      // Create customer
      const createRes = await fetch(`${ASAAS_BASE}/customers`, {
        method: "POST",
        headers: {
          "access_token": ASAAS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profile?.full_name || "Cliente",
          email: profile?.email || undefined,
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

    // Step 2: Create PIX transfer via Asaas
    const transferRes = await fetch(`${ASAAS_BASE}/transfers`, {
      method: "POST",
      headers: {
        "access_token": ASAAS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        value: wd.net_amount,
        operationType: "PIX",
        pixAddressKey: wd.pix_key,
        pixAddressKeyType: asaasPixType,
        description: `Saque #${withdrawal_id.slice(0, 8)} - ${profile?.full_name || ""}`,
      }),
    });

    const transferData = await transferRes.json();

    if (!transferRes.ok) {
      console.error("Asaas transfer error:", JSON.stringify(transferData));

      // Check for specific errors
      const errorMsg = transferData.errors?.[0]?.description || transferData.message || "Erro ao processar transferência PIX";
      throw new Error(errorMsg);
    }

    console.log("Asaas transfer created:", JSON.stringify(transferData));

    // Step 3: Update withdrawal as approved
    await db.from("withdrawals").update({
      status: "approved",
      approved_by: user.id,
      approved_at: now,
      processed_at: now,
      admin_notes: `Asaas transfer: ${transferData.id} | Status: ${transferData.status}`,
    }).eq("id", withdrawal_id);

    // Update transaction
    await db.from("transactions").update({
      status: "approved",
      approved_by: user.id,
      approved_at: now,
    }).eq("reference_id", withdrawal_id).eq("type", "withdrawal");

    // Deduct from blocked_balance on profiles
    const { data: profileData } = await db
      .from("profiles")
      .select("blocked_balance")
      .eq("id", wd.user_id)
      .single();

    await db.from("profiles").update({
      blocked_balance: Math.max((profileData?.blocked_balance ?? 0) - wd.amount, 0),
    }).eq("id", wd.user_id);

    // Log activity
    await db.from("activity_logs").insert({
      user_id: user.id,
      action: "withdrawal_approved_asaas",
      details: {
        withdrawal_id,
        amount: wd.amount,
        net_amount: wd.net_amount,
        pix_key: wd.pix_key,
        asaas_transfer_id: transferData.id,
        asaas_status: transferData.status,
        user_id: wd.user_id,
      },
    });

    return new Response(JSON.stringify({
      ok: true,
      withdrawal_id,
      asaas_transfer_id: transferData.id,
      asaas_status: transferData.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const isAuth = message.includes("Forbidden") || message.includes("Unauthorized") || message.includes("Missing");
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: isAuth ? 403 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
