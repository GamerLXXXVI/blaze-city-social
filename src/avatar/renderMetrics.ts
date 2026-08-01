import { AVATAR_SIZE, PLAYER_SPRITE_SCALE } from "./manifest";
import { FEMALE_PRODUCTION_128 } from "./femaleProduction128";
import { FEMALE_SITTING_WEST, hasFemaleSittingArt } from "./femaleSittingWest";
import { MALE_V1, hasMaleV1SittingArt, isMaleV1 } from "./maleV1";
import type { AnimState, AvatarConfig, Direction } from "./types";

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

// Legacy sitting metrics (male + any legacy sit art). Identical to the
// previously hardcoded SIT_ANCHOR_PCT branch: the 40/64 seat row on the
// 96px canvas at 2.4x. Expressed as explicit metrics so PlayerMarker can be
// fully metrics-driven without changing male sitting geometry at all.
export const LEGACY_SIT_RENDER_METRICS: AvatarRenderMetrics = {
  canvas: AVATAR_SIZE,
  displayScale: PLAYER_SPRITE_SCALE,
  pivotX: AVATAR_SIZE / 2,
  pivotY: (40 / 64) * AVATAR_SIZE, // 60
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

// Candidate 2 WEST sitting. Same native 128px canvas and display scale as
// idle/walk, but a dedicated stool-seat anchor (64,80) instead of the
// standing foot pivot.
export const FEMALE_CANDIDATE2_SIT_METRICS: AvatarRenderMetrics = {
  canvas: FEMALE_SITTING_WEST.canvas.width,
  displayScale: FEMALE_SITTING_WEST.displayScale,
  pivotX: FEMALE_SITTING_WEST.seatAnchor.x,
  pivotY: FEMALE_SITTING_WEST.seatAnchor.y,
  labelOffsetY: FEMALE_SITTING_WEST.labelOffsetY,
};

function isBlazeFemale(cfg: AvatarConfig): boolean {
  return (
    (cfg.preset ?? "blaze-original") === "blaze-original" && (cfg.gender ?? "male") === "female"
  );
}

// Approved Male V1 idle + walk (+ dance safe fallback). Native 128px canvas,
// 1.12 display scale, manifest pivot (64,120). Idle and walk share ONE
// metrics object so an idle<->walk transition cannot change canvas size,
// display scale or world anchor.
export const MALE_V1_METRICS: AvatarRenderMetrics = {
  canvas: MALE_V1.canvas.width,
  displayScale: MALE_V1.displayScale,
  pivotX: MALE_V1.pivot.x,
  pivotY: MALE_V1.pivot.y,
  labelOffsetY: MALE_V1.labelOffsetY,
};

// Male V1 WEST sitting. Same canvas + display scale as idle/walk, but the
// dedicated stool-seat anchor (64,80) instead of the standing foot pivot.
export const MALE_V1_SIT_METRICS: AvatarRenderMetrics = {
  canvas: MALE_V1.canvas.width,
  displayScale: MALE_V1.displayScale,
  pivotX: MALE_V1.sit.seatAnchor.x,
  pivotY: MALE_V1.sit.seatAnchor.y,
  labelOffsetY: MALE_V1.labelOffsetY,
};

function isBlazeMale(cfg: AvatarConfig): boolean {
  return isMaleV1(cfg.preset, cfg.gender);
}

export function usesFemaleProduction128(cfg: AvatarConfig, state: AnimState): boolean {
  if (!isBlazeFemale(cfg)) return false;
  return state === "idle" || state === "walk";
}

/** Candidate 2 sitting art exists for WEST only; other directions hold idle. */
export function usesFemaleCandidate2Sit(
  cfg: AvatarConfig,
  state: AnimState,
  direction?: Direction,
) {
  return isBlazeFemale(cfg) && state === "sit" && hasFemaleSittingArt(direction ?? "west");
}

export function getAvatarRenderMetrics(
  cfg: AvatarConfig,
  state: AnimState,
  direction?: Direction,
): AvatarRenderMetrics {
  if (usesFemaleProduction128(cfg, state)) return FEMALE_PRODUCTION_128_METRICS;
  if (isBlazeMale(cfg)) {
    // West -> Male V1 sitting; any other sit direction holds the Male V1 idle
    // for that direction. Dance has no approved art and holds idle too.
    if (state === "sit" && hasMaleV1SittingArt(direction ?? "west")) return MALE_V1_SIT_METRICS;
    return MALE_V1_METRICS;
  }
  if (isBlazeFemale(cfg) && state === "sit") {
    // West -> Candidate 2 sitting; any other direction holds the Candidate 2
    // production idle for that direction (never legacy sitting art).
    return usesFemaleCandidate2Sit(cfg, state, direction)
      ? FEMALE_CANDIDATE2_SIT_METRICS
      : FEMALE_PRODUCTION_128_METRICS;
  }
  if (state === "sit") return LEGACY_SIT_RENDER_METRICS;
  return LEGACY_RENDER_METRICS;
}
