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
    <main className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black">
              Blaze <span className="text-primary">City</span>
            </h1>
            <span className="text-xs text-muted-foreground">
              {remote.length} online · logged in as {initial.username}
            </span>
          </div>
          <Room
            localId={initial.id}
            localUsername={initial.username}
            localConfig={initial.config}
            remotePlayers={remote}
            onLocalMove={handleMove}
          />
          <p className="text-xs text-muted-foreground">
            Click anywhere on the floor to walk. Step into a zone for its action.
          </p>
        </div>
        <div className="h-[70vh] md:h-auto md:min-h-[600px]">
          <Chat messages={messages} onSend={sendChat} />
        </div>
      </div>
    </main>
  );
}
