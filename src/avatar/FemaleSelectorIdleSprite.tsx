import { useEffect, useState } from "react";
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

  useEffect(() => {
    void preloadFemaleWalkFrames();
  }, []);

  useEffect(() => {
    setFrame(0);
    if (!walking) return;
    const id = window.setInterval(
      () => setFrame((current) => (current + 1) % FEMALE_WALK_FRAME_COUNT),
      FEMALE_WALK_FRAME_MS,
    );
    return () => window.clearInterval(id);
  }, [direction, resetKey, walking]);

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
