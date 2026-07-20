export interface Zone {
  id: "bar" | "dance" | "games";
  label: string;
  actionLabel: string;
  comingSoon?: boolean;
  rect: { x: number; y: number; w: number; h: number };
  color: string;
  border: string;
}

export const ROOM_WIDTH = 1280;
export const ROOM_HEIGHT = 720;

export const ZONES: Zone[] = [
  {
    id: "bar",
    label: "Bar",
    actionLabel: "Grab a drink",
    rect: { x: 60, y: 60, w: 280, h: 280 },
    color: "var(--zone-bar)",
    border: "var(--zone-bar-border)",
  },
  {
    id: "dance",
    label: "Dance Floor",
    actionLabel: "Dance",
    rect: { x: 348, y: 44, w: 700, h: 440 },
    color: "var(--zone-dance)",
    border: "var(--zone-dance-border)",
  },
  {
    id: "games",
    label: "Games",
    actionLabel: "Play (coming soon)",
    comingSoon: true,
    rect: { x: 1056, y: 60, w: 176, h: 280 },
    color: "var(--zone-games)",
    border: "var(--zone-games-border)",
  },
];

export function zoneAt(x: number, y: number): Zone | null {
  for (const z of ZONES) {
    const { x: zx, y: zy, w, h } = z.rect;
    if (x >= zx && x <= zx + w && y >= zy && y <= zy + h) return z;
  }
  return null;
}

/** Static collision blockers (walls + furniture). Point-in-rect test against avatar's stored (x,y). */
export interface Blocker {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BLOCKERS: Blocker[] = [
  // Exterior perimeter (thin) — bottom has a gap for the entrance doors
  { x: 0, y: 0, w: ROOM_WIDTH, h: 24 }, // top wall
  { x: 0, y: 0, w: 24, h: ROOM_HEIGHT }, // left wall
  { x: ROOM_WIDTH - 24, y: 0, w: 24, h: ROOM_HEIGHT }, // right wall
  { x: 0, y: ROOM_HEIGHT - 24, w: 540, h: 24 }, // bottom-left wall
  { x: 740, y: ROOM_HEIGHT - 24, w: ROOM_WIDTH - 740, h: 24 }, // bottom-right wall

  // Bar counter cluster (upper-left L-shape)
  { x: 24, y: 24, w: 340, h: 56 }, // top counter run
  { x: 24, y: 24, w: 56, h: 260 }, // left counter run

  // Arcade cabinets (upper-right)
  { x: 900, y: 24, w: 356, h: 140 },

  // Right-side cabinets / speakers below the arcade
  { x: 1120, y: 260, w: 136, h: 220 },

  // DJ booth / speaker stack on lower-right of dance floor
  { x: 1040, y: 500, w: 200, h: 90 },
];

export function isBlocked(x: number, y: number): boolean {
  for (const b of BLOCKERS) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}
