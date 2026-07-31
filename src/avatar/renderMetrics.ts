import { AVATAR_SIZE, PLAYER_SPRITE_SCALE } from "./manifest";
import { FEMALE_PRODUCTION_128 } from "./femaleProduction128";
import type { AnimState, AvatarConfig } from "./types";

export interface AvatarRenderMetrics {
  /** Square compositor/canvas size in source pixels. */
  canvas: number;
  /** Multiplier from canvas pixels to world pixels. */
  displayScale: number;
  /** Bottom-center world anchor, in canvas pixels. */
  pivotX: number;
  pivotY: number;
  /**
   * Fixed world-pixel offset above the pivot where the username/chat label
   * stack is anchored. Deliberately NOT derived from alpha bounds or from the
   * sprite box, so state changes can never move the nameplate.
   */
  labelOffsetY: number;
}

// Legacy/male metrics — 96px canvas at 2.4x with the measured 46/64 foot row.
// Unchanged for male (all states) and for female dance + sit.
export const LEGACY_RENDER_METRICS: AvatarRenderMetrics = {
  canvas: AVATAR_SIZE,
  displayScale: PLAYER_SPRITE_SCALE,
  pivotX: AVATAR_SIZE / 2,
  pivotY: (46 / 64) * AVATAR_SIZE, // 69
  labelOffsetY: 166,
};

// Female production-128 idle + walk. Native canvas, native scale, manifest
// pivot. Idle and walk share ONE metrics object, so an idle<->walk transition
// cannot change canvas size, display scale or world anchor.
export const FEMALE_PRODUCTION_128_METRICS: AvatarRenderMetrics = {
  canvas: FEMALE_PRODUCTION_128.canvas.width,
  displayScale: FEMALE_PRODUCTION_128.displayScale,
  pivotX: FEMALE_PRODUCTION_128.pivot.x,
  pivotY: FEMALE_PRODUCTION_128.pivot.y,
  labelOffsetY: 118,
};

export function usesFemaleProduction128(cfg: AvatarConfig, state: AnimState): boolean {
  const preset = cfg.preset ?? "blaze-original";
  if (preset !== "blaze-original") return false;
  if ((cfg.gender ?? "male") !== "female") return false;
  return state === "idle" || state === "walk";
}

export function getAvatarRenderMetrics(cfg: AvatarConfig, state: AnimState): AvatarRenderMetrics {
  return usesFemaleProduction128(cfg, state)
    ? FEMALE_PRODUCTION_128_METRICS
    : LEGACY_RENDER_METRICS;
}
