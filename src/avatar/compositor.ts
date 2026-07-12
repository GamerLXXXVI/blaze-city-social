import type { AvatarConfig, Direction, AnimState, Facing } from "./types";
import { LAYER_ORDER, AVATAR_SIZE, pathFor } from "./manifest";
import { loadAvatarImage } from "./loader";

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

  const layerImages = await Promise.all(
    LAYER_ORDER.map((layer) => loadAvatarImage(pathFor(layer, cfg, direction, frameState))),
  );

  if (facing === "left" && direction === "side") {
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
