// Generates a colored-rectangle placeholder image for any known avatar asset path.
// Real files at /public/assets/... will take precedence in production.
import { AVATAR_SIZE, type LayerId } from "./manifest";

const LAYER_COLORS: Record<LayerId, string> = {
  body: "#e8c4a0",
  pants: "#3a4a80",
  shirt: "#c94a4a",
  head_shape: "#f0d0b0",
  mouth: "#7a2020",
  eyes: "#2a2a2a",
  eyebrows: "#3a2a1a",
  hair: "#4a2a1a",
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function shift(hex: string, hueSeed: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const jitter = (v: number, s: number) =>
    Math.max(0, Math.min(255, v + ((s % 60) - 30)));
  const nr = jitter(r, hueSeed);
  const ng = jitter(g, hueSeed >> 2);
  const nb = jitter(b, hueSeed >> 4);
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

function parsePath(url: string): {
  layer: LayerId;
  optionId: string;
  direction: string;
  state: string;
} | null {
  // /assets/avatars/base/{gender}/{body}/{dir}_{state}.png
  // /assets/avatars/parts/{layer}/{option}/.../{dir}_{state}.png
  const m = url.match(/\/assets\/avatars\/(base|parts)\/([^/]+)\/(.+)\/([^/]+)_([^./]+)\.png$/);
  if (!m) return null;
  const kind = m[1];
  const first = m[2];
  const direction = m[4];
  const state = m[5];
  if (kind === "base") {
    return { layer: "body", optionId: `${first}-${m[3]}`, direction, state };
  }
  return { layer: first as LayerId, optionId: m[3].split("/")[0], direction, state };
}

// Draws a placeholder frame with layer-specific shape hints so the composite
// is visibly testable end to end.
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  layer: LayerId,
  optionId: string,
  direction: string,
  state: string,
) {
  const size = AVATAR_SIZE;
  ctx.clearRect(0, 0, size, size);
  const baseColor = LAYER_COLORS[layer] ?? "#888";
  const color = shift(baseColor, hashString(optionId + layer));

  // walk state adds a subtle offset so the animation is visible
  const dy = state === "walk" ? -2 : 0;

  // Rough per-layer silhouettes (all within the same 96x96 avatar frame)
  ctx.fillStyle = color;
  switch (layer) {
    case "body":
      // full silhouette
      ctx.fillRect(size * 0.32, size * 0.30 + dy, size * 0.36, size * 0.55);
      break;
    case "pants":
      ctx.fillRect(size * 0.32, size * 0.60 + dy, size * 0.36, size * 0.25);
      break;
    case "shirt":
      ctx.fillRect(size * 0.28, size * 0.38 + dy, size * 0.44, size * 0.25);
      break;
    case "head_shape":
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.25 + dy, size * 0.14, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "mouth":
      ctx.fillRect(size * 0.46, size * 0.32 + dy, size * 0.08, size * 0.02);
      break;
    case "eyes":
      if (direction !== "up") {
        ctx.fillRect(size * 0.44, size * 0.24 + dy, size * 0.04, size * 0.03);
        ctx.fillRect(size * 0.52, size * 0.24 + dy, size * 0.04, size * 0.03);
      }
      break;
    case "eyebrows":
      ctx.fillRect(size * 0.44, size * 0.20 + dy, size * 0.04, size * 0.01);
      ctx.fillRect(size * 0.52, size * 0.20 + dy, size * 0.04, size * 0.01);
      break;
    case "hair":
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.18 + dy, size * 0.16, Math.PI, 2 * Math.PI);
      ctx.fill();
      break;
  }

  // tiny direction indicator (dev aid) - a small dot on the "facing" side
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  if (direction === "side") {
    ctx.fillRect(size * 0.66, size * 0.28 + dy, 2, 2);
  } else if (direction === "up") {
    ctx.fillRect(size * 0.49, size * 0.14 + dy, 2, 2);
  } else {
    ctx.fillRect(size * 0.49, size * 0.34 + dy, 2, 2);
  }
}

const placeholderCache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement>>();

export function getPlaceholderImage(url: string): Promise<HTMLImageElement> {
  const cached = placeholderCache.get(url);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(url);
  if (existing) return existing;

  const parsed = parsePath(url);
  const size = AVATAR_SIZE;
  const p = new Promise<HTMLImageElement>((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    if (parsed) {
      drawPlaceholder(ctx, parsed.layer, parsed.optionId, parsed.direction, parsed.state);
    } else {
      ctx.fillStyle = "#f0f";
      ctx.fillRect(0, 0, size, size);
    }
    const img = new Image();
    img.onload = () => {
      placeholderCache.set(url, img);
      inflight.delete(url);
      resolve(img);
    };
    img.src = canvas.toDataURL("image/png");
  });
  inflight.set(url, p);
  return p;
}
