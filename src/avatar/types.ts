export type Gender = "male" | "female";
export type BodyType = "skinny" | "muscle" | "fat" | "supermodel" | "chubby";
export const DIRECTIONS = [
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
] as const;
export type Direction = (typeof DIRECTIONS)[number];
export type Facing = "left" | "right";
export type AnimState = "idle" | "walk" | "dance";
export type AvatarPreset = "blaze-original";

export function normalizeDirection(direction: string, facing: Facing = "right"): Direction {
  if (direction === "down") return "south";
  if (direction === "up") return "north";
  if (direction === "side") return facing === "left" ? "west" : "east";
  return DIRECTIONS.includes(direction as Direction) ? (direction as Direction) : "south";
}

export const MALE_BODY_TYPES: BodyType[] = ["skinny", "muscle", "fat"];
export const FEMALE_BODY_TYPES: BodyType[] = ["skinny", "supermodel", "chubby"];

export function bodyTypesFor(gender: Gender): BodyType[] {
  return gender === "male" ? MALE_BODY_TYPES : FEMALE_BODY_TYPES;
}

export const OPTIONS = {
  head_shape: ["hs01", "hs02", "hs03"],
  eyes: ["ey01", "ey02", "ey03", "ey04"],
  eyebrows: ["eb01", "eb02", "eb03"],
  mouth: ["mo01", "mo02", "mo03"],
  hair: ["ha01", "ha02", "ha03", "ha04"],
  shirt: ["sh01", "sh02", "sh03"],
  pants: ["pa01", "pa02", "pa03"],
} as const;

export type SlotId = keyof typeof OPTIONS;

export interface AvatarConfig {
  gender: Gender;
  body_type: BodyType;
  head_shape: string;
  eyes: string;
  eyebrows: string;
  mouth: string;
  hair: string;
  shirt: string;
  pants: string;
  preset?: AvatarPreset;
}

export function defaultAvatarConfig(): AvatarConfig {
  return {
    gender: "male",
    body_type: "skinny",
    head_shape: OPTIONS.head_shape[0],
    eyes: OPTIONS.eyes[0],
    eyebrows: OPTIONS.eyebrows[0],
    mouth: OPTIONS.mouth[0],
    hair: OPTIONS.hair[0],
    shirt: OPTIONS.shirt[0],
    pants: OPTIONS.pants[0],
    preset: "blaze-original",
  };
}

export function randomAvatarConfig(): AvatarConfig {
  const gender: Gender = Math.random() < 0.5 ? "male" : "female";
  const bts = bodyTypesFor(gender);
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  return {
    gender,
    body_type: pick(bts),
    head_shape: pick(OPTIONS.head_shape),
    eyes: pick(OPTIONS.eyes),
    eyebrows: pick(OPTIONS.eyebrows),
    mouth: pick(OPTIONS.mouth),
    hair: pick(OPTIONS.hair),
    shirt: pick(OPTIONS.shirt),
    pants: pick(OPTIONS.pants),
    preset: "blaze-original",
  };
}
