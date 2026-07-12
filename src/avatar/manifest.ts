// Builds the exact asset paths for each layer as specified.
// Real art can drop into /public/assets/... at these exact URLs and just work.
import type { AvatarConfig, Direction, AnimState } from "./types";

export const AVATAR_SIZE = 96; // logical avatar frame size in room pixels

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
  direction: Direction,
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
