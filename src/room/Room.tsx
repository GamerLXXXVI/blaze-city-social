import { useEffect, useMemo, useRef, useState } from "react";
import { AvatarSprite } from "@/avatar/AvatarSprite";
import { AVATAR_SIZE } from "@/avatar/manifest";
import type { AvatarConfig, Direction, Facing } from "@/avatar/types";
import { ROOM_HEIGHT, ROOM_WIDTH, ZONES, zoneAt } from "./zones";
import { facingFromDelta, stepToward, type Vec2 } from "./movement";
import { EmberField } from "./EmberField";

// Swap to a URL when real background art lands — that's the single-line change.
const BACKGROUND_URL: string | null = null;
const BACKGROUND_COLOR = "var(--room-floor)";

export interface RemotePlayer {
  id: string;
  username: string;
  config: AvatarConfig;
  x: number;
  y: number;
  direction: Direction;
  facing: Facing;
  state: "idle" | "walk";
}

interface Props {
  localId: string;
  localConfig: AvatarConfig;
  localUsername: string;
  remotePlayers: RemotePlayer[];
  onLocalMove: (pos: Vec2, direction: Direction, facing: Facing, state: "idle" | "walk") => void;
}

export function Room({ localId, localConfig, localUsername, remotePlayers, onLocalMove }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Vec2>({ x: ROOM_WIDTH / 2, y: ROOM_HEIGHT / 2 });
  const [target, setTarget] = useState<Vec2>({ x: ROOM_WIDTH / 2, y: ROOM_HEIGHT / 2 });
  const [direction, setDirection] = useState<Direction>("down");
  const [facing, setFacing] = useState<Facing>("right");
  const state: "idle" | "walk" = pos.x === target.x && pos.y === target.y ? "idle" : "walk";

  const lastBroadcastRef = useRef(0);

  // rAF loop for smooth movement
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setPos((p) => {
        const next = stepToward(p, target, dt);
        if (next.x !== p.x || next.y !== p.y) {
          const { direction: d, facing: f } = facingFromDelta(target.x - p.x, target.y - p.y);
          if (d !== direction) setDirection(d);
          if (f !== facing) setFacing(f);
          const nowMs = performance.now();
          if (nowMs - lastBroadcastRef.current > 100) {
            lastBroadcastRef.current = nowMs;
            onLocalMove(next, d, f, "walk");
          }
        } else if (state === "idle") {
          const nowMs = performance.now();
          if (nowMs - lastBroadcastRef.current > 250) {
            lastBroadcastRef.current = nowMs;
            onLocalMove(p, direction, facing, "idle");
          }
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, direction, facing, state, onLocalMove]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scale = rect.width / ROOM_WIDTH;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    setTarget({
      x: Math.max(AVATAR_SIZE / 2, Math.min(ROOM_WIDTH - AVATAR_SIZE / 2, x)),
      y: Math.max(AVATAR_SIZE / 2, Math.min(ROOM_HEIGHT - AVATAR_SIZE / 2, y)),
    });
  };

  const currentZone = useMemo(() => zoneAt(pos.x, pos.y), [pos.x, pos.y]);

  return (
    <div className="relative w-full" style={{ aspectRatio: `${ROOM_WIDTH} / ${ROOM_HEIGHT}` }}>
      <div
        ref={containerRef}
        onClick={handleClick}
        className="absolute inset-0 overflow-hidden rounded-2xl border cursor-crosshair"
        style={{
          background: BACKGROUND_URL ? `center / cover no-repeat url(${BACKGROUND_URL})` : BACKGROUND_COLOR,
          borderColor: "var(--glass-border)",
          boxShadow: "inset 0 0 120px rgba(0,0,0,0.55), 0 30px 80px -30px rgba(0,0,0,0.7)",
        }}
      >
        {/* subtle grid + vignette */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Zones */}
        {ZONES.map((z) => (
          <div
            key={z.id}
            className="absolute rounded-2xl border-2 backdrop-blur-[2px] transition-shadow"
            style={{
              left: `${(z.rect.x / ROOM_WIDTH) * 100}%`,
              top: `${(z.rect.y / ROOM_HEIGHT) * 100}%`,
              width: `${(z.rect.w / ROOM_WIDTH) * 100}%`,
              height: `${(z.rect.h / ROOM_HEIGHT) * 100}%`,
              background: z.color,
              borderColor: z.border,
              boxShadow: `inset 0 0 60px ${z.color}, 0 0 24px -8px ${z.border}`,
            }}
          >
            <span
              className="hud-chip absolute left-3 top-3 px-2.5 py-1 text-foreground/90"
              style={{ borderColor: z.border }}
            >
              {z.label}
            </span>
          </div>
        ))}

        <EmberField />

        {/* Remote players */}
        {remotePlayers
          .filter((p) => p.id !== localId)
          .map((p) => (
            <PlayerMarker key={p.id} player={p} />
          ))}

        {/* Local player */}
        <PlayerMarker
          player={{
            id: localId,
            username: localUsername,
            config: localConfig,
            x: pos.x,
            y: pos.y,
            direction,
            facing,
            state,
          }}
          isLocal
        />
      </div>

      {currentZone && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("zone-action", { detail: currentZone.id }))
            }
            className="btn-ember rounded-full px-7 py-3 text-sm hover:brightness-110 active:scale-[0.98]"
          >
            {currentZone.actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function PlayerMarker({ player, isLocal }: { player: RemotePlayer; isLocal?: boolean }) {
  return (
    <div
      className="absolute pointer-events-none transition-[left,top] duration-100 ease-linear"
      style={{
        left: `${(player.x / ROOM_WIDTH) * 100}%`,
        top: `${(player.y / ROOM_HEIGHT) * 100}%`,
        transform: "translate(-50%, -85%)",
        width: `${(AVATAR_SIZE / ROOM_WIDTH) * 100}%`,
      }}
    >
      <div className="relative flex flex-col items-center">
        <span
          className={`hud-chip mb-1 px-2 py-0.5 ${
            isLocal
              ? "!bg-[color:var(--primary)] !text-[color:var(--primary-foreground)] !border-transparent"
              : "text-foreground/90"
          }`}
        >
          {player.username}
        </span>
        {/* soft shadow under avatar */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: "-6px",
            width: "60%",
            height: "10px",
            background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)",
            filter: "blur(2px)",
          }}
        />
        <div style={{ width: "100%", aspectRatio: "1 / 1" }}>
          <AvatarSprite
            config={player.config}
            direction={player.direction}
            facing={player.facing}
            state={player.state}
            size={AVATAR_SIZE}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
