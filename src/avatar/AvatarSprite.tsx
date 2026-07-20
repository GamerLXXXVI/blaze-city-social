import { useEffect, useRef, useState } from "react";
import { compositeFrame } from "./compositor";
import { AVATAR_SIZE, WALK_FRAME_COUNT, DANCE_FRAME_COUNT, DANCE_FRAME_MS } from "./manifest";
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

  useEffect(() => {
    if (state === "walk") {
      setFrame(0);
      const id = window.setInterval(() => setFrame((f) => (f + 1) % WALK_FRAME_COUNT), 125);
      return () => window.clearInterval(id);
    }
    if (state === "dance") {
      setFrame(0);
      const id = window.setInterval(
        () => setFrame((f) => (f + 1) % DANCE_FRAME_COUNT),
        DANCE_FRAME_MS,
      );
      return () => window.clearInterval(id);
    }
    setFrame(0);
  }, [state]);

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
