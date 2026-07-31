import type { Direction } from "./types";

type FemaleWalkManifest = {
  id: string;
  version: string;
  assetRoot: string;
  directions: readonly Direction[];
  frames: Record<Direction, readonly string[]>;
  frameCount: number;
  frameMs: number;
  fps: number;
  canvas: { width: number; height: number };
  pivot: { x: number; y: number; semantic: "bottom-center" };
  baselineY: number;
  render: { size: number; dx: number; dy: number };
  pixelLab: {
    characterId: string;
    animationGroupId: string;
    templateAnimationId: "walk";
  };
};

const SIX_WALK_FRAMES = [
  "frame-01.png",
  "frame-02.png",
  "frame-03.png",
  "frame-04.png",
  "frame-05.png",
  "frame-06.png",
] as const;

export const FEMALE_WALK_MANIFEST = {
  id: "pixellab-female-candidate2-walk-v1",
  version: "1.0.0",
  assetRoot: "/assets/avatars/presets/blaze-original/walk-female-pixellab-v1",
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
  frames: {
    south: SIX_WALK_FRAMES,
    "south-east": SIX_WALK_FRAMES,
    east: SIX_WALK_FRAMES,
    "north-east": SIX_WALK_FRAMES,
    north: SIX_WALK_FRAMES,
    "north-west": SIX_WALK_FRAMES,
    west: SIX_WALK_FRAMES,
    "south-west": SIX_WALK_FRAMES,
  },
  frameCount: 6,
  frameMs: 100,
  fps: 10,
  canvas: { width: 64, height: 64 },
  pivot: { x: 32, y: 46, semantic: "bottom-center" },
  baselineY: 46,
  // These package frames are already normalized to the shared 64px world
  // canvas. Draw the complete canvas; the legacy full-bleed female walk used
  // a 32px inset draw and must not be reused for this asset root.
  render: { size: 64, dx: 0, dy: 0 },
  pixelLab: {
    characterId: "384a6412-08e4-4e1b-819f-aaa243e03bc2",
    animationGroupId: "71495b00-23cb-499f-9891-9132e2172854",
    templateAnimationId: "walk",
  },
} as const satisfies FemaleWalkManifest;

export function femaleWalkManifestPath(direction: Direction, frame: number): string {
  const files = FEMALE_WALK_MANIFEST.frames[direction];
  const index = ((frame % files.length) + files.length) % files.length;
  return `${FEMALE_WALK_MANIFEST.assetRoot}/${direction}/${files[index]}?v=${FEMALE_WALK_MANIFEST.version}`;
}

export function isManifestFemaleWalkPath(path: string): boolean {
  return path.includes(`${FEMALE_WALK_MANIFEST.assetRoot}/`);
}
