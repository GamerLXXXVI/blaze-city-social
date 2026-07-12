import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AvatarCreator } from "@/avatar/AvatarCreator";
import { defaultAvatarConfig, type AvatarConfig } from "@/avatar/types";

export const Route = createFileRoute("/create")({
  component: Create,
});

function Create() {
  const navigate = useNavigate();
  const [initial, setInitial] = useState<AvatarConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/" });
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("avatar_config")
        .eq("id", sess.session.user.id)
        .maybeSingle();
      setInitial(((data?.avatar_config as unknown as AvatarConfig) ?? null) || defaultAvatarConfig());
    })();
  }, [navigate]);

  const onSave = async (cfg: AvatarConfig) => {
    setSaving(true);
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return;
    await supabase.from("profiles").upsert({
      id: sess.session.user.id,
      avatar_config: cfg as never,
    });
    navigate({ to: "/room" });
  };

  if (!initial) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-3xl font-black">Build your avatar</h1>
          <p className="text-muted-foreground">Cycle through each slot, then step into the room.</p>
        </header>
        <AvatarCreator initial={initial} onSave={onSave} saving={saving} />
      </div>
    </main>
  );
}
