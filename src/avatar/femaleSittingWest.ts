import type { Direction } from "./types";

// Approved "Candidate 2" female WEST sitting state.
//
// A single fixed 128x128 RGBA PNG produced by a crop/translation from the
// PixelLab original. It is drawn at NATIVE 1:1 pixels at (0,0) with image
// smoothing disabled — no resize, interpolation, normalization or
// per-frame recentering is ever applied.
//
// The anchor is a dedicated stool-seat contact point (64, 80), NOT the
// standing foot pivot (64, 120): the same world coordinate means "seat
// contact" while sitting.
export const FEMALE_SITTING_WEST = {
  schemaVersion: 1,
  id: "blaze-female-candidate2-west-sit-128-v1",
  characterId: "384a6412-08e4-4e1b-819f-aaa243e03bc2",
  characterGroupId: "079c3ebd-269e-46e5-9519-8371586778fa",
  pixelLabStateId: "205f8eba-3a91-40a4-8b9f-6c872dedb86f",
  direction: "west",
  screenDirection: "left",
  assetRoot: "/assets/avatars/presets/blaze-original/sit-female-pixellab-v2",
  file: "west.png",
  canvas: { width: 128, height: 128 },
  crop: { left: 48, top: 51, width: 128, height: 128 },
  seatAnchor: { x: 64, y: 80, semantic: "stool-seat-contact" },
  displayScale: 1.12,
  labelOffsetY: 118,
  sha256: "ca8d80e01520dba2d65681e619543522738b134308b3b0976e80b954d4bce287",
  strictLoad: true,
  fallback: "candidate-2-west-idle",
} as const;

/** Candidate 2 sitting exists for WEST only; every stool forces west/left. */
export function hasFemaleSittingArt(direction: Direction): boolean {
  return direction === "west";
}

export function femaleSittingWestPath(): string {
  return `${FEMALE_SITTING_WEST.assetRoot}/${FEMALE_SITTING_WEST.file}?v=${FEMALE_SITTING_WEST.id}`;
}

export function isFemaleSittingWestPath(path: string): boolean {
  return path.includes(`${FEMALE_SITTING_WEST.assetRoot}/${FEMALE_SITTING_WEST.file}`);
}