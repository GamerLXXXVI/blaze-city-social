import type { AvatarConfig, Direction, AnimState, Facing } from "./types";
import {
  LAYER_ORDER,
  AVATAR_SIZE,
  pathFor,
  presetPathFor,
  FEMALE_WORLD_IDLE_DRAW,
  isFemaleIdlePath,
  FEMALE_WORLD_SIT_DRAW,
  isFemaleSitPath,
  FEMALE_WORLD_DANCE_DRAW,
  isFemaleDancePath,
  FEMALE_WORLD_WALK_DRAW,
  isFemaleWalkPath,
} from "./manifest";
import { loadAvatarImage, loadAvatarImageStrict } from "./loader";

function cacheKey(
  cfg: AvatarConfig,
  direction: Direction,
  state: AnimState,
  frame: number,
  facing: Facing,
): string {
  return [
    cfg.gender,
    cfg.body_type,
    cfg.head_shape,
    cfg.eyes,
    cfg.eyebrows,
    cfg.mouth,
    cfg.hair,
    cfg.shirt,
    cfg.pants,
    direction,
    state,
    frame,
    facing,
  ].join("|");
}

const composited = new Map<string, HTMLCanvasElement>();
const MAX_ENTRIES = 400;

function evictIfNeeded() {
  if (composited.size <= MAX_ENTRIES) return;
  const firstKey = composited.keys().next().value;
  if (firstKey) composited.delete(firstKey);
}

export async function compositeFrame(
  cfg: AvatarConfig,
  direction: Direction,
  state: AnimState,
  frame: number,
  facing: Facing = "right",
): Promise<HTMLCanvasElement> {
  const key = cacheKey(cfg, direction, state, frame, facing);
  const cached = composited.get(key);
  if (cached) return cached;

  // For a 2-frame walk cycle, we swap the state between the two frames.
  // (Placeholder art only has idle/walk; real art can have more frames.)
  const frameState: AnimState = state === "walk" && frame % 2 === 0 ? "idle" : state;

  const size = AVATAR_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const presetPath = presetPathFor(cfg, direction, state, frame);
  if (presetPath) {
    let image: HTMLImageElement;
    if (isFemaleDancePath(presetPath)) {
      // If the female dance art is missing, preserve her idle sprite rather
      // than silently substituting the male dance sprite.
      try {
        image = await loadAvatarImageStrict(presetPath);
      } catch {
        return compositeFrame(cfg, direction, "idle", 0, facing);
      }
    } else {
      image = await loadAvatarImage(presetPath);
    }
    ctx.imageSmoothingEnabled = false;
    if (isFemaleIdlePath(presetPath) || isFemaleDancePath(presetPath) || isFemaleWalkPath(presetPath)) {
      // Normalize the full-bleed selector idle art to world sprite metrics.
      const draw = isFemaleDancePath(presetPath)
        ? FEMALE_WORLD_DANCE_DRAW
        : isFemaleWalkPath(presetPath)
          ? FEMALE_WORLD_WALK_DRAW
          : FEMALE_WORLD_IDLE_DRAW;
      const s = (draw.size / 64) * (size / 64);
      const dw = Math.round(64 * s);
      const dx = Math.round(draw.dx * (size / 64));
      const dy = Math.round(draw.dy * (size / 64));
      ctx.drawImage(image, dx, dy, dw, dw);
    } else if (isFemaleSitPath(presetPath)) {
      // Normalize the full-bleed sitting art to world sprite metrics so the
      // seated female matches her idle/walk scale.
      const k = size / 64;
      const dw = Math.round(FEMALE_WORLD_SIT_DRAW.size * k);
      const dx = Math.round(FEMALE_WORLD_SIT_DRAW.dx * k);
      const dy = Math.round(FEMALE_WORLD_SIT_DRAW.dy * k);
      ctx.drawImage(image, dx, dy, dw, dw);
    } else {
      ctx.drawImage(image, 0, 0, size, size);
    }
    composited.set(key, canvas);
    evictIfNeeded();
    return canvas;
  }

  const layerDirection =
    direction === "north" || direction.startsWith("north-")
      ? "up"
      : direction === "east" || direction === "west"
        ? "side"
        : "down";

  const layerImages = await Promise.all(
    LAYER_ORDER.map((layer) => loadAvatarImage(pathFor(layer, cfg, layerDirection, frameState))),
  );

  if (direction === "west" || (facing === "left" && layerDirection === "side")) {
    ctx.save();
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    for (const img of layerImages) ctx.drawImage(img, 0, 0, size, size);
    ctx.restore();
  } else {
    for (const img of layerImages) ctx.drawImage(img, 0, 0, size, size);
  }

  composited.set(key, canvas);
  evictIfNeeded();
  return canvas;
}
