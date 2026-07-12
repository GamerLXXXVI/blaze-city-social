// Exchanges the Blaze OAuth code for tokens and stores them server-side.
// Body: { code: string, state: string, supabaseUserId: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { code, state, supabaseUserId } = await req.json();
    if (!code || !state || !supabaseUserId) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: stateRow, error: stateErr } = await supabase
      .from("oauth_states")
      .select("code_verifier")
      .eq("state", state)
      .maybeSingle();
    if (stateErr || !stateRow) {
      return new Response(JSON.stringify({ error: "invalid_state" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const clientId = Deno.env.get("BLAZE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("BLAZE_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("BLAZE_REDIRECT_URI")!;

    const tokenRes = await fetch("https://blaze.stream/bapi/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grantType: "authorization_code",
        clientId,
        clientSecret,
        redirectUri,
        code,
        codeVerifier: stateRow.code_verifier,
      }),
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      return new Response(JSON.stringify({ error: "token_exchange_failed", detail }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const tokens = await tokenRes.json();
    const access = tokens.accessToken ?? tokens.access_token;
    const refresh = tokens.refreshToken ?? tokens.refresh_token ?? null;
    const expiresIn = tokens.expiresIn ?? tokens.expires_in ?? null;

    if (!access) {
      return new Response(JSON.stringify({ error: "no_access_token", tokens }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    await supabase.from("blaze_tokens").upsert({
      user_id: supabaseUserId,
      access_token: access,
      refresh_token: refresh,
      expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    });

    await supabase.from("oauth_states").delete().eq("state", state);

    // Fetch profile
    let profile: unknown = null;
    try {
      const meRes = await fetch("https://api.blaze.stream/v1/users/profile", {
        headers: { Authorization: `Bearer ${access}` },
      });
      if (meRes.ok) profile = await meRes.json();
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ ok: true, profile }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal", message: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
