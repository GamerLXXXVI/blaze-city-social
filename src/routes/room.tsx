import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Room } from "@/room/Room";
import { Chat } from "@/room/Chat";
import { useRoomChannel, type LocalPresence } from "@/realtime/useRoomChannel";
import { defaultAvatarConfig, type AvatarConfig } from "@/avatar/types";
import { ROOM_WIDTH, ROOM_HEIGHT, ZONES } from "@/room/zones";
import { zoneAt } from "@/room/zones";

export const Route = createFileRoute("/room")({
  component: RoomPage,
});

function RoomPage() {
  const navigate = useNavigate();
  const [initial, setInitial] = useState<LocalPresence | null>(null);
  const [bartenderOpen, setBartenderOpen] = useState(false);

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
        direction: "south",
        facing: "right",
        state: "idle",
      });
    })();
  }, [navigate]);

  const { players, messages, updatePresence, sendChat } = useRoomChannel("main", initial);

  const handleMove = useCallback(
    (
      pos: { x: number; y: number },
      direction: LocalPresence["direction"],
      facing: LocalPresence["facing"],
      state: "idle" | "walk",
    ) => {
      updatePresence({ x: pos.x, y: pos.y, direction, facing, state });
      const z = zoneAt(pos.x, pos.y);
      if (z?.id !== "bar") {
        setBartenderOpen((open) => (open ? false : open));
      }
    },
    [updatePresence],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const zoneId = (e as CustomEvent<string>).detail;
      const zone = ZONES.find((z) => z.id === zoneId);
      if (!zone) return;
      if (zone.id === "bar") {
        setBartenderOpen(true);
        window.dispatchEvent(
          new CustomEvent("spark-burst", {
            detail: { x: 50, y: 60, count: 20, hue: "gold" },
          }),
        );
      } else if (zone.comingSoon) {
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

  useEffect(() => {
    if (!bartenderOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBartenderOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bartenderOpen]);

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
              <span className="hud-chip px-3 py-1 text-muted-foreground">@{initial.username}</span>
            </div>
          </div>
          <Room
            localId={initial.id}
            localUsername={initial.username}
            localConfig={initial.config}
            remotePlayers={remote}
            messages={messages}
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

      {bartenderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 pointer-events-none"
          role="dialog"
          aria-modal="false"
          aria-label="Bartender"
        >
          <div className="hud-panel pointer-events-auto max-w-md w-full p-5 relative">
            <button
              onClick={() => setBartenderOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground text-lg leading-none"
            >
              ×
            </button>
            <div className="flex items-start gap-4">
              <img
                src="/assets/npcs/bartender-idle-east.gif"
                alt=""
                aria-hidden
                width={64}
                height={64}
                style={{ imageRendering: "pixelated" }}
                className="shrink-0"
              />
              <div>
                <div className="font-mono-display text-[10px] uppercase tracking-[0.25em] text-primary/80 mb-1">
                  Bartender
                </div>
                <p className="text-sm text-foreground/90 leading-snug">
                  Welcome to Blaze City. Drinks are on the house tonight.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
