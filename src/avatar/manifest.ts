// Builds the exact asset paths for each layer as specified.
// Real art can drop into /public/assets/... at these exact URLs and just work.
import type { AvatarConfig, Direction, AnimState } from "./types";
import { DIRECTIONS } from "./types";
import { invalidateAvatarImageCache, loadAvatarImage } from "./loader";

export const AVATAR_SIZE = 96; // logical avatar frame size in room pixels

// Visual scale multiplier for player + bartender sprites. World-position
// anchors (movement, collision, zone hit-testing) are UNAFFECTED — this
// only enlarges the drawn art around its bottom-center foot anchor.
export const PLAYER_SPRITE_SCALE = 2.4;

// Bartender-specific render scale. His visible content (head-to-feet, rows
// 18–47 of the 64px source ≈ 29px) is a smaller fraction of his sprite than
// the player's, so reusing PLAYER_SPRITE_SCALE makes him appear ~60% of the
// player's height. This scale is tuned so his full head-to-feet extent
// matches the player's on-screen head-to-feet height. Player visible body
// spans ~38/64 of the scaled 168px sprite box ≈ 99.75 world px. Bartender
// visible span is 29 source rows, so scale ≈ 99.75/29 ≈ 3.44. Bumped to
// 3.8 after visual A/B: the player's rendered figure still read taller at
// 3.4 because his head/hair extend above row 8.
export const NPC_RENDER_SCALE = 3.6;

export type LayerDirection = "down" | "up" | "side";

export const DEFAULT_AVATAR_PRESET = "blaze-original" as const;
export const WALK_FRAME_COUNT = 4;
export const WALK_FRAME_MS = 125;
// Female walk art ships 6 frames per direction, played at ~9 fps.
export const FEMALE_WALK_FRAME_COUNT = 6;
export const FEMALE_WALK_FRAME_MS = 111;
// Female selector idle V2 ships 4 native 64px frames per direction, played at ~2 fps.
export const FEMALE_IDLE_FRAME_COUNT = 4;
export const FEMALE_IDLE_FRAME_MS = 500;
export const FEMALE_SELECTOR_IDLE_VERSION = "female-selector-idle-v2";
// The V2 female idle art is authored full-bleed in its 64px frame (body rows
// 3–62), while every world sprite (male idle/walk, female walk) draws its body
// in rows 17–46 of the same 64px frame. Drawing the selector art untouched in
// the world makes her ~2x too tall. In the WORLD renderer only, the idle frame
// is blitted into the shared 64px canvas at half size with a whole-pixel
// offset so her feet land on row 46 and her body height matches the walk art.
// The selector preview does NOT go through this path (see
// FemaleSelectorIdleSprite), so it keeps its native 128x128 rendering.
// The single source of truth for how ANY full-bleed 64px female frame
// (idle, dance) is blitted into the shared world sprite canvas. Every state
// uses this same draw size — only the source frame changes.
export const FEMALE_WORLD_DRAW_SIZE = 32;
export const FEMALE_WORLD_DRAW_DX = 16;
export const FEMALE_WORLD_IDLE_DRAW = {
  size: FEMALE_WORLD_DRAW_SIZE,
  dx: FEMALE_WORLD_DRAW_DX,
  dy: 15,
} as const;

export function isFemaleIdlePath(path: string): boolean {
  return path.includes("/idle-female/");
}

// Female sitting art (8 directions, one frame each) is authored full-bleed in
// its 64px frame (body rows 8–59). World sprites draw their body in rows
// 17–47 of the same 64px frame, so the WORLD renderer blits the sit frame at
// ~0.594 scale with a whole-pixel offset to match the male sit metrics.
export const FEMALE_SIT_VERSION = "female-sit-8dir-v1";
export const FEMALE_WORLD_SIT_DRAW = { size: 38, dx: 13, dy: 12 } as const;

export function isFemaleSitPath(path: string): boolean {
  return path.includes("/sit-female/");
}

export function femaleSitPath(direction: Direction): string {
  return `/assets/avatars/presets/${DEFAULT_AVATAR_PRESET}/sit-female/${direction}.png?v=${FEMALE_SIT_VERSION}`;
}

export const DANCE_FRAME_COUNT = 16;
export const DANCE_FRAME_MS = 165;

// Female-specific dance animation — "Amber Night Master Art V12".
// 216 native 128px frames played sequentially at exactly 24 FPS
// (41.6667 ms/frame), looping 216 -> 1. Source of truth:
// animation-manifest.json / frame-map.csv shipped with the package.
// The previous 72-frame set is fully replaced — frames are never mixed and
// there is no male fallback for a female avatar.
export const FEMALE_DANCE_ID = "amber-night-master-art-v12" as const;
export const FEMALE_DANCE_NAME = "Amber Night Master Art" as const;
export const FEMALE_DANCE_FRAME_COUNT = 216;
export const FEMALE_DANCE_FRAME_MS = 1000 / 24;
export const FEMALE_DANCE_VERSION = "amber-night-master-art-v12-216f";
// The V12 art is authored in a 128px frame (content rows 10–123) rather than
// the 64px idle frame (rows 3–62). These metrics blit every dance frame into
// the SAME shared 64px world canvas at ONE constant destination rectangle, so
// the rendered body height and the foot row (46) are identical to idle/walk.
// Constant for all 216 frames — no per-frame cropping, centering or nudging.
export const FEMALE_WORLD_DANCE_DRAW = { size: 33, dx: 15, dy: 15 } as const;

export function isFemaleDancePath(path: string): boolean {
  return path.includes("/dance-female/");
}

export function femaleDancePath(frame: number): string {
  const f = String((frame % FEMALE_DANCE_FRAME_COUNT) + 1).padStart(3, "0");
  return `/assets/avatars/presets/${DEFAULT_AVATAR_PRESET}/dance-female/frame-${f}.png?v=${FEMALE_DANCE_VERSION}`;
}

// Decodes all 216 dance frames once. Playback waits on this so the first loop
// never stalls on a network fetch.
let femaleDancePreload: Promise<void> | null = null;
export function preloadFemaleDanceFrames(): Promise<void> {
  if (!femaleDancePreload) {
    invalidateAvatarImageCache((url) => url.includes("/dance-female/"));
    femaleDancePreload = Promise.all(
      Array.from({ length: FEMALE_DANCE_FRAME_COUNT }, (_, i) =>
        loadAvatarImage(femaleDancePath(i)),
      ),
    ).then(() => undefined);
  }
  return femaleDancePreload;
}

export function danceFrameCount(cfg: AvatarConfig): number {
  return (cfg.gender ?? "male") === "female" ? FEMALE_DANCE_FRAME_COUNT : DANCE_FRAME_COUNT;
}

export function danceFrameMs(cfg: AvatarConfig): number {
  return (cfg.gender ?? "male") === "female" ? FEMALE_DANCE_FRAME_MS : DANCE_FRAME_MS;
}

export function walkFrameCount(cfg: AvatarConfig): number {
  return (cfg.gender ?? "male") === "female" ? FEMALE_WALK_FRAME_COUNT : WALK_FRAME_COUNT;
}

export function walkFrameMs(cfg: AvatarConfig): number {
  return (cfg.gender ?? "male") === "female" ? FEMALE_WALK_FRAME_MS : WALK_FRAME_MS;
}

export function idleFrameCount(cfg: AvatarConfig): number {
  return (cfg.gender ?? "male") === "female" ? FEMALE_IDLE_FRAME_COUNT : 1;
}

export function idleFrameMs(cfg: AvatarConfig): number {
  return FEMALE_IDLE_FRAME_MS;
}

export function femaleIdleFramePath(direction: Direction, frame: number): string {
  const f = String((frame % FEMALE_IDLE_FRAME_COUNT) + 1).padStart(2, "0");
  return `/assets/avatars/presets/${DEFAULT_AVATAR_PRESET}/idle-female/${direction}/frame-${f}.png?v=${FEMALE_SELECTOR_IDLE_VERSION}`;
}

export function presetPathFor(
  cfg: AvatarConfig,
  direction: Direction,
  state: AnimState,
  frame: number,
): string | null {
  const preset = cfg.preset ?? DEFAULT_AVATAR_PRESET;
  if (preset !== "blaze-original") return null;
  const root = `/assets/avatars/presets/${preset}`;
  const gender = cfg.gender ?? "male";
  // Female art has dedicated idle + 8-direction 6-frame walk sets.
  // Dance/sit still fall through to the male sprites as a TEMPORARY fallback.
  if (gender === "female") {
    if (state === "idle") {
      return femaleIdleFramePath(direction, frame);
    }
    if (state === "dance") {
      // Never fall through to the male dance sprite for a female player.
      return femaleDancePath(frame);
    }
    if (state === "walk") {
      const f = String(frame % FEMALE_WALK_FRAME_COUNT).padStart(2, "0");
      return `${root}/walk-female/${direction}/frame-${f}.png`;
    }
    if (state === "sit") {
      // Never fall through to the male sit sprite for a female player.
      return femaleSitPath(direction);
    }
  }
  if (state === "dance") {
    return `${root}/dance/south/frame-${String(frame % DANCE_FRAME_COUNT).padStart(2, "0")}.png`;
  }
  if (state === "sit") {
    return `${root}/sit/${direction}.png`;
  }
  return state === "walk"
    ? `${root}/walk/${direction}/frame-${String(frame % WALK_FRAME_COUNT).padStart(2, "0")}.png`
    : `${root}/idle/${direction}.png`;
}

export const LAYER_ORDER = [
  "body",
  "pants",
  "shirt",
  "head_shape",
  "mouth",
  "eyes",
  "eyebrows",
  "hair",
] as const;

export type LayerId = (typeof LAYER_ORDER)[number];

export function pathFor(
  layer: LayerId,
  cfg: AvatarConfig,
  direction: LayerDirection,
  state: AnimState,
): string {
  const suffix = `${direction}_${state}.png`;
  switch (layer) {
    case "body":
      return `/assets/avatars/base/${cfg.gender}/${cfg.body_type}/${suffix}`;
    case "head_shape":
      return `/assets/avatars/parts/head_shape/${cfg.head_shape}/${suffix}`;
    case "eyes":
      return `/assets/avatars/parts/eyes/${cfg.eyes}/${suffix}`;
    case "eyebrows":
      return `/assets/avatars/parts/eyebrows/${cfg.eyebrows}/${suffix}`;
    case "mouth":
      return `/assets/avatars/parts/mouth/${cfg.mouth}/${suffix}`;
    case "hair":
      return `/assets/avatars/parts/hair/${cfg.hair}/${cfg.gender}/${suffix}`;
    case "shirt":
      return `/assets/avatars/parts/shirt/${cfg.shirt}/${cfg.gender}/${cfg.body_type}/${suffix}`;
    case "pants":
      return `/assets/avatars/parts/pants/${cfg.pants}/${cfg.gender}/${cfg.body_type}/${suffix}`;
  }
}

// Preload + cache all 48 female walk frames once so direction changes never
// flicker or re-hit the network.
let femaleWalkPreloaded = false;
export function preloadFemaleWalkFrames() {
  if (femaleWalkPreloaded || typeof window === "undefined") return;
  femaleWalkPreloaded = true;
  invalidateAvatarImageCache((url) => url.includes("/idle-female/"));
  if ("caches" in window) {
    void window.caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) =>
            window.caches
              .open(key)
              .then((cache) =>
                cache
                  .keys()
                  .then((requests) =>
                    Promise.all(
                      requests
                        .filter((request) => request.url.includes("/idle-female/"))
                        .map((request) => cache.delete(request)),
                    ),
                  ),
              ),
          ),
        ),
      )
      .catch((error) => console.warn("[avatar] Failed to clear old female idle cache", error));
  }
  const root = `/assets/avatars/presets/${DEFAULT_AVATAR_PRESET}/walk-female`;
  for (const direction of DIRECTIONS) {
    for (let i = 0; i < FEMALE_WALK_FRAME_COUNT; i++) {
      void loadAvatarImage(`${root}/${direction}/frame-${String(i).padStart(2, "0")}.png`);
    }
  }
  const idleRoot = `/assets/avatars/presets/${DEFAULT_AVATAR_PRESET}/idle-female`;
  for (const direction of DIRECTIONS) {
    for (let i = 0; i < FEMALE_IDLE_FRAME_COUNT; i++) {
      void loadAvatarImage(
        `${idleRoot}/${direction}/frame-${String(i + 1).padStart(2, "0")}.png?v=${FEMALE_SELECTOR_IDLE_VERSION}`,
      );
    }
  }
  void preloadFemaleDanceFrames();
}
