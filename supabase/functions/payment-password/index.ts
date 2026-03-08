import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Legacy SHA-256 for migration compatibility
async function hashSHA256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isBcryptHash(hash: string): boolean {
  return hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify JWT using Supabase Auth
    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: authUser }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authUser) throw new Error("Unauthorized");
    const userId = authUser.id;

    const db = createClient(supabaseUrl, serviceKey);
    const { action, ...params } = await req.json();

    if (action === "set") {
      const { password, current_password } = params;

      if (!/^\d{6}$/.test(password)) {
        throw new Error("Senha deve ter 6 dígitos numéricos");
      }

      const { data: profile } = await db
        .from("profiles")
        .select("payment_password_hash")
        .eq("id", userId)
        .single();

      if (profile?.payment_password_hash) {
        if (!current_password) throw new Error("Informe a senha atual");

        let currentValid = false;
        if (isBcryptHash(profile.payment_password_hash)) {
          currentValid = await bcrypt.compare(current_password, profile.payment_password_hash);
        } else {
          const currentHash = await hashSHA256(current_password);
          currentValid = currentHash === profile.payment_password_hash;
        }
        if (!currentValid) throw new Error("Senha atual inválida");
      }

      const newHash = await bcrypt.hash(password);
      await db.from("profiles").update({ payment_password_hash: newHash }).eq("id", userId);

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
        .eq("id", userId)
        .single();

      if (!profile?.payment_password_hash) {
        throw new Error("Senha de pagamento não cadastrada");
      }

      let valid = false;
      if (isBcryptHash(profile.payment_password_hash)) {
        valid = await bcrypt.compare(password, profile.payment_password_hash);
      } else {
        const hash = await hashSHA256(password);
        valid = hash === profile.payment_password_hash;
        if (valid) {
          const upgradedHash = await bcrypt.hash(password);
          await db.from("profiles").update({ payment_password_hash: upgradedHash }).eq("id", userId);
        }
      }

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
