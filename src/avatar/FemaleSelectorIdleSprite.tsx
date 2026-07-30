import { useEffect, useRef, useState } from "react";
import {
  femaleIdleFramePath,
  femaleWalkPath,
  FEMALE_WALK_FRAME_COUNT,
  FEMALE_WALK_FRAME_MS,
  preloadFemaleWalkFrames,
} from "./manifest";
import type { Direction } from "./types";

interface Props {
  direction: Direction;
  resetKey: number;
  walking?: boolean;
}

// Character-selection preview for the female directional states.
// One fixed 128x128 container, bottom-center anchor, no smoothing, so idle and
// walk never change her visible size.
export function FemaleSelectorIdleSprite({ direction, resetKey, walking = false }: Props) {
  const [frame, setFrame] = useState(0);
  const gaitPhaseRef = useRef(0);

  useEffect(() => {
    void preloadFemaleWalkFrames();
  }, []);

  useEffect(() => {
    gaitPhaseRef.current = 0;
    setFrame(0);
    if (!walking) return;
    let accumulatorMs = 0;
    let previousTimestamp = performance.now();
    let raf = 0;
    const tick = (timestamp: number) => {
      accumulatorMs += Math.min(timestamp - previousTimestamp, FEMALE_WALK_FRAME_MS);
      previousTimestamp = timestamp;
      if (accumulatorMs >= FEMALE_WALK_FRAME_MS) {
        accumulatorMs -= FEMALE_WALK_FRAME_MS;
        gaitPhaseRef.current = (gaitPhaseRef.current + 1) % FEMALE_WALK_FRAME_COUNT;
        setFrame(gaitPhaseRef.current);
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
    // Direction changes intentionally do NOT restart the gait clock.
  }, [resetKey, walking]);

  const src = walking ? femaleWalkPath(direction, frame) : femaleIdleFramePath(direction);

  return (
    <img
      src={src}
      alt={`Female Amber Night ${walking ? "walking" : "idle"} facing ${direction}`}
      width={128}
      height={128}
      decoding="async"
      draggable={false}
      onError={() => console.error("[avatar] Missing female directional sprite", src)}
      style={{
        width: "128px",
        height: "128px",
        objectFit: "contain",
        objectPosition: "center bottom",
        imageRendering: "pixelated",
      }}
    />
  );
}
