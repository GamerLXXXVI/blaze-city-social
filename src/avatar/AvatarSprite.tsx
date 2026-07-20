import { useEffect, useRef, useState } from "react";
import { compositeFrame } from "./compositor";
import { AVATAR_SIZE, WALK_FRAME_COUNT } from "./manifest";
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
  size = AVATAR_SIZE,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (state !== "walk") {
      setFrame(0);
      return;
    }
    const id = window.setInterval(() => setFrame((f) => (f + 1) % WALK_FRAME_COUNT), 125);
    return () => window.clearInterval(id);
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

  return (
    <canvas
      ref={canvasRef}
      width={AVATAR_SIZE}
      height={AVATAR_SIZE}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      className={className}
    />
  );
}
