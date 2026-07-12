// Loads real avatar images from URLs; falls back to programmatic placeholders when the file 404s.
import { getPlaceholderImage } from "./placeholders";

const cache = new Map<string, HTMLImageElement>();
const inflight = new Map<string, Promise<HTMLImageElement>>();

export function loadAvatarImage(url: string): Promise<HTMLImageElement> {
  const c = cache.get(url);
  if (c) return Promise.resolve(c);
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
      cache.set(url, ph);
      inflight.delete(url);
      resolve(ph);
    };
    img.src = url;
  });
  inflight.set(url, p);
  return p;
}
