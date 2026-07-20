// Loads real avatar images from URLs; falls back to programmatic placeholders when the file 404s.
import { getPlaceholderImage } from "./placeholders";

const cache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement>>();
// Failures live in a separate short-TTL cache so a transient 404 (e.g. during
// deployment propagation) doesn't permanently pin the placeholder for the
// rest of the session. After the TTL elapses, the next request retries the
// real network fetch.
const FAILURE_TTL_MS = 5_000;
const failureCache = new Map<string, { image: HTMLImageElement; expiresAt: number }>();

export function loadAvatarImage(url: string): Promise<HTMLImageElement> {
  const c = cache.get(url);
  if (c) return Promise.resolve(c);
  const failed = failureCache.get(url);
  if (failed) {
    if (failed.expiresAt > Date.now()) return Promise.resolve(failed.image);
    failureCache.delete(url);
  }
  const inf = inflight.get(url);
  if (inf) return inf;
  const p = new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => {
      cache.set(url, img);
      inflight.delete(url);
      resolve(img);
    };
    img.onerror = async () => {
      const ph = await getPlaceholderImage(url);
      // Do NOT store the placeholder in the success cache — that poisons the
      // URL for the rest of the session. Keep failures in a separate cache
      // with a short TTL so subsequent calls retry the real image.
      failureCache.set(url, { image: ph, expiresAt: Date.now() + FAILURE_TTL_MS });
      inflight.delete(url);
      resolve(ph);
    };
    img.src = url;
  });
  inflight.set(url, p);
  return p;
}
