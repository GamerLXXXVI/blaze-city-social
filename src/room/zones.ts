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
    // Widened east to x=440 to cover the walking corridor between the
    // left bar counter and the staff-area collision buffer. The staff
    // boundary's expanded east edge sits at x≈373 (inside the dance zone
    // rect), so a player walking from the dance floor toward the bar
    // gets parked at ~x=373, visually against the counter but with the
    // foot anchor east of the old bar rect — that's why "Dance" kept
    // showing at the bar. bar is first in ZONES, so this strip takes
    // priority over the overlapping dance rect.
    rect: { x: 60, y: 60, w: 380, h: 300 },
    color: "var(--zone-bar)",
    border: "var(--zone-bar-border)",
  },
  {
    id: "dance",
    label: "Dance Floor",
    actionLabel: "Dance",
    // Shrunk on both sides so it no longer overlaps the bar rect
    // (x:60..440) or the games rect (x:900..1232). Previously the
    // dance rect ran x:348..1048, overlapping bar by 92px on the west
    // and, more importantly, covering the 900..1056 strip in front of
    // the arcade cabinets — a player standing at the leftmost cabinet
    // was inside dance's x-range and outside games's, so zoneAt()
    // returned "dance" and the HUD showed "Dance" at the arcade. New
    // rect x:440..900 is exactly bounded by its two neighbors.
    rect: { x: 440, y: 44, w: 460, h: 440 },
    color: "var(--zone-dance)",
    border: "var(--zone-dance-border)",
  },
  {
    id: "games",
    label: "Games",
    actionLabel: "Insert Coin",
    // West edge pulled to x:900 to match the arcade cabinet + approach
    // blocker's west edge. The 900..1056 strip is reachable floor
    // directly in front of the leftmost cabinet; keeping games's west
    // edge at 1056 left that strip inside the dance rect, so "Dance"
    // showed at the arcade. South edge stays at y=520 to cover the
    // approach corridor between cabinets and speakers.
    rect: { x: 900, y: 60, w: 332, h: 460 },
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

  // Bar counter cluster (upper-left L-shape).
  // Expanded outward from the original {56 tall / 56 wide} runs because
  // PLAYER_SPRITE_SCALE grew from 1.75 → 2.4 (sprite box ≈ 230 world px
  // tall/wide, visible body ≈ 137 tall × ~55 wide). A blocker sized to the
  // counter art alone let the sprite's torso overlap the counter surface
  // even though the collision point stopped correctly. These now cover
  // the full counter body (top run: y=24..194; left run: x=24..194) so
  // the character's visible body clears the counter edge on approach.
  { x: 24, y: 24, w: 340, h: 170 }, // top counter run
  { x: 24, y: 24, w: 170, h: 260 }, // left counter run

  // Arcade cabinets (upper-right)
  { x: 900, y: 24, w: 356, h: 140 },

  // Arcade approach boundary — invisible blocker just south of the cabinets.
  // The cabinet blocker above (south edge y=164) stops the player's foot
  // anchor at that line, but the ~137px-tall visible body at
  // PLAYER_SPRITE_SCALE = 2.4 then overlaps the cabinet art. This new
  // boundary (same footprint, ~140px tall) pushes the natural stopping
  // point down to ~y=305, matching where a player visually lands when
  // approaching the machines. Stopping point stays inside the games zone
  // rect (x:1056..1232, y:60..340) so the "Insert Coin" action still
  // triggers from the approach position.
  { x: 900, y: 164, w: 356, h: 140 },

  // Right-side cabinets / speakers below the arcade
  { x: 1120, y: 260, w: 136, h: 220 },

  // DJ booth / speaker stack on lower-right of dance floor
  { x: 1040, y: 500, w: 200, h: 90 },

  // Staff area boundary behind the bar — stepped path traced from art,
  // then thickened outward (into the customer side) so the player's
  // ~137px-tall visible body no longer overlaps the counter face when
  // pressed against it. Same scale-vs-margin correction as the counter
  // cluster above; each segment is expanded ~60 world px away from the
  // staff side (east for verticals, south for horizontals).
  { x: 362, y: 176, w: 70, h: 55 }, // top vertical (expanded east)
  { x: 206, y: 226, w: 167, h: 70 }, // horizontal connector (expanded south)
  { x: 205, y: 231, w: 70, h: 370 }, // long vertical run (expanded east)
  { x: 64, y: 603, w: 147, h: 70 }, // bottom horizontal (expanded south)
];

export function isBlocked(x: number, y: number): boolean {
  for (const b of BLOCKERS) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}
