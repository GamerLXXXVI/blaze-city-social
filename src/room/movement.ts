import type { Direction, Facing } from "@/avatar/types";

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
  return { x: current.x + (dx / dist) * step, y: current.y + (dy / dist) * step };
}

export function facingFromDelta(dx: number, dy: number): { direction: Direction; facing: Facing } {
  if (Math.abs(dx) > Math.abs(dy)) {
    return { direction: "side", facing: dx < 0 ? "left" : "right" };
  }
  return { direction: dy < 0 ? "up" : "down", facing: "right" };
}
