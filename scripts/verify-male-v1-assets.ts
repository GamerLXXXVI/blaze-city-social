import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { MALE_V1, maleV1IdlePath, maleV1SitWestPath, maleV1WalkPath } from "../src/avatar/maleV1";
import { presetPathFor, walkFrameCount, walkFrameMs, idleFrameCount } from "../src/avatar/manifest";
import {
  MALE_V1_MANIFEST_BYTE_LENGTH,
  MALE_V1_MANIFEST_SHA256,
  MALE_V1_MANIFEST_URL,
  maleV1CanonicalPath,
} from "../src/avatar/maleV1VerifiedLoader";
import { getAvatarRenderMetrics } from "../src/avatar/renderMetrics";
import type { AvatarConfig, Direction } from "../src/avatar/types";

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type AssetEntry = {
  path: string;
  url: string;
  sha256: string;
  byteLength: number;
  width: number;
  height: number;
};

const root = join(process.cwd(), "public", MALE_V1.assetRoot.replace(/^\//, ""));

// ---- pinned public manifest bytes -------------------------------------------
// The browser runtime loader verifies these exact values before it parses the
// manifest, so a drift here would silently disable runtime verification.
const manifestBytes = await readFile(join(root, "manifest.json"));
invariant(
  MALE_V1_MANIFEST_URL === `${MALE_V1.assetRoot}/manifest.json`,
  "runtime manifest URL must point at the approved Male V1 manifest",
);
invariant(
  manifestBytes.byteLength === MALE_V1_MANIFEST_BYTE_LENGTH,
  `public manifest byte length is ${manifestBytes.byteLength}, pinned ${MALE_V1_MANIFEST_BYTE_LENGTH}`,
);
const manifestSha = createHash("sha256").update(manifestBytes).digest("hex");
invariant(
  manifestSha === MALE_V1_MANIFEST_SHA256,
  `public manifest SHA-256 is ${manifestSha}, pinned ${MALE_V1_MANIFEST_SHA256}`,
);

const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
  id: string;
  approvalStatus: string;
  pixelLab: { characterId: string; sittingStateId: string };
  directionOrder: Direction[];
  integrity: { algorithm: string; assetCount: number; verifyBeforeDecode: boolean };
  render: { logicalCanvas: [number, number]; displayScale: number; interpolation: string };
  idle: {
    sourceCanvas: [number, number];
    sourceRect: [number, number, number, number];
    productionPivot: [number, number];
    assets: Record<string, AssetEntry>;
  };
  walk: {
    canvas: [number, number];
    productionPivot: [number, number];
    framesPerDirection: number;
    frameDurationMs: number;
    assets: Record<string, AssetEntry[]>;
  };
  sit: {
    supportedDirections: string[];
    productionPivot: [number, number];
    assets: Record<string, AssetEntry>;
    loadFallback: { state: string; direction: string };
  };
  dance: { status: string; fallback: { state: string; direction: string } };
};

// ---- typed <-> public manifest contract --------------------------------------
invariant(manifest.id === MALE_V1.id, "Male V1 manifest ID mismatch");
invariant(manifest.approvalStatus === "visually-approved", "Male V1 package is not approved");
invariant(manifest.pixelLab.characterId === MALE_V1.characterId, "character ID mismatch");
invariant(manifest.pixelLab.sittingStateId === MALE_V1.sittingStateId, "sitting state ID mismatch");
invariant(
  manifest.directionOrder.join(",") === MALE_V1.directions.join(","),
  "direction order mismatch",
);
invariant(manifest.integrity.algorithm === "SHA-256", "integrity algorithm must be SHA-256");
invariant(manifest.integrity.assetCount === MALE_V1.assetCount, "asset count mismatch");
invariant(
  manifest.integrity.verifyBeforeDecode === true,
  "manifest must declare verify-before-decode",
);
invariant(
  manifest.render.logicalCanvas[0] === 128 && manifest.render.logicalCanvas[1] === 128,
  "logical canvas must be 128x128",
);
invariant(manifest.render.displayScale === MALE_V1.displayScale, "display scale must be 1.12");
invariant(manifest.render.interpolation === "none", "interpolation must be none");
invariant(
  manifest.idle.sourceRect[0] === MALE_V1.idle.sourceRect.x &&
    manifest.idle.sourceRect[1] === MALE_V1.idle.sourceRect.y &&
    manifest.idle.sourceRect[2] === MALE_V1.idle.sourceRect.width &&
    manifest.idle.sourceRect[3] === MALE_V1.idle.sourceRect.height,
  "idle crop rect mismatch",
);
invariant(
  manifest.idle.productionPivot[0] === MALE_V1.pivot.x &&
    manifest.idle.productionPivot[1] === MALE_V1.pivot.y &&
    manifest.walk.productionPivot[0] === MALE_V1.pivot.x &&
    manifest.walk.productionPivot[1] === MALE_V1.pivot.y,
  "standing pivot must be (64,120)",
);
invariant(
  manifest.sit.productionPivot[0] === MALE_V1.sit.seatAnchor.x &&
    manifest.sit.productionPivot[1] === MALE_V1.sit.seatAnchor.y,
  "seat anchor must be (64,80)",
);
invariant(
  manifest.walk.framesPerDirection === MALE_V1.walk.frameCount &&
    manifest.walk.frameDurationMs === MALE_V1.walk.frameMs,
  "walk timing must be 6 frames at 100 ms",
);
invariant(
  manifest.sit.supportedDirections.join(",") === MALE_V1.sit.supportedDirections.join(","),
  "sitting must be WEST only",
);
invariant(
  manifest.sit.loadFallback.state === "idle" && manifest.sit.loadFallback.direction === "west",
  "sit load fallback must be Male V1 west idle",
);
invariant(manifest.dance.status === "temporary-safe-fallback", "dance must be the safe fallback");

// ---- every approved PNG byte -------------------------------------------------
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

async function checkAsset(entry: AssetEntry, expectedWidth: number, expectedHeight: number) {
  const file = join(process.cwd(), entry.path);
  const bytes = await readFile(file);
  const sha = createHash("sha256").update(bytes).digest("hex");
  invariant(sha === entry.sha256, `SHA-256 mismatch for ${entry.path}: ${sha}`);
  invariant(bytes.byteLength === entry.byteLength, `byte length mismatch for ${entry.path}`);
  invariant(bytes.subarray(0, 8).equals(PNG_SIGNATURE), `${entry.path} is not a PNG`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];
  const interlace = bytes[28];
  invariant(
    width === expectedWidth && height === expectedHeight,
    `${entry.path} must be ${expectedWidth}x${expectedHeight}, got ${width}x${height}`,
  );
  invariant(width === entry.width && height === entry.height, `${entry.path} manifest size drift`);
  invariant(bitDepth === 8, `${entry.path} must be 8-bit`);
  invariant(colorType === 6, `${entry.path} must be RGBA (color type 6)`);
  invariant(interlace === 0, `${entry.path} must not be interlaced`);
}

let checked = 0;
for (const direction of MALE_V1.directions) {
  const idle = manifest.idle.assets[direction];
  invariant(idle, `missing idle asset for ${direction}`);
  await checkAsset(idle, manifest.idle.sourceCanvas[0], manifest.idle.sourceCanvas[1]);
  checked += 1;

  const frames = manifest.walk.assets[direction];
  invariant(frames?.length === MALE_V1.walk.frameCount, `${direction} must have exactly 6 frames`);
  for (let i = 0; i < frames.length; i++) {
    invariant(
      frames[i].url.endsWith(`/${MALE_V1.walk.frames[i]}`),
      `${direction} frame ${i} is out of order`,
    );
    await checkAsset(frames[i], 128, 128);
    checked += 1;
  }
}
await checkAsset(manifest.sit.assets.west, 128, 128);
checked += 1;
invariant(checked === MALE_V1.assetCount, `Expected 57 approved assets, checked ${checked}`);

// ---- runtime resolution + fallbacks ------------------------------------------
const male = { preset: "blaze-original", gender: "male" } as unknown as AvatarConfig;

invariant(walkFrameCount(male) === 6, "male walk must be 6 frames");
invariant(walkFrameMs(male) === 100, "male walk must run at 100 ms/frame");
invariant(idleFrameCount(male) === 1, "male idle must be a single static frame");

for (const direction of MALE_V1.directions) {
  invariant(
    presetPathFor(male, direction, "idle", 0) === maleV1IdlePath(direction),
    `male idle (${direction}) must resolve to the approved Male V1 art`,
  );
  for (let i = 0; i < MALE_V1.walk.frameCount; i++) {
    invariant(
      presetPathFor(male, direction, "walk", i) === maleV1WalkPath(direction, i),
      `male walk (${direction} frame ${i}) must resolve to the approved Male V1 art`,
    );
  }
  const sit = presetPathFor(male, direction, "sit", 0);
  invariant(
    sit === (direction === "west" ? maleV1SitWestPath() : maleV1IdlePath(direction)),
    `male sit (${direction}) must be west sitting art or the same-direction Male V1 idle`,
  );
  const dance = presetPathFor(male, direction, "dance", 0);
  invariant(dance === maleV1IdlePath("south"), "male dance must hold the safe idle fallback");
}

// No male state may ever resolve to female art or to the legacy male art.
for (const state of ["idle", "walk", "sit", "dance"] as const) {
  for (const direction of MALE_V1.directions) {
    const path = presetPathFor(male, direction, state, 0)!;
    invariant(
      path.startsWith(MALE_V1.assetRoot),
      `male ${state} escaped the Male V1 root: ${path}`,
    );
    invariant(!path.includes("female"), `male ${state} must never resolve to female art: ${path}`);
  }
}

// ---- render metrics ----------------------------------------------------------
const idleMetrics = getAvatarRenderMetrics(male, "idle", "south");
const walkMetrics = getAvatarRenderMetrics(male, "walk", "south");
invariant(idleMetrics === walkMetrics, "male idle and walk must share one render-metrics object");
invariant(
  idleMetrics.canvas === 128 &&
    idleMetrics.displayScale === 1.12 &&
    idleMetrics.pivotX === 64 &&
    idleMetrics.pivotY === 120,
  "male idle/walk metrics must be 128px canvas, 1.12 scale, pivot (64,120)",
);
const sitMetrics = getAvatarRenderMetrics(male, "sit", "west");
invariant(
  sitMetrics.canvas === 128 &&
    sitMetrics.displayScale === 1.12 &&
    sitMetrics.pivotX === 64 &&
    sitMetrics.pivotY === 80,
  "male west sit metrics must be 128px canvas, 1.12 scale, seat anchor (64,80)",
);
invariant(
  getAvatarRenderMetrics(male, "sit", "north") === idleMetrics,
  "male non-west sit must hold the standing idle metrics",
);

// ---- approved female bytes must be untouched ---------------------------------
const femaleBaseline = JSON.parse(
  await readFile(join(process.cwd(), "scripts", "female-production-128-hashes.json"), "utf8"),
) as { idle: Record<string, string>; walk: Record<string, Record<string, string>> };
let femaleChecked = 0;
for (const [direction, sha] of Object.entries(femaleBaseline.idle)) {
  const file = join(
    process.cwd(),
    "public/assets/avatars/presets/blaze-original/idle-female-pixellab-v2",
    `${direction}.png`,
  );
  const actual = createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
  invariant(actual === sha, `Female idle asset changed: ${file}`);
  femaleChecked += 1;
}
for (const [direction, frames] of Object.entries(femaleBaseline.walk)) {
  for (const [frame, sha] of Object.entries(frames)) {
    const file = join(
      process.cwd(),
      "public/assets/avatars/presets/blaze-original/walk-female-pixellab-v2",
      direction,
      frame,
    );
    const actual = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
    invariant(actual === sha, `Female walk asset changed: ${file}`);
    femaleChecked += 1;
  }
}

// ---- runtime verification contract -------------------------------------------
const compositorSource = await readFile(join(process.cwd(), "src/avatar/compositor.ts"), "utf8");
const maleBranch = compositorSource.slice(
  compositorSource.indexOf("isMaleV1Path(presetPath)"),
  compositorSource.indexOf("image = await loadAvatarImage(presetPath)"),
);
invariant(
  maleBranch.includes("loadMaleV1VerifiedImage"),
  "compositor Male V1 branch must use the verified loader",
);
invariant(
  !maleBranch.includes("loadAvatarImageStrict") && !maleBranch.includes("loadAvatarImage("),
  "compositor Male V1 branch must never use the legacy image loaders",
);
invariant(
  maleBranch.includes('compositeFrame(cfg, "west", "idle", 0, facing)'),
  "failed Male V1 west sit must fall back to the verified Male V1 west idle",
);
invariant(
  maleBranch.includes("compositeFrame(cfg, direction, \"idle\", 0, facing)"),
  "failed Male V1 walk must fall back to the same-direction verified Male V1 idle",
);
invariant(
  maleBranch.includes("throw error"),
  "failed Male V1 idle must fail closed",
);

const loaderSource = await readFile(
  join(process.cwd(), "src/avatar/maleV1VerifiedLoader.ts"),
  "utf8",
);
for (const needle of [
  "crypto.subtle.digest",
  "MALE_V1_MANIFEST_SHA256",
  "byteLength",
  "naturalWidth",
  "URL.revokeObjectURL",
  "verifiedImages.delete",
]) {
  invariant(
    loaderSource.includes(needle),
    `verified loader must implement the runtime contract (${needle})`,
  );
}
invariant(
  maleV1CanonicalPath(maleV1IdlePath("south")) === `${MALE_V1.assetRoot}/idle/south.png`,
  "canonical path lookup must strip the cache-busting query",
);
invariant(
  manifest.idle.assets.south.url === maleV1CanonicalPath(maleV1IdlePath("south")),
  "runtime idle URL must match the manifest entry",
);
invariant(
  manifest.sit.assets.west.url === maleV1CanonicalPath(maleV1SitWestPath()),
  "runtime sit URL must match the manifest entry",
);
invariant(
  manifest.walk.assets.south[3].url === maleV1CanonicalPath(maleV1WalkPath("south", 3)),
  "runtime walk URL must match the manifest entry",
);

console.log(
  `Verified ${checked} approved Male V1 assets (SHA-256, 8-bit RGBA, 232px idle crop / 128px walk+sit), pinned manifest bytes, runtime hash-verified loading with idle-only fallbacks, and ${femaleChecked} untouched female assets`,
);
