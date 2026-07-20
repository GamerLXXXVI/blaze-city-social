import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Room } from "@/room/Room";
import { Chat } from "@/room/Chat";
import { useRoomChannel, type LocalPresence } from "@/realtime/useRoomChannel";
import { type AvatarConfig } from "@/avatar/types";
import { getOwnProfile } from "@/lib/profile.functions";
import { ROOM_WIDTH, ROOM_HEIGHT, ZONES } from "@/room/zones";
import { zoneAt } from "@/room/zones";
import { BlazeBlaster } from "@/games/BlazeBlaster";
import { useBackgroundMusic } from "@/room/useBackgroundMusic";
import { MusicControls } from "@/room/MusicControls";

export const Route = createFileRoute("/room")({
  component: RoomPage,
});

function RoomPage() {
  const navigate = useNavigate();
  const [initial, setInitial] = useState<LocalPresence | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [bartenderOpen, setBartenderOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const music = useBackgroundMusic();

  // Attempt autoplay on mount; fall back to first click if blocked.
  useEffect(() => {
    if (!initial) return;
    let cancelled = false;
    void music.start().then((ok) => {
      if (cancelled || ok) return;
      const onClick = () => {
        void music.start();
      };
      window.addEventListener("click", onClick, { once: true, capture: true });
      // store cleanup on element via closure
      cleanupRef.current = () => window.removeEventListener("click", onClick, true);
    });
    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sess.session) {
        navigate({ to: "/", replace: true });
        return;
      }
      const userId = sess.session.user.id;
      try {
        const res = await getOwnProfile();
        if (cancelled) return;
        const profile = res?.profile ?? null;
        console.log("[room] profile loaded", {
          userId,
          hasAvatarConfig: !!profile?.avatar_config,
        });
        if (!profile?.avatar_config) {
          navigate({ to: "/create", replace: true });
          return;
        }
        const raw = profile.avatar_config as unknown as AvatarConfig;
        const config: AvatarConfig = raw.preset
          ? raw
          : { ...raw, preset: "blaze-original" };
        setInitial({
          id: userId,
          username: profile.display_name ?? profile.username ?? "Player",
          config,
          x: ROOM_WIDTH / 2,
          y: ROOM_HEIGHT / 2,
          direction: "south",
          facing: "right",
          state: "idle",
        });
      } catch (err) {
        console.error("[room] getOwnProfile failed", { userId, err });
        if (cancelled) return;
        setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, reloadKey]);

  const { players, messages, updatePresence, sendChat } = useRoomChannel("main", initial);

  const handleMove = useCallback(
    (
      pos: { x: number; y: number },
      direction: LocalPresence["direction"],
      facing: LocalPresence["facing"],
      state: "idle" | "walk" | "dance" | "sit",
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
      } else if (zone.id === "games") {
        setGameOpen(true);
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

  if (loadState === "error") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-muted-foreground">
        <p>Couldn't load your profile.</p>
        <button
          className="hud-chip px-4 py-2 text-primary/90"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          Retry
        </button>
      </main>
    );
  }

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
              <MusicControls
                volume={music.volume}
                muted={music.muted}
                onVolumeChange={music.setVolume}
                onToggleMute={music.toggleMute}
              />
              <button
                className="hud-chip px-3 py-1 text-muted-foreground hover:text-ember transition-colors"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/", replace: true });
                }}
                title="Sign out"
              >
                Log out
              </button>
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

      {gameOpen && <BlazeBlaster onExit={() => setGameOpen(false)} />}
    </main>
  );
}
