import { useEffect, useRef, useState } from "react";
import { compositeFrame } from "./compositor";
import {
  danceFrameCount,
  danceFrameMs,
  idleFrameCount,
  idleFrameMs,
  preloadFemaleWalkFrames,
  preloadFemaleDanceFrames,
  walkFrameCount,
  walkFrameMs,
} from "./manifest";
import { getAvatarRenderMetrics } from "./renderMetrics";
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
  // Shared semantic gait phase (0..count-1). Kept in a ref so a direction
  // change while walking selects the same phase from the new strip instead
  // of restarting the cycle (planted foot stays consistent).
  const gaitPhaseRef = useRef(0);

  const gender = config.gender;
  useEffect(() => {
    if (gender === "female") preloadFemaleWalkFrames();
  }, [gender]);

  // Canvas dimensions are metrics-driven so a 128px female idle/walk frame is
  // never squeezed back down into the legacy 96px canvas.
  const metrics = getAvatarRenderMetrics(config, state, normalizeDirection(direction, facing));

  const walkCount = walkFrameCount(config);
  const walkMs = walkFrameMs(config);
  const idleCount = idleFrameCount(config);
  const idleMs = idleFrameMs(config);
  const danceCount = danceFrameCount(config);
  const danceMs = danceFrameMs(config);

  // Restarts only when the animation state changes — direction changes and
  // position updates must not reset the cycle.
  useEffect(() => {
    if (state === "walk") {
      // beginWalking(): one shared requestAnimationFrame clock, one accumulator.
      gaitPhaseRef.current = 0;
      setFrame(0);
      let accumulatorMs = 0;
      let previousTimestamp = performance.now();
      let raf = 0;
      const tick = (timestamp: number) => {
        const rawDelta = timestamp - previousTimestamp;
        previousTimestamp = timestamp;
        // Prevent a backgrounded tab from skipping multiple visible phases.
        accumulatorMs += Math.min(rawDelta, walkMs);
        if (accumulatorMs >= walkMs) {
          accumulatorMs -= walkMs;
          gaitPhaseRef.current = (gaitPhaseRef.current + 1) % walkCount;
          setFrame(gaitPhaseRef.current);
        }
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(raf);
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
    gaitPhaseRef.current = 0;
    if (state === "idle" && idleCount > 1) {
      const id = window.setInterval(() => setFrame((f) => (f + 1) % idleCount), idleMs);
      return () => window.clearInterval(id);
    }
  }, [state, gender, walkCount, walkMs, idleCount, idleMs, danceCount, danceMs]);

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
      width={metrics.canvas}
      height={metrics.canvas}
      style={style}
      className={className}
    />
  );
}
