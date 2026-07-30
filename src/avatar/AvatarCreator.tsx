import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AvatarSprite } from "./AvatarSprite";
import { FemaleSelectorIdleSprite } from "./FemaleSelectorIdleSprite";
import {
  DIRECTIONS,
  defaultAvatarConfig,
  type AvatarConfig,
  type Direction,
  type Gender,
} from "./types";

interface Props {
  initial?: AvatarConfig;
  onSave: (cfg: AvatarConfig) => void;
  saving?: boolean;
}

const DIRECTION_LABEL: Record<Direction, string> = {
  south: "S",
  "south-east": "SE",
  east: "E",
  "north-east": "NE",
  north: "N",
  "north-west": "NW",
  west: "W",
  "south-west": "SW",
};

export function AvatarCreator({ initial, onSave, saving }: Props) {
  const [cfg, setCfg] = useState<AvatarConfig>({
    ...defaultAvatarConfig(),
    ...initial,
    gender: initial?.gender ?? "male",
    preset: "blaze-original",
  });
  const [direction, setDirection] = useState<Direction>("south");
  const [walking, setWalking] = useState(false);
  const [idleResetKey, setIdleResetKey] = useState(0);

  const chooseDirection = (d: Direction) => {
    setDirection(d);
    setIdleResetKey((key) => key + 1);
  };

  const toggleWalking = () => {
    setWalking((isWalking) => {
      if (isWalking) setIdleResetKey((key) => key + 1);
      return !isWalking;
    });
  };

  return (
    <div className="grid gap-8 md:grid-cols-[280px_1fr] items-start">
      <div className="hud-panel flex flex-col items-center gap-3 p-6">
        <div
          className="rounded-xl p-4"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(240,185,11,0.15), transparent 60%), #1B1712",
            boxShadow: "inset 0 0 40px rgba(0,0,0,0.55)",
          }}
        >
          <div className="flex h-48 w-48 items-center justify-center">
            {cfg.gender === "female" ? (
              <FemaleSelectorIdleSprite
                direction={direction}
                resetKey={idleResetKey}
                walking={walking}
              />
            ) : (
              <AvatarSprite
                config={cfg}
                direction={direction}
                state={walking ? "walk" : "idle"}
                size={192}
              />
            )}
          </div>
        </div>
        <div className="grid w-full grid-cols-4 gap-1">
          {DIRECTIONS.map((d) => (
            <Button
              key={d}
              variant={direction === d ? "default" : "secondary"}
              size="sm"
              title={d}
              aria-label={`Face ${d}`}
              onClick={() => chooseDirection(d)}
            >
              {DIRECTION_LABEL[d]}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={toggleWalking}>
          {walking ? "Stop" : "Walk"}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="hud-panel p-4">
          <p className="font-mono-display text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
            Gender
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["male", "female"] as Gender[]).map((g) => (
              <Button
                key={g}
                variant={cfg.gender === g ? "default" : "secondary"}
                size="sm"
                aria-pressed={cfg.gender === g}
                onClick={() => {
                  setCfg((c) => ({ ...c, gender: g }));
                  setIdleResetKey((key) => key + 1);
                }}
              >
                {g === "male" ? "Male" : "Female"}
              </Button>
            ))}
          </div>
        </div>
        <div className="hud-panel divide-y divide-border/50">
          <PresetDetail label="Character" value="Blaze Original" />
          <PresetDetail label="Gender" value={cfg.gender === "female" ? "Female" : "Male"} />
          <PresetDetail label="Style" value="Amber Night" />
          <PresetDetail label="Directions" value="8" />
          <PresetDetail label="Walk cycle" value="4 frames" />
        </div>
        <div className="pt-4">
          <Button
            size="lg"
            className="btn-ember hover:brightness-110"
            onClick={() => onSave(cfg)}
            disabled={saving}
          >
            {saving ? "Saving..." : "Enter Blaze City"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PresetDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4">
      <span className="font-mono-display text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
        {label}
      </span>
      <span className="font-mono-display text-sm text-primary/90">{value}</span>
    </div>
  );
}
