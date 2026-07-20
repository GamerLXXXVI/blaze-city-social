import type { Direction, Facing } from "@/avatar/types";
import { isBlocked } from "./zones";

export interface Vec2 {
  x: number;
  y: number;
}

export const WALK_SPEED = 220; // px per second

export function stepToward(current: Vec2, target: Vec2, dt: number): Vec2 {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return target;
  const step = Math.min(dist, WALK_SPEED * dt);
  const nx = current.x + (dx / dist) * step;
  const ny = current.y + (dy / dist) * step;
  // Collision: try full move, then axis-separated slide, else stop.
  if (!isBlocked(nx, ny)) return { x: nx, y: ny };
  if (!isBlocked(nx, current.y)) return { x: nx, y: current.y };
  if (!isBlocked(current.x, ny)) return { x: current.x, y: ny };
  return current;
}

export function facingFromDelta(dx: number, dy: number): { direction: Direction; facing: Facing } {
  const octant = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  const directions: Record<number, Direction> = {
    [-4]: "west",
    [-3]: "north-west",
    [-2]: "north",
    [-1]: "north-east",
    0: "east",
    1: "south-east",
    2: "south",
    3: "south-west",
    4: "west",
  };
  return { direction: directions[octant], facing: dx < 0 ? "left" : "right" };
}
