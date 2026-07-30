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
  const jitter = (v: number, s: number) => Math.max(0, Math.min(255, v + ((s % 60) - 30)));
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
  const dy = state === "walk" ? -1.5 : 0;
  const cx = size / 2;

  // Helpers for a rounded humanoid silhouette
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  };

  ctx.fillStyle = color;
  switch (layer) {
    case "body": {
      // legs
      roundRect(cx - size * 0.16, size * 0.58 + dy, size * 0.32, size * 0.28, size * 0.09);
      // torso (rounded shoulders)
      roundRect(cx - size * 0.2, size * 0.36 + dy, size * 0.4, size * 0.3, size * 0.14);
      // neck
      roundRect(cx - size * 0.05, size * 0.3 + dy, size * 0.1, size * 0.06, size * 0.03);
      // head
      ctx.beginPath();
      ctx.arc(cx, size * 0.22 + dy, size * 0.13, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "pants":
      roundRect(cx - size * 0.17, size * 0.58 + dy, size * 0.34, size * 0.28, size * 0.09);
      break;
    case "shirt":
      roundRect(cx - size * 0.22, size * 0.36 + dy, size * 0.44, size * 0.26, size * 0.13);
      break;
    case "head_shape":
      ctx.beginPath();
      ctx.arc(cx, size * 0.22 + dy, size * 0.135, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "mouth":
      roundRect(cx - size * 0.05, size * 0.27 + dy, size * 0.1, size * 0.018, size * 0.009);
      break;
    case "eyes":
      if (direction !== "up") {
        ctx.beginPath();
        ctx.arc(cx - size * 0.05, size * 0.22 + dy, size * 0.018, 0, Math.PI * 2);
        ctx.arc(cx + size * 0.05, size * 0.22 + dy, size * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "eyebrows":
      roundRect(cx - size * 0.075, size * 0.185 + dy, size * 0.055, size * 0.012, size * 0.006);
      roundRect(cx + size * 0.02, size * 0.185 + dy, size * 0.055, size * 0.012, size * 0.006);
      break;
    case "hair": {
      // top curve
      ctx.beginPath();
      ctx.arc(cx, size * 0.19 + dy, size * 0.15, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineTo(cx + size * 0.14, size * 0.24 + dy);
      ctx.lineTo(cx - size * 0.14, size * 0.24 + dy);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }

  // subtle direction glint on the face
  if (layer === "eyes" && direction !== "up") {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    const gx = direction === "side" ? cx + size * 0.058 : cx + size * 0.005;
    ctx.beginPath();
    ctx.arc(gx, size * 0.215 + dy, 0.7, 0, Math.PI * 2);
    ctx.arc(
      cx - size * 0.05 + (direction === "side" ? size * 0.008 : 0),
      size * 0.215 + dy,
      0.7,
      0,
      Math.PI * 2,
    );
    ctx.fill();
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
