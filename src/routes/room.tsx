import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Room } from "@/room/Room";
import { Chat } from "@/room/Chat";
import { useRoomChannel, type LocalPresence } from "@/realtime/useRoomChannel";
import { defaultAvatarConfig, type AvatarConfig } from "@/avatar/types";
import { ROOM_WIDTH, ROOM_HEIGHT, ZONES } from "@/room/zones";

export const Route = createFileRoute("/room")({
  component: RoomPage,
});

function RoomPage() {
  const navigate = useNavigate();
  const [initial, setInitial] = useState<LocalPresence | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate({ to: "/" });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_config")
        .eq("id", sess.session.user.id)
        .maybeSingle();
      if (!profile?.avatar_config) {
        navigate({ to: "/create" });
        return;
      }
      setInitial({
        id: sess.session.user.id,
        username: profile.display_name ?? profile.username ?? "Player",
        config: profile.avatar_config as unknown as AvatarConfig,
        x: ROOM_WIDTH / 2,
        y: ROOM_HEIGHT / 2,
        direction: "down",
        facing: "right",
        state: "idle",
      });
    })();
  }, [navigate]);

  const { players, messages, updatePresence, sendChat } = useRoomChannel("main", initial);

  const handleMove = useCallback(
    (pos: { x: number; y: number }, direction: LocalPresence["direction"], facing: LocalPresence["facing"], state: "idle" | "walk") => {
      updatePresence({ x: pos.x, y: pos.y, direction, facing, state });
    },
    [updatePresence],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const zoneId = (e as CustomEvent<string>).detail;
      const zone = ZONES.find((z) => z.id === zoneId);
      if (!zone) return;
      if (zone.comingSoon) {
        toast.info(`${zone.label} — coming soon`);
      } else {
        toast.success(`${zone.actionLabel}!`);
        window.dispatchEvent(
          new CustomEvent("spark-burst", {
            detail: { x: 50, y: 60, count: 30, hue: zone.id === "dance" ? "violet" : "gold" },
          }),
        );
      }
    };
    window.addEventListener("zone-action", handler);
    return () => window.removeEventListener("zone-action", handler);
  }, []);

  const remote = useMemo(() => players, [players]);

  if (!initial) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Entering the room…
      </main>
    );
  }

  return (
    <main className="min-h-screen text-foreground p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] grid gap-4 md:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <div className="hud-panel flex items-center justify-between px-4 py-2.5">
            <h1 className="text-lg font-extrabold tracking-tight">
              Blaze <span className="text-ember">City</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className="hud-chip px-3 py-1 text-primary/90">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)] align-middle" />
                {remote.length} online
              </span>
              <span className="hud-chip px-3 py-1 text-muted-foreground">
                @{initial.username}
              </span>
            </div>
          </div>
          <Room
            localId={initial.id}
            localUsername={initial.username}
            localConfig={initial.config}
            remotePlayers={remote}
            onLocalMove={handleMove}
          />
          <p className="font-mono-display text-[10px] uppercase tracking-[0.25em] text-muted-foreground/70">
            » click the floor to walk · step into a zone to interact
          </p>
        </div>
        <div className="h-[70vh] md:h-auto md:min-h-[600px]">
          <Chat messages={messages} onSend={sendChat} />
        </div>
      </div>
    </main>
  );
}
