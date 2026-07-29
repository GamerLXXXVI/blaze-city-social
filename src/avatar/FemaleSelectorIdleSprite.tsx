import { useEffect, useState } from "react";
import { femaleIdleFramePath, FEMALE_IDLE_FRAME_COUNT, FEMALE_IDLE_FRAME_MS } from "./manifest";
import type { Direction } from "./types";

interface Props {
  direction: Direction;
  resetKey: number;
}

export function FemaleSelectorIdleSprite({ direction, resetKey }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    const id = window.setInterval(
      () => setFrame((current) => (current + 1) % FEMALE_IDLE_FRAME_COUNT),
      FEMALE_IDLE_FRAME_MS,
    );
    return () => window.clearInterval(id);
  }, [direction, resetKey]);

  const src = femaleIdleFramePath(direction, frame);

  return (
    <img
      src={src}
      alt={`Female Amber Night idle facing ${direction}`}
      width={128}
      height={128}
      decoding="async"
      draggable={false}
      onError={() => console.error("[avatar] Missing female selector idle sprite", src)}
      style={{
        width: "128px",
        height: "128px",
        objectFit: "contain",
        imageRendering: "pixelated",
      }}
    />
  );
}