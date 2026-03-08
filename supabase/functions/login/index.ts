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
    const { phone, password } = await req.json();
    if (!phone || !password) throw new Error("missing_fields");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 11) throw new Error("invalid_phone");

    const pseudoEmail = `${phoneDigits}@plataforma.app`;
    const anonClient = createClient(supabaseUrl, anonKey);

    // Try pseudo-email first (new standard)
    let { data, error } = await anonClient.auth.signInWithPassword({
      email: pseudoEmail,
      password,
    });

    // If failed, try legacy email lookup (server-side only, email never exposed to client)
    if (error) {
      const db = createClient(supabaseUrl, serviceKey);
      const { data: realEmail } = await db.rpc("get_auth_email_by_phone", {
        _phone: phoneDigits,
      });
      if (realEmail && realEmail !== pseudoEmail) {
        const result = await anonClient.auth.signInWithPassword({
          email: realEmail,
          password,
        });
        data = result.data;
        error = result.error;
      }
    }

    if (error || !data?.session) {
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_credentials" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
        user: { id: data.session.user.id },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
