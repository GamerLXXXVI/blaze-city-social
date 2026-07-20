import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvatarSprite } from "@/avatar/AvatarSprite";
import { AVATAR_SIZE, PLAYER_SPRITE_SCALE, NPC_RENDER_SCALE } from "@/avatar/manifest";
import type { AvatarConfig, Direction, Facing, AnimState } from "@/avatar/types";
import { DIRECTIONS } from "@/avatar/types";
import { ROOM_HEIGHT, ROOM_WIDTH, ZONES, zoneAt } from "./zones";
import { isBlocked } from "./zones";
import { facingFromDelta, stepToward, type Vec2 } from "./movement";
import { EmberField } from "./EmberField";
import type { ChatMessage } from "./Chat";

const BUBBLE_VISIBLE_MS = 6000;
const BUBBLE_FADE_MS = 1000;
const BUBBLE_MAX_CHARS = 120;
const BUBBLE_MAX_WIDTH_PX = 200;
const BUBBLE_EDGE_THRESHOLD = 100;

// Measured foot row on the 64px source sprite (bottom-most non-transparent
// pixel is consistently at row 46 across all 8 idle directions and every
// walk frame). Sprites are drawn full-canvas in the compositor so this
// fraction applies directly to the rendered sprite box.
const FOOT_ANCHOR_PCT = 46 / 64; // 0.71875

// Seat anchor for the sit pose — the row on the 64px source sprite where
// the hip/butt makes contact with the stool. Calibrated by inspecting the
// west sit sprite (hip row ≈ 40 in the padded 64x64 canvas) and cross-
// checked against the south sit; each stool's world Y is placed at the
// visible seat-top pixel of the stool art so this anchor lands the player
// squarely on the seat.
const SIT_ANCHOR_PCT = 40 / 64; // 0.625

// Stool world coordinates, measured directly against the room art:
// scanned column x=68-70 (source px) of blaze-city-main.png for reddish
// seat pixels and identified four stool tops at source rows 58, 73, 89,
// and 107. Source→world = ×4, so seat centers land at world x=276 and
// y=232, 292, 356, 428. Players face west when seated so they look toward
// the bar counter (which sits immediately west at world x≈248).
interface Stool {
  id: string;
  seat: Vec2;
}
const STOOLS: Stool[] = [
  { id: "stool-1", seat: { x: 276, y: 232 } },
  { id: "stool-2", seat: { x: 276, y: 292 } },
  { id: "stool-3", seat: { x: 276, y: 356 } },
  { id: "stool-4", seat: { x: 276, y: 428 } },
];
const STOOL_HITBOX_HALF_W = 20;
const STOOL_HITBOX_HALF_H = 24;
function stoolAt(x: number, y: number): Stool | null {
  for (const s of STOOLS) {
    if (
      Math.abs(x - s.seat.x) <= STOOL_HITBOX_HALF_W &&
      Math.abs(y - s.seat.y) <= STOOL_HITBOX_HALF_H
    ) {
      return s;
    }
  }
  return null;
}

// 320x180 source scaled 4x nearest-neighbor to fill the 1280x720 logical room.
const BACKGROUND_URL: string | null = "/assets/rooms/blaze-city-main.png";
const BACKGROUND_COLOR = "var(--room-floor)";

export interface RemotePlayer {
  id: string;
  username: string;
  config: AvatarConfig;
  x: number;
  y: number;
  direction: Direction;
  facing: Facing;
  state: "idle" | "walk" | "dance" | "sit";
}

interface Props {
  localId: string;
  localConfig: AvatarConfig;
  localUsername: string;
  remotePlayers: RemotePlayer[];
  messages: ChatMessage[];
  onLocalMove: (
    pos: Vec2,
    direction: Direction,
    facing: Facing,
    state: "idle" | "walk" | "dance" | "sit",
  ) => void;
}

type Mode = "idle" | "walk" | "turning" | "dance" | "sit";
const DIRECTION_ORDER: Direction[] = [
  "south",
  "south-west",
  "west",
  "north-west",
  "north",
  "north-east",
  "east",
  "south-east",
];
const TURN_FRAME_MS = 90;
// Silence unused-import lint on DIRECTIONS while keeping the type source
// available if we later validate direction strings from remote peers.
void DIRECTIONS;

export function Room({ localId, localConfig, localUsername, remotePlayers, messages, onLocalMove }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Vec2>({ x: ROOM_WIDTH / 2, y: ROOM_HEIGHT / 2 });
  const [target, setTarget] = useState<Vec2>({ x: ROOM_WIDTH / 2, y: ROOM_HEIGHT / 2 });
  const [direction, setDirection] = useState<Direction>("south");
  const [facing, setFacing] = useState<Facing>("right");
  const [mode, setMode] = useState<Mode>("idle");
  const modeRef = useRef<Mode>("idle");
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  // When set, indicates the local player is walking toward a stool and
  // should snap into "sit" mode upon arrival. Ref (not state) so the rAF
  // loop can read/clear it without re-subscribing.
  const pendingSitRef = useRef<Stool | null>(null);
  const walkOrIdleState: "idle" | "walk" =
    pos.x === target.x && pos.y === target.y ? "idle" : "walk";
  const renderState: AnimState =
    mode === "dance"
      ? "dance"
      : mode === "sit"
        ? "sit"
        : mode === "turning"
          ? "idle"
          : walkOrIdleState;
  const renderDirection: Direction = mode === "dance" ? "south" : direction;
  const turnTimerRef = useRef<number | null>(null);
  const clearTurnTimer = useCallback(() => {
    if (turnTimerRef.current !== null) {
      window.clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTurnTimer(), [clearTurnTimer]);

  const lastBroadcastRef = useRef(0);

  // rAF loop for smooth movement
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // While turning / dancing the local position is frozen; skip stepping
      // and broadcasting so we don't overwrite the emote state on the wire.
      if (modeRef.current === "turning" || modeRef.current === "dance") {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (modeRef.current === "sit") {
        raf = requestAnimationFrame(tick);
        return;
      }
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
        } else if (walkOrIdleState === "idle") {
          // Arrived. If we were en route to a stool, snap into sit.
          const pending = pendingSitRef.current;
          if (pending && next.x === pending.seat.x && next.y === pending.seat.y) {
            pendingSitRef.current = null;
            setDirection("west");
            setFacing("left");
            setMode("sit");
            onLocalMove(next, "west", "left", "sit");
            return next;
          }
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
  }, [target, direction, facing, walkOrIdleState, onLocalMove]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scale = rect.width / ROOM_WIDTH;
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    // Stool click — walk to the stool's seat and snap into sit on arrival.
    // Test BEFORE the blocker check because stool hitboxes may overlap the
    // bar counter blocker; we allow the target regardless (movement will
    // still slide around blockers en route).
    const stool = stoolAt(x, y);
    if (stool) {
      if (mode === "turning" || mode === "dance" || mode === "sit") {
        clearTurnTimer();
        setMode("idle");
      }
      pendingSitRef.current = stool;
      setTarget({ x: stool.seat.x, y: stool.seat.y });
      return;
    }
    const cx = Math.max(AVATAR_SIZE / 2, Math.min(ROOM_WIDTH - AVATAR_SIZE / 2, x));
    const cy = Math.max(AVATAR_SIZE / 2, Math.min(ROOM_HEIGHT - AVATAR_SIZE / 2, y));
    // Reject click targets that fall inside a blocker.
    if (isBlocked(cx, cy)) return;
    // Floor click interrupts a turning/dance/sit emote and starts walking.
    if (mode === "turning" || mode === "dance" || mode === "sit") {
      clearTurnTimer();
      pendingSitRef.current = null;
      setMode("idle");
    }
    setTarget({ x: cx, y: cy });
  };

  const startDance = useCallback(() => {
    // Guard against re-entering turning or spamming presses.
    if (mode === "turning") return;
    if (mode === "dance") {
      // Toggle off: snap to south idle.
      clearTurnTimer();
      setMode("idle");
      setDirection("south");
      setTarget(pos);
      onLocalMove(pos, "south", facing, "idle");
      return;
    }
    // Freeze position so the rAF loop settles to idle (dist becomes 0).
    setTarget(pos);
    const currentIdx = Math.max(0, DIRECTION_ORDER.indexOf(direction));
    const forwardSteps = (0 - currentIdx + 8) % 8;
    const backwardSteps = currentIdx;
    const steps: Direction[] = [];
    if (forwardSteps <= backwardSteps) {
      for (let s = 1; s <= forwardSteps; s++) {
        steps.push(DIRECTION_ORDER[(currentIdx + s) % 8]);
      }
    } else {
      for (let s = 1; s <= backwardSteps; s++) {
        steps.push(DIRECTION_ORDER[(currentIdx - s + 8) % 8]);
      }
    }
    setMode("turning");
    let i = 0;
    const tick = () => {
      if (i < steps.length) {
        const d = steps[i++];
        setDirection(d);
        onLocalMove(pos, d, facing, "idle");
        turnTimerRef.current = window.setTimeout(tick, TURN_FRAME_MS);
      } else {
        turnTimerRef.current = window.setTimeout(() => {
          setDirection("south");
          setMode("dance");
          onLocalMove(pos, "south", facing, "dance");
        }, TURN_FRAME_MS);
      }
    };
    tick();
  }, [mode, direction, facing, pos, onLocalMove, clearTurnTimer]);

  const currentZone = useMemo(() => zoneAt(pos.x, pos.y), [pos.x, pos.y]);

  // Ticks re-renders so bubbles can expire/fade without per-bubble timers.
  const [tickNow, setTickNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setTickNow(Date.now()), 200);
    return () => window.clearInterval(iv);
  }, []);

  // Latest chat message per player (by senderId, falling back to username).
  const latestByPlayer = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    const byUsername = new Map<string, ChatMessage>();
    for (const m of messages) {
      if (m.senderId) {
        const prev = map.get(m.senderId);
        if (!prev || m.ts > prev.ts) map.set(m.senderId, m);
      } else {
        const prev = byUsername.get(m.username);
        if (!prev || m.ts > prev.ts) byUsername.set(m.username, m);
      }
    }
    return { byId: map, byUsername };
  }, [messages]);

  const bubbleFor = (playerId: string, username: string): ChatMessage | null => {
    const m = latestByPlayer.byId.get(playerId) ?? latestByPlayer.byUsername.get(username);
    if (!m) return null;
    const age = tickNow - m.ts;
    if (age >= BUBBLE_VISIBLE_MS) return null;
    return m;
  };

  return (
    <div className="relative w-full" style={{ aspectRatio: `${ROOM_WIDTH} / ${ROOM_HEIGHT}` }}>
      <div
        ref={containerRef}
        onClick={handleClick}
        className="absolute inset-0 overflow-hidden rounded-2xl border cursor-crosshair"
        style={{
          backgroundColor: "#14110D",
          backgroundImage: BACKGROUND_URL ? `url(${BACKGROUND_URL})` : undefined,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          imageRendering: "pixelated",
          ...(BACKGROUND_URL ? {} : { background: BACKGROUND_COLOR }),
          borderColor: "var(--glass-border)",
          boxShadow: "inset 0 0 120px rgba(0,0,0,0.55), 0 30px 80px -30px rgba(0,0,0,0.7)",
        }}
      >
        {/* Zones — restrained outline; artwork stays fully visible. Highlight only the player's current zone. */}
        {ZONES.map((z) => {
          const isCurrent = currentZone?.id === z.id;
          return (
            <div
              key={z.id}
              className="absolute rounded-xl border transition-all pointer-events-none"
              style={{
                left: `${(z.rect.x / ROOM_WIDTH) * 100}%`,
                top: `${(z.rect.y / ROOM_HEIGHT) * 100}%`,
                width: `${(z.rect.w / ROOM_WIDTH) * 100}%`,
                height: `${(z.rect.h / ROOM_HEIGHT) * 100}%`,
                background: isCurrent ? z.color : "transparent",
                borderColor: z.border,
                borderWidth: isCurrent ? 2 : 1,
                boxShadow: isCurrent ? `0 0 24px -6px ${z.border}` : "none",
                opacity: isCurrent ? 1 : 0.55,
              }}
            >
              <span
                className="hud-chip absolute left-2 top-2 px-2 py-0.5 text-foreground/90"
                style={{ borderColor: z.border }}
              >
                {z.label}
              </span>
            </div>
          );
        })}

        <EmberField />

        {/* Bartender NPC — static GIF, browser-native loop. Positioned on the
            top-left alcove of the bar structure — a distinct recessed tile
            in the wall/counter art with a hanging bulb directly above.
            Foot anchor at world (170, 425). Clip includes feet (rows 0–47).
            */}
        {(() => {
          const NPC_X = 170;
          const NPC_Y = 425;
          const NPC_CLIP_ROWS = 48; // rows 0..47 → include feet at row 47
          const NPC_SRC_ROWS = 64;
          return (
            <>
              <div
                aria-hidden
                className="absolute pointer-events-none overflow-hidden"
                style={{
                  left: `${(NPC_X / ROOM_WIDTH) * 100}%`,
                  top: `${(NPC_Y / ROOM_HEIGHT) * 100}%`,
                  width: `${((64 * NPC_RENDER_SCALE) / ROOM_WIDTH) * 100}%`,
                  height: `${((NPC_CLIP_ROWS * NPC_RENDER_SCALE) / ROOM_HEIGHT) * 100}%`,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <img
                  src="/assets/npcs/bartender-idle-east.gif"
                  alt=""
                  style={{
                    width: "100%",
                    height: `${(NPC_SRC_ROWS / NPC_CLIP_ROWS) * 100}%`,
                    imageRendering: "pixelated",
                    display: "block",
                  }}
                  draggable={false}
                  onError={(e) => {
                    const src = (e.currentTarget as HTMLImageElement).src;
                    // eslint-disable-next-line no-console
                    console.error("[bartender] failed to load NPC sprite", src);
                  }}
                />
              </div>
            </>
          );
        })()}

        {/* Remote players */}
        {remotePlayers
          .filter((p) => p.id !== localId)
          .map((p) => (
            <PlayerMarker key={p.id} player={p} bubble={bubbleFor(p.id, p.username)} now={tickNow} />
          ))}

        {/* Local player */}
        <PlayerMarker
          player={{
            id: localId,
            username: localUsername,
            config: localConfig,
            x: pos.x,
            y: pos.y,
            direction: renderDirection,
            facing,
            state: renderState,
          }}
          isLocal
          bubble={bubbleFor(localId, localUsername)}
          now={tickNow}
        />
      </div>

      {currentZone && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() =>
              currentZone.id === "dance"
                ? startDance()
                : window.dispatchEvent(
                    new CustomEvent("zone-action", { detail: currentZone.id }),
                  )
            }
            className="btn-ember rounded-full px-7 py-3 text-sm hover:brightness-110 active:scale-[0.98]"
          >
            {currentZone.id === "dance" && mode === "dance"
              ? "Stop dancing"
              : currentZone.actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function PlayerMarker({
  player,
  isLocal,
  bubble,
  now,
}: {
  player: RemotePlayer;
  isLocal?: boolean;
  bubble?: ChatMessage | null;
  now?: number;
}) {
  // The marker div IS the scaled sprite box. Its top-left is placed at the
  // player's world coord, then translated so the sprite's measured foot row
  // (FOOT_ANCHOR_PCT down from the top of the box) lands exactly on that
  // coord. Because PLAYER_SPRITE_SCALE grows the whole box uniformly, the
  // scaled sprite's feet also land on the anchor.
  const scaledWidthPct = ((AVATAR_SIZE * PLAYER_SPRITE_SCALE) / ROOM_WIDTH) * 100;
  // Sitting sprites contact the stool at the hip row (SIT_ANCHOR_PCT),
  // not the standing foot row. Switch anchors so the same world coord
  // means "seat contact" while sitting and "foot contact" otherwise.
  const anchorPct = player.state === "sit" ? SIT_ANCHOR_PCT : FOOT_ANCHOR_PCT;
  // Local player: no CSS transition — rAF loop drives smooth motion frame by
  // frame, and a transition here would fight the loop and roughly double
  // perceived speed while smearing the target. Remote players still need the
  // transition to smooth between throttled ~10Hz presence updates.
  const transitionClass = isLocal ? "" : "transition-[left,top] duration-100 ease-linear";
  return (
    <div
      className={`absolute pointer-events-none ${transitionClass}`}
      style={{
        left: `${(player.x / ROOM_WIDTH) * 100}%`,
        top: `${(player.y / ROOM_HEIGHT) * 100}%`,
        width: `${scaledWidthPct}%`,
        aspectRatio: "1 / 1",
        transform: `translate(-50%, -${anchorPct * 100}%)`,
      }}
    >
      {/* Sprite fills the marker box. */}
      <AvatarSprite
        config={player.config}
        direction={player.direction}
        facing={player.facing}
        state={player.state}
        className="w-full h-full block"
      />

      {/* Soft shadow centered exactly on the foot anchor. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: `${anchorPct * 100}%`,
          transform: "translate(-50%, -50%)",
          width: "45%",
          height: "10px",
          background:
            "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, transparent 70%)",
          filter: "blur(2px)",
          zIndex: -1,
        }}
      />

      {/* Label stack (bubble + username) floats just above the sprite box,
          anchored to sprite-box top-center. ChatBubble is absolute-positioned
          relative to this wrapper, matching its previous behavior. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "100%",
          transform: "translateX(-50%)",
          paddingBottom: 4,
        }}
      >
        <div className="relative flex flex-col items-center">
          {bubble && (
            <ChatBubble message={bubble} playerX={player.x} now={now ?? Date.now()} />
          )}
          <span
            className={`hud-chip px-2 py-0.5 ${
              isLocal
                ? "!bg-[color:var(--primary)] !text-[color:var(--primary-foreground)] !border-transparent"
                : "text-foreground/90"
            }`}
          >
            {player.username}
          </span>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  playerX,
  now,
}: {
  message: ChatMessage;
  playerX: number;
  now: number;
}) {
  const age = now - message.ts;
  const remaining = BUBBLE_VISIBLE_MS - age;
  const opacity = remaining >= BUBBLE_FADE_MS ? 1 : Math.max(0, remaining / BUBBLE_FADE_MS);

  const truncated =
    message.text.length > BUBBLE_MAX_CHARS
      ? message.text.slice(0, BUBBLE_MAX_CHARS - 1).trimEnd() + "…"
      : message.text;

  // Edge handling: anchor bubble to keep it within the room bounds.
  // "left" edge = bubble grows right (pointer on its left side).
  // "right" edge = bubble grows left (pointer on its right side).
  // "center" = bubble centered above avatar, pointer bottom-center.
  let side: "left" | "right" | "center" = "center";
  if (playerX < BUBBLE_EDGE_THRESHOLD) side = "left";
  else if (playerX > ROOM_WIDTH - BUBBLE_EDGE_THRESHOLD) side = "right";

  const positionStyle: React.CSSProperties =
    side === "center"
      ? { left: "50%", transform: "translateX(-50%)" }
      : side === "left"
        ? { left: "50%" }
        : { right: "50%" };

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        bottom: "calc(100% + 6px)",
        ...positionStyle,
        zIndex: message.ts,
        opacity,
        transition: "opacity 120ms linear",
        width: "max-content",
        maxWidth: BUBBLE_MAX_WIDTH_PX,
      }}
    >
      <div
        style={{
          background: "#f8f1e4",
          color: "#1a1410",
          border: "1px solid #1a1410",
          borderRadius: 10,
          padding: "6px 10px",
          fontSize: 12,
          lineHeight: 1.3,
          fontFamily: "var(--font-body, inherit)",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          whiteSpace: "normal",
          boxShadow: "0 2px 0 rgba(0,0,0,0.25)",
          position: "relative",
        }}
      >
        {truncated}
      </div>
      {/* Pointer — a small square rotated 45°, positioned per side. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          width: 8,
          height: 8,
          background: "#f8f1e4",
          borderRight: "1px solid #1a1410",
          borderBottom: "1px solid #1a1410",
          transform: "rotate(45deg)",
          bottom: -5,
          ...(side === "center"
            ? { left: "50%", marginLeft: -4 }
            : side === "left"
              ? { left: 10 }
              : { right: 10 }),
        }}
      />
    </div>
  );
}
