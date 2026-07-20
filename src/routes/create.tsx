import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AvatarCreator } from "@/avatar/AvatarCreator";
import { defaultAvatarConfig, type AvatarConfig } from "@/avatar/types";
import { getOwnProfile, upsertOwnProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/create")({
  component: Create,
});

function Create() {
  const navigate = useNavigate();
  const [initial, setInitial] = useState<AvatarConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sess.session) {
        navigate({ to: "/", replace: true });
        return;
      }
      try {
        const res = await getOwnProfile();
        if (cancelled) return;
        const cfg = (res?.profile?.avatar_config as unknown as AvatarConfig) ?? null;
        setInitial(cfg || defaultAvatarConfig());
      } catch (err) {
        console.error("[create] getOwnProfile failed, falling back to defaults", err);
        if (cancelled) return;
        setInitial(defaultAvatarConfig());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const onSave = async (cfg: AvatarConfig) => {
    if (saving) return;
    setSaving(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        toast.error("Session expired — please sign in again");
        setSaving(false);
        navigate({ to: "/", replace: true });
        return;
      }
      const toSave: AvatarConfig = { ...cfg, preset: "blaze-original" };
      console.log("[create] saving avatar", { userId: sess.session.user.id });
      await upsertOwnProfile({ data: { avatarConfig: toSave } });
      console.log("[create] avatar saved OK");
      navigate({ to: "/room", replace: true });
    } catch (err) {
      console.error("[create] upsertOwnProfile failed", err);
      toast.error("Couldn't save your avatar — try again");
      setSaving(false);
    }
  };

  if (!initial) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen text-foreground px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="hud-panel px-6 py-5">
          <p className="font-mono-display text-[10px] uppercase tracking-[0.3em] text-primary/80">
            // avatar builder
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
            Build your <span className="text-ember">look</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cycle through each slot, then step into the city.
          </p>
        </header>
        <AvatarCreator initial={initial} onSave={onSave} saving={saving} />
      </div>
    </main>
  );
}
