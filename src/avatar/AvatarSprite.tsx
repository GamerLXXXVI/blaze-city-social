import { useEffect, useRef, useState } from "react";
import { compositeFrame } from "./compositor";
import {
  AVATAR_SIZE,
  danceFrameCount,
  danceFrameMs,
  idleFrameCount,
  idleFrameMs,
  preloadFemaleWalkFrames,
  preloadFemaleDanceFrames,
  walkFrameCount,
  walkFrameMs,
} from "./manifest";
import {
  normalizeDirection,
  type AvatarConfig,
  type Direction,
  type AnimState,
  type Facing,
} from "./types";

interface Props {
  config: AvatarConfig;
  direction: Direction;
  state: AnimState;
  facing?: Facing;
  size?: number;
  className?: string;
}

export function AvatarSprite({
  config,
  direction,
  state,
  facing = "right",
  size,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frame, setFrame] = useState(0);

  const gender = config.gender;
  useEffect(() => {
    if (gender === "female") preloadFemaleWalkFrames();
  }, [gender]);

  const walkCount = walkFrameCount(config);
  const walkMs = walkFrameMs(config);
  const idleCount = idleFrameCount(config);
  const idleMs = idleFrameMs(config);
  const danceCount = danceFrameCount(config);
  const danceMs = danceFrameMs(config);

  // Restarts only when the animation state or the facing direction changes —
  // position updates alone must not reset the cycle.
  useEffect(() => {
    if (state === "walk") {
      setFrame(0);
      const id = window.setInterval(() => setFrame((f) => (f + 1) % walkCount), walkMs);
      return () => window.clearInterval(id);
    }
    if (state === "dance") {
      // Wall-clock derived so every connected client shows the same frame of
      // the loop at the same moment. Playback starts only once every frame is
      // decoded, so the first loop never pauses.
      const at = () => Math.floor(Date.now() / danceMs) % danceCount;
      let id = 0;
      let cancelled = false;
      const start = () => {
        if (cancelled) return;
        setFrame(at());
        id = window.setInterval(() => setFrame(at()), danceMs);
      };
      if (gender === "female") {
        void preloadFemaleDanceFrames().then(start, start);
      } else {
        start();
      }
      return () => {
        cancelled = true;
        if (id) window.clearInterval(id);
      };
    }
    setFrame(0);
    if (state === "idle" && idleCount > 1) {
      const id = window.setInterval(() => setFrame((f) => (f + 1) % idleCount), idleMs);
      return () => window.clearInterval(id);
    }
  }, [state, direction, facing, gender, walkCount, walkMs, idleCount, idleMs, danceCount, danceMs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const composed = await compositeFrame(
        config,
        normalizeDirection(direction, facing),
        state,
        frame,
        facing,
      );
      if (cancelled) return;
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(composed, 0, 0, c.width, c.height);
    })();
    return () => {
      cancelled = true;
    };
  }, [config, direction, state, frame, facing]);

  // If a `size` prop is provided, render at that fixed CSS pixel size
  // (used by the avatar creator preview). Otherwise, fill the parent —
  // PlayerMarker sizes the parent with a percentage of the room so the
  // sprite scales with the responsive room, and passing a world-pixel
  // `size` here would override the parent and misalign the anchor.
  const style: React.CSSProperties = { imageRendering: "pixelated" };
  if (size != null) {
    style.width = size;
    style.height = size;
  }
  return (
    <canvas
      ref={canvasRef}
      width={AVATAR_SIZE}
      height={AVATAR_SIZE}
      style={style}
      className={className}
    />
  );
}
