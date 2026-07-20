import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Upserts the caller's own profile using service-role, since anonymous users
// are excluded from direct write access to public.profiles by RLS.
export const upsertOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      username?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
      blazeUserId?: string | null;
      avatarConfig?: unknown;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      id: context.userId,
      username: data.username ?? null,
      display_name: data.displayName ?? null,
      avatar_url: data.avatarUrl ?? null,
      blaze_user_id: data.blazeUserId ?? null,
      ...(data.avatarConfig !== undefined
        ? { avatar_config: data.avatarConfig as never }
        : {}),
    };
    const { error } = await supabaseAdmin.from("profiles").upsert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Reads the caller's own profile using service-role, since anonymous users
// are excluded from direct read access to public.profiles by RLS.
export const getOwnProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("username, display_name, avatar_config")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { profile: data };
  });