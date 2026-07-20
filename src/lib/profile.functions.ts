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
    const row: Record<string, unknown> = { id: context.userId };
    if (data.username !== undefined) row.username = data.username;
    if (data.displayName !== undefined) row.display_name = data.displayName;
    if (data.avatarUrl !== undefined) row.avatar_url = data.avatarUrl;
    if (data.blazeUserId !== undefined) row.blaze_user_id = data.blazeUserId;
    if (data.avatarConfig !== undefined) row.avatar_config = data.avatarConfig;
    const { error } = await supabaseAdmin.from("profiles").upsert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });