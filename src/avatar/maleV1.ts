import type { Direction } from "./types";

// Approved "Blaze City Male V1" runtime package.
//
// Source of truth for the bytes on disk is
// /assets/avatars/presets/blaze-original/male-v1/manifest.json
// (57 SHA-256-pinned PNGs). Nothing here resizes, resamples or re-authors
// those pixels:
//   - idle  : 232x232 authoring canvas, ONE translation-crop of the approved
//             128x128 production window at source rect (52,55,128,128).
//   - walk  : native 128x128, 6 frames per direction at 100 ms (10 FPS).
//   - sit   : native 128x128, WEST only, seat-contact pivot (64,80).
//   - dance : no approved art yet -> temporary safe fallback to idle south.
// A male frame never falls back to female art, and never to the legacy
// layered/placeholder pipeline. The legacy male PNGs stay on disk but are
// no longer referenced by the runtime.
export const MALE_V1 = {
  schemaVersion: 1,
  id: "blaze-city-approved-male-v1-runtime",
  // Cache-busting token only; the PNG bytes are immutable.
  version: "1.0.0",
  characterId: "b85f530c-8af4-4113-b914-1e0b6c208c1c",
  sittingStateId: "e0bde7db-8269-4d14-8831-f071e91d778b",
  assetRoot: "/assets/avatars/presets/blaze-original/male-v1",
  directions: [
    "south",
    "south-east",
    "east",
    "north-east",
    "north",
    "north-west",
    "west",
    "south-west",
  ],
  canvas: { width: 128, height: 128 },
  displayScale: 1.12,
  pivot: { x: 64, y: 120, semantic: "bottom-center" },
  labelOffsetY: 118,
  assetCount: 57,
  idle: {
    frameCount: 1,
    frameMs: 500,
    sourceCanvas: { width: 232, height: 232 },
    // translation-crop-only: sx, sy, sw, sh -> (0,0,128,128)
    sourceRect: { x: 52, y: 55, width: 128, height: 128 },
  },
  walk: {
    frames: [
      "frame-00.png",
      "frame-01.png",
      "frame-02.png",
      "frame-03.png",
      "frame-04.png",
      "frame-05.png",
    ],
    frameCount: 6,
    frameMs: 100,
    fps: 10,
  },
  sit: {
    supportedDirections: ["west"],
    file: "west.png",
    seatAnchor: { x: 64, y: 80, semantic: "stool-seat-contact" },
  },
  dance: {
    // Temporary safe fallback until approved male dance art ships.
    status: "temporary-safe-fallback",
    frameCount: 1,
    frameMs: 500,
    fallback: { state: "idle", direction: "south", frame: 0 },
  },
} as const;

export function isMaleV1(preset: string | undefined, gender: string | undefined): boolean {
  return (preset ?? "blaze-original") === "blaze-original" && (gender ?? "male") === "male";
}

export function maleV1IdlePath(direction: Direction): string {
  return `${MALE_V1.assetRoot}/idle/${direction}.png?v=${MALE_V1.version}`;
}

export function maleV1WalkPath(direction: Direction, frame: number): string {
  const files = MALE_V1.walk.frames;
  const index = ((frame % files.length) + files.length) % files.length;
  return `${MALE_V1.assetRoot}/walk/${direction}/${files[index]}?v=${MALE_V1.version}`;
}

export function hasMaleV1SittingArt(direction: Direction): boolean {
  return direction === "west";
}

export function maleV1SitWestPath(): string {
  return `${MALE_V1.assetRoot}/sit/${MALE_V1.sit.file}?v=${MALE_V1.version}`;
}

export function isMaleV1IdlePath(path: string): boolean {
  return path.includes(`${MALE_V1.assetRoot}/idle/`);
}

export function isMaleV1WalkPath(path: string): boolean {
  return path.includes(`${MALE_V1.assetRoot}/walk/`);
}

export function isMaleV1SitPath(path: string): boolean {
  return path.includes(`${MALE_V1.assetRoot}/sit/`);
}

export function isMaleV1Path(path: string): boolean {
  return path.includes(`${MALE_V1.assetRoot}/`);
}
