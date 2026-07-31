import { AvatarSprite } from "./AvatarSprite";
import type { AvatarConfig, Direction } from "./types";

interface Props {
  config: AvatarConfig;
  direction: Direction;
  walking?: boolean;
}

// Character-selection preview for the female directional states. It renders
// through the shared compositor so the legacy full-bleed idle art and the
// already-normalized manifest walk art display at the same visible scale,
// with one fixed 128px box, bottom-center anchor and no smoothing.
export function FemaleSelectorIdleSprite({ config, direction, walking = false }: Props) {
  return (
    <AvatarSprite
      config={config}
      direction={direction}
      state={walking ? "walk" : "idle"}
      size={128}
    />
  );
}
