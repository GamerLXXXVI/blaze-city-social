// Manifest-driven, hash-verified browser loader for the approved
// "Blaze City Male V1" package.
//
// Every Male V1 image the runtime decodes goes through this module:
//   1. the immutable public manifest itself is fetched, byte-length checked
//      and SHA-256 verified against a pinned digest BEFORE it is parsed;
//   2. the manifest's critical contract is validated and flattened into a
//      lookup of exactly 57 unique asset entries (8 idle, 48 walk, 1 west sit);
//   3. each image is fetched as raw bytes, verified (ok, byteLength, SHA-256)
//      BEFORE decoding, decoded from a temporary Blob URL, and then checked
//      against the manifest's declared pixel dimensions.
// Anything that fails, fails closed: the rejected promise is dropped from the
// cache so a later valid request can recover, and no permissive/legacy loader
// is ever consulted for a Male V1 path.
import { MALE_V1 } from "./maleV1";

export const MALE_V1_MANIFEST_URL = `${MALE_V1.assetRoot}/manifest.json`;
export const MALE_V1_MANIFEST_SHA256 =
  "d7fb3909408a8dc559300d9e3214da4525fb19e0e7dc5bef5dcf60e385417c1b";
export const MALE_V1_MANIFEST_BYTE_LENGTH = 24214;

export interface MaleV1AssetEntry {
  path: string;
  url: string;
  sha256: string;
  byteLength: number;
  width: number;
  height: number;
}

interface MaleV1PublicManifest {
  id: string;
  approvalStatus: string;
  pixelLab: { characterId: string; sittingStateId: string };
  directionOrder: string[];
  integrity: { algorithm: string; assetCount: number; verifyBeforeDecode: boolean };
  render: { logicalCanvas: [number, number]; displayScale: number; interpolation: string };
  idle: {
    sourceCanvas: [number, number];
    sourceRect: [number, number, number, number];
    productionPivot: [number, number];
    assets: Record<string, MaleV1AssetEntry>;
  };
  walk: {
    productionPivot: [number, number];
    framesPerDirection: number;
    frameDurationMs: number;
    assets: Record<string, MaleV1AssetEntry[]>;
  };
  sit: {
    supportedDirections: string[];
    productionPivot: [number, number];
    assets: Record<string, MaleV1AssetEntry>;
    loadFallback: { state: string; direction: string };
  };
  dance: { status: string; fallback: { state: string; direction: string; frame: number } };
}

function fail(message: string): never {
  throw new Error(`[male-v1] ${message}`);
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    fail("Web Crypto is unavailable; refusing to decode unverified Male V1 bytes");
  }
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Strips the cache-busting query so runtime URLs match manifest URLs. */
export function maleV1CanonicalPath(url: string): string {
  const withoutQuery = url.split("?")[0];
  const rootIndex = withoutQuery.indexOf(MALE_V1.assetRoot);
  return rootIndex >= 0 ? withoutQuery.slice(rootIndex) : withoutQuery;
}

let manifestPromise: Promise<Map<string, MaleV1AssetEntry>> | null = null;

function flatten(manifest: MaleV1PublicManifest): Map<string, MaleV1AssetEntry> {
  // ---- critical contract -----------------------------------------------
  if (manifest.id !== MALE_V1.id) fail("manifest id mismatch");
  if (manifest.approvalStatus !== "visually-approved") fail("manifest is not approved");
  if (manifest.pixelLab.characterId !== MALE_V1.characterId) fail("character id mismatch");
  if (manifest.pixelLab.sittingStateId !== MALE_V1.sittingStateId) fail("sitting state id mismatch");
  if (manifest.directionOrder.join(",") !== MALE_V1.directions.join(",")) {
    fail("direction order mismatch");
  }
  if (manifest.integrity.algorithm !== "SHA-256") fail("integrity algorithm must be SHA-256");
  if (manifest.integrity.assetCount !== MALE_V1.assetCount) fail("asset count must be 57");
  if (manifest.integrity.verifyBeforeDecode !== true) fail("manifest must require verify-before-decode");
  if (manifest.render.logicalCanvas[0] !== MALE_V1.canvas.width) fail("logical canvas must be 128");
  if (manifest.render.logicalCanvas[1] !== MALE_V1.canvas.height) fail("logical canvas must be 128");
  if (manifest.render.displayScale !== MALE_V1.displayScale) fail("display scale must be 1.12");
  if (manifest.render.interpolation !== "none") fail("interpolation must be none");
  const r = MALE_V1.idle.sourceRect;
  const sr = manifest.idle.sourceRect;
  if (sr[0] !== r.x || sr[1] !== r.y || sr[2] !== r.width || sr[3] !== r.height) {
    fail("idle crop rect mismatch");
  }
  if (manifest.idle.productionPivot[0] !== MALE_V1.pivot.x) fail("idle pivot mismatch");
  if (manifest.idle.productionPivot[1] !== MALE_V1.pivot.y) fail("idle pivot mismatch");
  if (manifest.walk.productionPivot[0] !== MALE_V1.pivot.x) fail("walk pivot mismatch");
  if (manifest.walk.productionPivot[1] !== MALE_V1.pivot.y) fail("walk pivot mismatch");
  if (manifest.walk.framesPerDirection !== MALE_V1.walk.frameCount) fail("walk must be 6 frames");
  if (manifest.walk.frameDurationMs !== MALE_V1.walk.frameMs) fail("walk must be 100 ms/frame");
  if (manifest.sit.supportedDirections.join(",") !== MALE_V1.sit.supportedDirections.join(",")) {
    fail("sitting must be WEST only");
  }
  if (manifest.sit.productionPivot[0] !== MALE_V1.sit.seatAnchor.x) fail("seat anchor mismatch");
  if (manifest.sit.productionPivot[1] !== MALE_V1.sit.seatAnchor.y) fail("seat anchor mismatch");
  if (manifest.sit.loadFallback.state !== "idle" || manifest.sit.loadFallback.direction !== "west") {
    fail("sit fallback must be the Male V1 west idle");
  }
  if (manifest.dance.status !== "temporary-safe-fallback") fail("dance must be the safe fallback");

  // ---- flatten to exactly 57 unique entries -----------------------------
  const entries = new Map<string, MaleV1AssetEntry>();
  const add = (entry: MaleV1AssetEntry | undefined, expected: [number, number], label: string) => {
    if (!entry) fail(`missing manifest entry: ${label}`);
    if (typeof entry.sha256 !== "string" || entry.sha256.length !== 64) {
      fail(`invalid sha256 for ${label}`);
    }
    if (!Number.isInteger(entry.byteLength) || entry.byteLength <= 0) {
      fail(`invalid byteLength for ${label}`);
    }
    if (entry.width !== expected[0] || entry.height !== expected[1]) {
      fail(`unexpected declared dimensions for ${label}`);
    }
    const key = maleV1CanonicalPath(entry.url);
    if (!key.startsWith(`${MALE_V1.assetRoot}/`)) fail(`entry escapes the Male V1 root: ${key}`);
    if (entries.has(key)) fail(`duplicate manifest entry: ${key}`);
    entries.set(key, entry);
  };

  let idleCount = 0;
  let walkCount = 0;
  for (const direction of MALE_V1.directions) {
    add(manifest.idle.assets[direction], manifest.idle.sourceCanvas, `idle/${direction}`);
    idleCount += 1;
    const frames = manifest.walk.assets[direction];
    if (!Array.isArray(frames) || frames.length !== MALE_V1.walk.frameCount) {
      fail(`walk/${direction} must have exactly 6 frames`);
    }
    frames.forEach((frame, i) => {
      if (!frame.url.endsWith(`/${MALE_V1.walk.frames[i]}`)) {
        fail(`walk/${direction} frame ${i} is out of manifest order`);
      }
      add(frame, [MALE_V1.canvas.width, MALE_V1.canvas.height], `walk/${direction}/${i}`);
      walkCount += 1;
    });
  }
  add(manifest.sit.assets.west, [MALE_V1.canvas.width, MALE_V1.canvas.height], "sit/west");

  if (idleCount !== 8) fail(`expected 8 idle assets, found ${idleCount}`);
  if (walkCount !== 48) fail(`expected 48 walk assets, found ${walkCount}`);
  if (entries.size !== MALE_V1.assetCount) {
    fail(`expected 57 unique assets, found ${entries.size}`);
  }
  return entries;
}

/** Fetches, hash-verifies and flattens the immutable public manifest once. */
export function loadMaleV1Manifest(): Promise<Map<string, MaleV1AssetEntry>> {
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    const response = await fetch(`${MALE_V1_MANIFEST_URL}?v=${MALE_V1.version}`, {
      cache: "no-cache",
    });
    if (!response.ok) fail(`manifest request failed with ${response.status}`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== MALE_V1_MANIFEST_BYTE_LENGTH) {
      fail(`manifest byte length mismatch: ${bytes.byteLength}`);
    }
    const sha = await sha256Hex(bytes);
    if (sha !== MALE_V1_MANIFEST_SHA256) fail(`manifest SHA-256 mismatch: ${sha}`);
    const manifest = JSON.parse(new TextDecoder().decode(bytes)) as MaleV1PublicManifest;
    return flatten(manifest);
  })().catch((error) => {
    manifestPromise = null;
    throw error;
  });
  return manifestPromise;
}

const verifiedImages = new Map<string, Promise<HTMLImageElement>>();

async function decodeVerified(entry: MaleV1AssetEntry): Promise<HTMLImageElement> {
  const response = await fetch(`${entry.url}?v=${MALE_V1.version}`, { cache: "no-cache" });
  if (!response.ok) fail(`${entry.url} request failed with ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== entry.byteLength) {
    fail(`${entry.url} byte length mismatch: ${bytes.byteLength} != ${entry.byteLength}`);
  }
  const sha = await sha256Hex(bytes);
  if (sha !== entry.sha256) fail(`${entry.url} SHA-256 mismatch: ${sha}`);

  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`[male-v1] failed to decode ${entry.url}`));
      img.src = objectUrl;
    });
    if (image.naturalWidth !== entry.width || image.naturalHeight !== entry.height) {
      fail(
        `${entry.url} decoded to ${image.naturalWidth}x${image.naturalHeight}, expected ${entry.width}x${entry.height}`,
      );
    }
    if (typeof image.decode === "function") {
      await image.decode().catch(() => undefined);
    }
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Loads one approved Male V1 image. Rejects (fails closed) unless the public
 * manifest and the raw PNG bytes both verify.
 */
export function loadMaleV1VerifiedImage(url: string): Promise<HTMLImageElement> {
  const key = maleV1CanonicalPath(url);
  const cached = verifiedImages.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const entries = await loadMaleV1Manifest();
    const entry = entries.get(key);
    if (!entry) fail(`no manifest entry for ${key}`);
    return decodeVerified(entry);
  })().catch((error) => {
    // Drop the rejected entry so a later valid request can recover.
    verifiedImages.delete(key);
    throw error;
  });
  verifiedImages.set(key, promise);
  return promise;
}

/**
 * Verifies + decodes all 57 approved Male V1 assets once. Rejects if any one
 * of them fails verification — failures are never converted into success here.
 */
let maleV1Preloaded: Promise<void> | null = null;
export function preloadMaleV1Frames(): Promise<void> {
  if (maleV1Preloaded) return maleV1Preloaded;
  if (typeof window === "undefined") return Promise.resolve();
  maleV1Preloaded = (async () => {
    const entries = await loadMaleV1Manifest();
    await Promise.all([...entries.keys()].map((key) => loadMaleV1VerifiedImage(key)));
  })().catch((error) => {
    maleV1Preloaded = null;
    throw error;
  });
  return maleV1Preloaded;
}
