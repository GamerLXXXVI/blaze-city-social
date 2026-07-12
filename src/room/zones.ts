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
    rect: { x: 60, y: 100, w: 340, h: 200 },
    color: "var(--zone-bar)",
    border: "var(--zone-bar-border)",
  },
  {
    id: "dance",
    label: "Dance Floor",
    actionLabel: "Dance",
    rect: { x: 470, y: 220, w: 340, h: 300 },
    color: "var(--zone-dance)",
    border: "var(--zone-dance-border)",
  },
  {
    id: "games",
    label: "Games",
    actionLabel: "Play (coming soon)",
    comingSoon: true,
    rect: { x: 880, y: 100, w: 340, h: 240 },
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
