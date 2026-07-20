// Builds the exact asset paths for each layer as specified.
// Real art can drop into /public/assets/... at these exact URLs and just work.
import type { AvatarConfig, Direction, AnimState } from "./types";

export const AVATAR_SIZE = 96; // logical avatar frame size in room pixels

// Visual scale multiplier for player + bartender sprites. World-position
// anchors (movement, collision, zone hit-testing) are UNAFFECTED — this
// only enlarges the drawn art around its bottom-center foot anchor.
export const PLAYER_SPRITE_SCALE = 1.75;

// Bartender-specific render scale. His visible content (head-to-feet, rows
// 18–47 of the 64px source ≈ 29px) is a smaller fraction of his sprite than
// the player's, so reusing PLAYER_SPRITE_SCALE makes him appear ~60% of the
// player's height. This scale is tuned so his full head-to-feet extent
// matches the player's on-screen head-to-feet height. Player visible body
// spans ~38/64 of the scaled 168px sprite box ≈ 99.75 world px. Bartender
// visible span is 29 source rows, so scale ≈ 99.75/29 ≈ 3.44. Bumped to
// 3.8 after visual A/B: the player's rendered figure still read taller at
// 3.4 because his head/hair extend above row 8.
export const NPC_RENDER_SCALE = 3.8;

export type LayerDirection = "down" | "up" | "side";

export const DEFAULT_AVATAR_PRESET = "blaze-original" as const;
export const WALK_FRAME_COUNT = 4;
export const DANCE_FRAME_COUNT = 16;
export const DANCE_FRAME_MS = 165;

export function presetPathFor(
  cfg: AvatarConfig,
  direction: Direction,
  state: AnimState,
  frame: number,
): string | null {
  const preset = cfg.preset ?? DEFAULT_AVATAR_PRESET;
  if (preset !== "blaze-original") return null;
  const root = `/assets/avatars/presets/${preset}`;
  if (state === "dance") {
    return `${root}/dance/south/frame-${String(frame % DANCE_FRAME_COUNT).padStart(2, "0")}.png`;
  }
  return state === "walk"
    ? `${root}/walk/${direction}/frame-${String(frame % WALK_FRAME_COUNT).padStart(2, "0")}.png`
    : `${root}/idle/${direction}.png`;
}

export const LAYER_ORDER = [
  "body",
  "pants",
  "shirt",
  "head_shape",
  "mouth",
  "eyes",
  "eyebrows",
  "hair",
] as const;

export type LayerId = (typeof LAYER_ORDER)[number];

export function pathFor(
  layer: LayerId,
  cfg: AvatarConfig,
  direction: LayerDirection,
  state: AnimState,
): string {
  const suffix = `${direction}_${state}.png`;
  switch (layer) {
    case "body":
      return `/assets/avatars/base/${cfg.gender}/${cfg.body_type}/${suffix}`;
    case "head_shape":
      return `/assets/avatars/parts/head_shape/${cfg.head_shape}/${suffix}`;
    case "eyes":
      return `/assets/avatars/parts/eyes/${cfg.eyes}/${suffix}`;
    case "eyebrows":
      return `/assets/avatars/parts/eyebrows/${cfg.eyebrows}/${suffix}`;
    case "mouth":
      return `/assets/avatars/parts/mouth/${cfg.mouth}/${suffix}`;
    case "hair":
      return `/assets/avatars/parts/hair/${cfg.hair}/${cfg.gender}/${suffix}`;
    case "shirt":
      return `/assets/avatars/parts/shirt/${cfg.shirt}/${cfg.gender}/${cfg.body_type}/${suffix}`;
    case "pants":
      return `/assets/avatars/parts/pants/${cfg.pants}/${cfg.gender}/${cfg.body_type}/${suffix}`;
  }
}
