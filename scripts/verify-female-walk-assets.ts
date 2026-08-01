import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

import { FEMALE_PRODUCTION_128 } from "../src/avatar/femaleProduction128";

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

const expectedWalkFrames = [
  "frame-00.png",
  "frame-01.png",
  "frame-02.png",
  "frame-03.png",
  "frame-04.png",
  "frame-05.png",
] as const;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ---- typed manifest contract ------------------------------------------------
invariant(
  JSON.stringify(FEMALE_PRODUCTION_128.directions) === JSON.stringify(expectedDirections),
  "Female direction order is incorrect",
);
invariant(
  JSON.stringify(FEMALE_PRODUCTION_128.walk.frames) === JSON.stringify(expectedWalkFrames),
  "Female walk frame names must be contiguous frame-00.png through frame-05.png",
);
invariant(FEMALE_PRODUCTION_128.walk.frameCount === 6, "Female walk must contain six frames");
invariant(FEMALE_PRODUCTION_128.walk.frameMs === 100, "Female walk frames must last 100 ms");
invariant(FEMALE_PRODUCTION_128.walk.fps === 10, "Female walk must play at 10 FPS");
invariant(
  FEMALE_PRODUCTION_128.idle.frameCount === 1,
  "Female idle must be one frame per direction",
);
invariant(
  FEMALE_PRODUCTION_128.canvas.width === 128 && FEMALE_PRODUCTION_128.canvas.height === 128,
  "Female idle/walk canvas must be 128x128",
);
invariant(
  FEMALE_PRODUCTION_128.pivot.x === 64 && FEMALE_PRODUCTION_128.pivot.y === 120,
  "Female idle/walk pivot must be (64,120)",
);
invariant(FEMALE_PRODUCTION_128.baselineY === 120, "Female baseline must be row 120");
invariant(FEMALE_PRODUCTION_128.displayScale === 1.12, "Female display scale must be exactly 1.12");

// ---- public runtime manifests ----------------------------------------------
const publicRoot = (assetRoot: string) =>
  join(process.cwd(), "public", assetRoot.replace(/^\//, ""));
const idleDir = publicRoot(FEMALE_PRODUCTION_128.idle.assetRoot);
const walkDir = publicRoot(FEMALE_PRODUCTION_128.walk.assetRoot);

type PublicManifest = {
  id: string;
  canvas: { width: number; height: number };
  pivot: { x: number; y: number };
  baselineRow: number;
  frameCount: number;
  frameDurationMs?: number;
  fps?: number;
  directionOrder: string[];
  framePattern: string;
  transform: { type: string; resized: boolean };
};

const idleManifest = JSON.parse(
  await readFile(join(idleDir, "manifest.json"), "utf8"),
) as PublicManifest;
const walkManifest = JSON.parse(
  await readFile(join(walkDir, "manifest.json"), "utf8"),
) as PublicManifest;

for (const [name, manifest, id, frameCount] of [
  ["idle", idleManifest, FEMALE_PRODUCTION_128.idle.id, 1],
  ["walk", walkManifest, FEMALE_PRODUCTION_128.walk.id, 6],
] as const) {
  invariant(manifest.id === id, `${name} public/typed manifest ID mismatch`);
  invariant(
    manifest.canvas.width === 128 && manifest.canvas.height === 128,
    `${name} public manifest canvas must be 128x128`,
  );
  invariant(
    manifest.pivot.x === 64 && manifest.pivot.y === 120 && manifest.baselineRow === 120,
    `${name} public manifest pivot/baseline mismatch`,
  );
  invariant(manifest.frameCount === frameCount, `${name} public manifest frame-count mismatch`);
  invariant(
    JSON.stringify(manifest.directionOrder) === JSON.stringify(expectedDirections),
    `${name} public manifest direction-order mismatch`,
  );
  invariant(manifest.transform.resized === false, `${name} assets must not be resized`);
}
invariant(walkManifest.frameDurationMs === 100, "walk public manifest must use 100 ms frames");
invariant(walkManifest.fps === 10, "walk public manifest must be 10 FPS");

// ---- PNG inspection ---------------------------------------------------------
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodeRgba(png: Buffer, label: string): { width: number; height: number; data: Buffer } {
  invariant(png.subarray(0, 8).equals(PNG_SIGNATURE), `${label} is not a PNG`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  invariant(bitDepth === 8, `${label} must be 8-bit`);
  invariant(colorType === 6, `${label} must be RGBA (color type 6)`);
  invariant(interlace === 0, `${label} must not be interlaced`);
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const rowStart = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? out[rowStart + x - bpp] : 0;
      const up = y > 0 ? out[rowStart - stride + x] : 0;
      const upLeft = y > 0 && x >= bpp ? out[rowStart - stride + x - bpp] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      else invariant(filter === 0, `${label} has unsupported PNG filter ${filter}`);
      out[rowStart + x] = value & 0xff;
    }
  }
  return { width, height, data: out };
}

function inspect(png: Buffer, label: string): void {
  const { width, height, data } = decodeRgba(png, label);
  invariant(width === 128, `${label} width is not 128`);
  invariant(height === 128, `${label} height is not 128`);
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i];
    invariant(alpha === 0 || alpha === 255, `${label} has non-binary alpha value ${alpha}`);
    if (alpha === 255) opaque += 1;
  }
  invariant(opaque > 0, `${label} is fully transparent`);
}

let idleVerified = 0;
for (const direction of FEMALE_PRODUCTION_128.directions) {
  const file = join(idleDir, `${direction}.png`);
  inspect(await readFile(file), file);
  idleVerified += 1;
}

let walkVerified = 0;
for (const direction of FEMALE_PRODUCTION_128.directions) {
  for (const filename of FEMALE_PRODUCTION_128.walk.frames) {
    const file = join(walkDir, direction, filename);
    inspect(await readFile(file), file);
    walkVerified += 1;
  }
}

invariant(idleVerified === 8, `Expected 8 female idle assets, verified ${idleVerified}`);
invariant(walkVerified === 48, `Expected 48 female walk assets, verified ${walkVerified}`);
console.log(
  `Verified ${idleVerified} female idle and ${walkVerified} female walk assets (128x128)`,
);
