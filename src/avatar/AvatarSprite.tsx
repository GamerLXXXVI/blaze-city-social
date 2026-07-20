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
  debugShowFrameOverlay?: boolean;
}

export function AvatarSprite({
  config,
  direction,
  state,
  facing = "right",
  size = AVATAR_SIZE,
  className,
  debugShowFrameOverlay = false,
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

  return (
    <>
      <canvas
        ref={canvasRef}
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        style={{ width: size, height: size, imageRendering: "pixelated" }}
        className={className}
      />
      {debugShowFrameOverlay && state === "dance" && (
        <span
          aria-label="Dance animation frame diagnostic"
          style={{
            position: "absolute",
            left: "calc(100% + 6px)",
            top: "18%",
            zIndex: 30,
            minWidth: 22,
            border: "1px solid rgba(240,185,11,0.85)",
            borderRadius: 4,
            background: "rgba(20,17,13,0.9)",
            color: "#F0B90B",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 11,
            lineHeight: "16px",
            textAlign: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {frame}
        </span>
      )}
    </>
  );
}
