import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { FEMALE_WALK_MANIFEST } from "../src/avatar/femaleWalkManifest";

const expectedDirections = [
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
] as const;

const expectedFrames = [
  "frame-01.png",
  "frame-02.png",
  "frame-03.png",
  "frame-04.png",
  "frame-05.png",
  "frame-06.png",
] as const;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

invariant(
  JSON.stringify(FEMALE_WALK_MANIFEST.directions) === JSON.stringify(expectedDirections),
  "Female walk direction order is incorrect",
);
invariant(FEMALE_WALK_MANIFEST.frameCount === 6, "Female walk must contain six frames");
invariant(FEMALE_WALK_MANIFEST.frameMs === 100, "Female walk frames must last 100 ms");
invariant(FEMALE_WALK_MANIFEST.fps === 10, "Female walk must play at 10 FPS");
invariant(
  FEMALE_WALK_MANIFEST.canvas.width === 64 && FEMALE_WALK_MANIFEST.canvas.height === 64,
  "Female walk canvas must be 64x64",
);
invariant(
  FEMALE_WALK_MANIFEST.pivot.x === 32 && FEMALE_WALK_MANIFEST.pivot.y === 46,
  "Female walk pivot must be (32,46)",
);
invariant(FEMALE_WALK_MANIFEST.baselineY === 46, "Female walk baseline must be row 46");
invariant(
  FEMALE_WALK_MANIFEST.render.size === 64 &&
    FEMALE_WALK_MANIFEST.render.dx === 0 &&
    FEMALE_WALK_MANIFEST.render.dy === 0,
  "Female walk render rectangle must be full-canvas 64/0/0",
);
for (const direction of FEMALE_WALK_MANIFEST.directions) {
  invariant(
    JSON.stringify(FEMALE_WALK_MANIFEST.frames[direction]) === JSON.stringify(expectedFrames),
    `${direction} frame names must be contiguous frame-01.png through frame-06.png`,
  );
  invariant(
    new Set(FEMALE_WALK_MANIFEST.frames[direction]).size ===
      FEMALE_WALK_MANIFEST.frames[direction].length,
    `${direction} frame names must be unique`,
  );
}

let verified = 0;
const assetDirectory = join(
  process.cwd(),
  "public",
  FEMALE_WALK_MANIFEST.assetRoot.replace(/^\//, ""),
);
const publicManifest = JSON.parse(
  await readFile(join(assetDirectory, "manifest.json"), "utf8"),
) as {
  id: string;
  version: string;
  directionOrder: string[];
  frameCount: number;
  frameDurationMs: number;
  fps: number;
  baselineRow: number;
  canvas: { width: number; height: number };
  pivot: { x: number; y: number };
  render: { size: number; dx: number; dy: number };
  directions: Record<string, { frames: Array<{ file: string; sha256: string }> }>;
};

invariant(publicManifest.id === FEMALE_WALK_MANIFEST.id, "Public/typed manifest ID mismatch");
invariant(
  publicManifest.version === FEMALE_WALK_MANIFEST.version,
  "Public/typed manifest version mismatch",
);
invariant(
  JSON.stringify(publicManifest.directionOrder) ===
    JSON.stringify(FEMALE_WALK_MANIFEST.directions),
  "Public/typed manifest direction-order mismatch",
);
invariant(
  publicManifest.frameCount === FEMALE_WALK_MANIFEST.frameCount,
  "Public/typed manifest frame-count mismatch",
);
invariant(
  publicManifest.frameDurationMs === FEMALE_WALK_MANIFEST.frameMs,
  "Public/typed manifest frame-timing mismatch",
);
invariant(publicManifest.fps === FEMALE_WALK_MANIFEST.fps, "Public/typed manifest FPS mismatch");
invariant(
  publicManifest.canvas.width === FEMALE_WALK_MANIFEST.canvas.width &&
    publicManifest.canvas.height === FEMALE_WALK_MANIFEST.canvas.height,
  "Public/typed manifest canvas mismatch",
);
invariant(
  publicManifest.pivot.x === FEMALE_WALK_MANIFEST.pivot.x &&
    publicManifest.pivot.y === FEMALE_WALK_MANIFEST.pivot.y &&
    publicManifest.baselineRow === FEMALE_WALK_MANIFEST.baselineY,
  "Public/typed manifest pivot or baseline mismatch",
);
invariant(
  publicManifest.render.size === FEMALE_WALK_MANIFEST.render.size &&
    publicManifest.render.dx === FEMALE_WALK_MANIFEST.render.dx &&
    publicManifest.render.dy === FEMALE_WALK_MANIFEST.render.dy,
  "Public/typed manifest render mismatch",
);

for (const direction of FEMALE_WALK_MANIFEST.directions) {
  const publicFrames = publicManifest.directions[direction]?.frames;
  invariant(publicFrames?.length === 6, `${direction} public manifest must list six frames`);
  for (const [index, filename] of FEMALE_WALK_MANIFEST.frames[direction].entries()) {
    const file = join(assetDirectory, direction, filename);
    const png = await readFile(file);
    invariant(
      png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      `${file} is not a PNG`,
    );
    invariant(png.readUInt32BE(16) === 64, `${file} width is not 64`);
    invariant(png.readUInt32BE(20) === 64, `${file} height is not 64`);
    invariant(publicFrames[index].file === filename, `${direction} public frame order mismatch`);
    invariant(
      createHash("sha256").update(png).digest("hex") === publicFrames[index].sha256,
      `${file} SHA-256 mismatch`,
    );
    verified += 1;
  }
}

invariant(verified === 48, `Expected 48 female walk assets, verified ${verified}`);
console.log(`Verified ${verified} female walk assets`);
