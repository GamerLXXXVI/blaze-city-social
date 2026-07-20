// Returns the Blaze profile for the caller using the stored access token.
// Transparently refreshes the access token via the stored refresh token when
// the current one is expired or about to expire.
// Requires the caller to be an authenticated Supabase user (JWT in Authorization header).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Refresh a bit early so we don't race the expiry.
const REFRESH_SKEW_MS = 60 * 1000;

async function refreshBlazeToken(refreshToken: string) {
  const clientId = Deno.env.get("BLAZE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("BLAZE_CLIENT_SECRET")!;
  const res = await fetch("https://blaze.stream/bapi/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grantType: "refresh_token",
      clientId,
      clientSecret,
      refreshToken,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`refresh_failed:${res.status}:${detail}`);
  }
  const tokens = await res.json();
  return {
    access_token: tokens.accessToken ?? tokens.access_token,
    refresh_token: tokens.refreshToken ?? tokens.refresh_token ?? refreshToken,
    expires_in: tokens.expiresIn ?? tokens.expires_in ?? null,
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: row } = await admin
      .from("blaze_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    if (!row?.access_token) {
      return new Response(JSON.stringify({ error: "no_token" }), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    let accessToken: string = row.access_token;
    const expiresAt = row.expires_at ? Date.parse(row.expires_at) : null;
    const isExpiring = expiresAt !== null && expiresAt - Date.now() <= REFRESH_SKEW_MS;

    if (isExpiring && row.refresh_token) {
      try {
        const refreshed = await refreshBlazeToken(row.refresh_token);
        if (refreshed.access_token) {
          accessToken = refreshed.access_token;
          await admin.from("blaze_tokens").update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: refreshed.expires_in
              ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
              : null,
          }).eq("user_id", userRes.user.id);
        }
      } catch (e) {
        console.error("proactive refresh failed", e);
      }
    }

    const clientId = Deno.env.get("BLAZE_CLIENT_ID")!;
    const profileHeaders = () => ({
      Authorization: `Bearer ${accessToken}`,
      "client-id": clientId,
      Accept: "application/json",
    });
    let res = await fetch("https://api.blaze.stream/v1/users/profile", {
      headers: profileHeaders(),
    });

    // Reactive refresh: token may have been revoked or expired sooner than expected.
    if (res.status === 401 && row.refresh_token) {
      try {
        const refreshed = await refreshBlazeToken(row.refresh_token);
        if (refreshed.access_token) {
          accessToken = refreshed.access_token;
          await admin.from("blaze_tokens").update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
            expires_at: refreshed.expires_in
              ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
              : null,
          }).eq("user_id", userRes.user.id);
          res = await fetch("https://api.blaze.stream/v1/users/profile", {
            headers: profileHeaders(),
          });
        }
      } catch (e) {
        console.error("reactive refresh failed", e);
      }
    }

    const body = await res.text();
    if (!res.ok) {
      console.error("blaze-me: profile fetch failed", { status: res.status, body: body.slice(0, 500) });
    }
    return new Response(body, {
      status: res.status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal", message: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
