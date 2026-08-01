import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

import { FEMALE_PRODUCTION_128, femaleProduction128IdlePath } from "../src/avatar/femaleProduction128";
import { FEMALE_SITTING_WEST, femaleSittingWestPath } from "../src/avatar/femaleSittingWest";
import { presetPathFor } from "../src/avatar/manifest";
import { getAvatarRenderMetrics } from "../src/avatar/renderMetrics";
import type { AvatarConfig } from "../src/avatar/types";

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const publicRoot = (assetRoot: string) =>
  join(process.cwd(), "public", assetRoot.replace(/^\//, ""));

// ---- typed + public manifest contract ---------------------------------------
const sitDir = publicRoot(FEMALE_SITTING_WEST.assetRoot);
const sitManifest = JSON.parse(await readFile(join(sitDir, "manifest.json"), "utf8")) as {
  id: string;
  characterId: string;
  pixelLabStateId: string;
  canvas: { width: number; height: number };
  seatAnchor: { x: number; y: number };
  displayScale: number;
  sha256: string;
};

invariant(sitManifest.id === FEMALE_SITTING_WEST.id, "sit manifest ID mismatch");
invariant(
  sitManifest.characterId === "384a6412-08e4-4e1b-819f-aaa243e03bc2",
  "sit manifest character ID mismatch",
);
invariant(
  sitManifest.pixelLabStateId === "205f8eba-3a91-40a4-8b9f-6c872dedb86f",
  "sit manifest PixelLab state ID mismatch",
);
for (const [label, m] of [
  ["public", sitManifest],
  ["typed", { ...FEMALE_SITTING_WEST, seatAnchor: FEMALE_SITTING_WEST.seatAnchor }],
] as const) {
  invariant(
    m.canvas.width === 128 && m.canvas.height === 128,
    `${label} sit manifest canvas must be 128x128`,
  );
  invariant(
    m.seatAnchor.x === 64 && m.seatAnchor.y === 80,
    `${label} sit manifest seat anchor must be (64,80)`,
  );
  invariant(m.displayScale === 1.12, `${label} sit manifest display scale must be 1.12`);
}

// ---- the sitting PNG itself --------------------------------------------------
const EXPECTED_SHA = "ca8d80e01520dba2d65681e619543522738b134308b3b0976e80b954d4bce287";
invariant(FEMALE_SITTING_WEST.sha256 === EXPECTED_SHA, "typed sit manifest SHA mismatch");
invariant(sitManifest.sha256 === EXPECTED_SHA, "public sit manifest SHA mismatch");

const sitFile = join(sitDir, FEMALE_SITTING_WEST.file);
const sitBytes = await readFile(sitFile);
const sitSha = createHash("sha256").update(sitBytes).digest("hex");
invariant(sitSha === EXPECTED_SHA, `sit PNG SHA-256 mismatch: ${sitSha}`);

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

const { width, height, data } = decodeRgba(sitBytes, sitFile);
invariant(width === 128 && height === 128, "sit PNG must be 128x128");

let opaque = 0;
let greenDominant = 0;
for (let i = 0; i < data.length; i += 4) {
  const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
  invariant(a === 0 || a === 255, `sit PNG has non-binary alpha value ${a}`);
  if (a !== 255) continue;
  opaque += 1;
  // Green-screen dominance / fringe: green clearly above both other channels.
  if (g > r + 40 && g > b + 40) greenDominant += 1;
}
invariant(opaque > 0, "sit PNG is fully transparent");
invariant(greenDominant === 0, `sit PNG has ${greenDominant} green-dominant/fringe pixels`);

// ---- approved idle/walk bytes must be unchanged ------------------------------
const baseline = JSON.parse(
  await readFile(join(process.cwd(), "scripts", "female-production-128-hashes.json"), "utf8"),
) as { idle: Record<string, string>; walk: Record<string, Record<string, string>> };

const idleDir = publicRoot(FEMALE_PRODUCTION_128.idle.assetRoot);
const walkDir = publicRoot(FEMALE_PRODUCTION_128.walk.assetRoot);
let checked = 0;
for (const direction of FEMALE_PRODUCTION_128.directions) {
  const idleFile = join(idleDir, `${direction}.png`);
  const idleSha = createHash("sha256").update(await readFile(idleFile)).digest("hex");
  invariant(idleSha === baseline.idle[direction], `Approved idle asset changed: ${idleFile}`);
  checked += 1;
  for (const frame of FEMALE_PRODUCTION_128.walk.frames) {
    const walkFile = join(walkDir, direction, frame);
    const walkSha = createHash("sha256").update(await readFile(walkFile)).digest("hex");
    invariant(
      walkSha === baseline.walk[direction][frame],
      `Approved walk asset changed: ${walkFile}`,
    );
    checked += 1;
  }
}
invariant(checked === 56, `Expected 56 approved idle/walk assets, checked ${checked}`);

// ---- resolution + fallback ---------------------------------------------------
const female = { preset: "blaze-original", gender: "female" } as unknown as AvatarConfig;
invariant(
  presetPathFor(female, "west", "sit", 0) === femaleSittingWestPath(),
  "Candidate 2 female west sit must resolve to the new sitting asset",
);
for (const direction of FEMALE_PRODUCTION_128.directions) {
  if (direction === "west") continue;
  invariant(
    presetPathFor(female, direction, "sit", 0) === femaleProduction128IdlePath(direction),
    `Female sit (${direction}) must hold the Candidate 2 idle, not legacy sitting art`,
  );
}
invariant(
  !femaleSittingWestPath().includes("/sit-female/"),
  "Candidate 2 sitting must never route to the legacy sit-female directory",
);

const sitMetrics = getAvatarRenderMetrics(female, "sit", "west");
invariant(
  sitMetrics.canvas === 128 &&
    sitMetrics.displayScale === 1.12 &&
    sitMetrics.pivotX === 64 &&
    sitMetrics.pivotY === 80 &&
    sitMetrics.labelOffsetY === 118,
  "Candidate 2 sit render metrics mismatch",
);
const idleMetrics = getAvatarRenderMetrics(female, "idle", "west");
const walkMetrics = getAvatarRenderMetrics(female, "walk", "west");
invariant(
  idleMetrics === walkMetrics,
  "Female idle and walk must share exactly one render-metrics object",
);
invariant(
  idleMetrics.displayScale === 1.12 && idleMetrics.canvas === 128 && idleMetrics.pivotY === 120,
  "Female idle/walk metrics must be 128px canvas, 1.12 scale, pivot row 120",
);
const male = { preset: "blaze-original", gender: "male" } as unknown as AvatarConfig;
const maleSit = getAvatarRenderMetrics(male, "sit", "west");
invariant(
  maleSit.canvas === 96 &&
    maleSit.displayScale === 2.4 &&
    maleSit.pivotX === 48 &&
    maleSit.pivotY === 60,
  "Legacy male sit geometry must remain 96 / 2.4 / (48,60)",
);

console.log(
  `Verified Candidate 2 west sitting asset (128x128, binary alpha, ${opaque} opaque px) and ${checked} unchanged approved idle/walk assets`,
);