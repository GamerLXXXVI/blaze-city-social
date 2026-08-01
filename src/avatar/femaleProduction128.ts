import type { Direction } from "./types";

// Approved "female production 128" idle + walk package.
//
// These PNGs are fixed 128x128 RGBA canvases produced by a single
// crop/translation from the PixelLab originals. They are drawn at NATIVE
// 1:1 pixels — no compositor normalization, resize, interpolation, or
// per-frame recentering is ever applied to them.
type FemaleProduction128Manifest = {
  version: string;
  idle: {
    id: string;
    assetRoot: string;
    frameCount: 1;
    frameMs: number;
  };
  walk: {
    id: string;
    assetRoot: string;
    frames: readonly string[];
    frameCount: number;
    frameMs: number;
    fps: number;
  };
  directions: readonly Direction[];
  canvas: { width: 128; height: 128 };
  pivot: { x: 64; y: 120; semantic: "bottom-center" };
  baselineY: 120;
  displayScale: 1.12;
};

const WALK_FRAMES = [
  "frame-00.png",
  "frame-01.png",
  "frame-02.png",
  "frame-03.png",
  "frame-04.png",
  "frame-05.png",
] as const;

export const FEMALE_PRODUCTION_128 = {
  // Cache/version token only. Bumped for the 1.0 -> 1.12 display-scale
  // change; the PNG bytes are untouched.
  version: "2.1.0",
  idle: {
    id: "blaze-female-pixellab-idle-production-128-v2",
    assetRoot: "/assets/avatars/presets/blaze-original/idle-female-pixellab-v2",
    frameCount: 1,
    frameMs: 500,
  },
  walk: {
    id: "blaze-female-pixellab-walk-production-128-v2",
    assetRoot: "/assets/avatars/presets/blaze-original/walk-female-pixellab-v2",
    frames: WALK_FRAMES,
    frameCount: 6,
    frameMs: 100,
    fps: 10,
  },
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
  pivot: { x: 64, y: 120, semantic: "bottom-center" },
  baselineY: 120,
  // Runtime display scale only — the 128x128 source pixels are never
  // resized, resampled or re-authored.
  displayScale: 1.12,
} as const satisfies FemaleProduction128Manifest;

export function femaleProduction128IdlePath(direction: Direction): string {
  return `${FEMALE_PRODUCTION_128.idle.assetRoot}/${direction}.png?v=${FEMALE_PRODUCTION_128.version}`;
}

export function femaleProduction128WalkPath(direction: Direction, frame: number): string {
  const files = FEMALE_PRODUCTION_128.walk.frames;
  const index = ((frame % files.length) + files.length) % files.length;
  return `${FEMALE_PRODUCTION_128.walk.assetRoot}/${direction}/${files[index]}?v=${FEMALE_PRODUCTION_128.version}`;
}

export function isFemaleProduction128IdlePath(path: string): boolean {
  return path.includes(`${FEMALE_PRODUCTION_128.idle.assetRoot}/`);
}

export function isFemaleProduction128WalkPath(path: string): boolean {
  return path.includes(`${FEMALE_PRODUCTION_128.walk.assetRoot}/`);
}

export function isFemaleProduction128Path(path: string): boolean {
  return isFemaleProduction128IdlePath(path) || isFemaleProduction128WalkPath(path);
}
