import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashSHA256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const db = createClient(supabaseUrl, serviceKey);
    const { action, ...params } = await req.json();

    if (action === "set") {
      // Set or change payment password
      const { password, current_password } = params;

      if (!/^\d{6}$/.test(password)) {
        throw new Error("Senha deve ter 6 dígitos numéricos");
      }

      // Check if already has password
      const { data: profile } = await db
        .from("profiles")
        .select("payment_password_hash")
        .eq("id", user.id)
        .single();

      if (profile?.payment_password_hash) {
        // Changing: verify current
        if (!current_password) throw new Error("Informe a senha atual");
        const currentHash = await hashSHA256(current_password);
        if (currentHash !== profile.payment_password_hash) {
          throw new Error("Senha atual inválida");
        }
      }

      const newHash = await hashSHA256(password);
      await db.from("profiles").update({ payment_password_hash: newHash }).eq("id", user.id);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      const { password } = params;

      if (!/^\d{6}$/.test(password)) {
        return new Response(JSON.stringify({ ok: true, valid: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await db
        .from("profiles")
        .select("payment_password_hash")
        .eq("id", user.id)
        .single();

      if (!profile?.payment_password_hash) {
        throw new Error("Senha de pagamento não cadastrada");
      }

      const hash = await hashSHA256(password);
      const valid = hash === profile.payment_password_hash;

      return new Response(JSON.stringify({ ok: true, valid }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
