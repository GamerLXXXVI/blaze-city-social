// Generates a Blaze OAuth authorization URL (PKCE).
// Returns { authUrl } on success, or { error: 'not_configured' } if secrets are placeholders.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isConfigured(v: string | undefined) {
  return !!v && !v.startsWith("REPLACE_ME_");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const clientId = Deno.env.get("BLAZE_CLIENT_ID");
    const clientSecret = Deno.env.get("BLAZE_CLIENT_SECRET");
    const redirectUri = Deno.env.get("BLAZE_REDIRECT_URI");

    if (!isConfigured(clientId) || !isConfigured(clientSecret) || !isConfigured(redirectUri)) {
      return new Response(
        JSON.stringify({ error: "not_configured", message: "Blaze OAuth credentials are not configured yet." }),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    const res = await fetch("https://blaze.stream/bapi/oauth2/generate-auth-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId,
        clientSecret,
        redirectUri,
        scopes: ["users.read", "offline.access"],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: "upstream_error", detail: text }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const data = await res.json();
    // Expected shape: { authUrl, state, codeVerifier } (per Blaze docs)
    const { authUrl, state, codeVerifier } = data;
    if (!authUrl || !state || !codeVerifier) {
      return new Response(JSON.stringify({ error: "bad_upstream_response", data }), {
        status: 502,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.from("oauth_states").insert({ state, code_verifier: codeVerifier });
    // best-effort cleanup of old states (>10 min)
    await supabase
      .from("oauth_states")
      .delete()
      .lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

    return new Response(JSON.stringify({ authUrl }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal", message: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
