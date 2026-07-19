import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvatarSprite } from "./AvatarSprite";
import {
  OPTIONS,
  bodyTypesFor,
  defaultAvatarConfig,
  type AvatarConfig,
  type Direction,
  type Gender,
  type SlotId,
} from "./types";

interface Props {
  initial?: AvatarConfig;
  onSave: (cfg: AvatarConfig) => void;
  saving?: boolean;
}

const SLOTS: SlotId[] = ["head_shape", "mouth", "eyes", "eyebrows", "hair", "shirt", "pants"];
const SLOT_LABEL: Record<SlotId, string> = {
  head_shape: "Head shape",
  mouth: "Mouth",
  eyes: "Eyes",
  eyebrows: "Eyebrows",
  hair: "Hair",
  shirt: "Shirt",
  pants: "Pants",
};

function step(list: readonly string[], current: string, dir: 1 | -1): string {
  const i = list.indexOf(current);
  const n = list.length;
  return list[((i === -1 ? 0 : i) + dir + n) % n];
}

export function AvatarCreator({ initial, onSave, saving }: Props) {
  const [cfg, setCfg] = useState<AvatarConfig>(initial ?? defaultAvatarConfig());
  const [direction, setDirection] = useState<Direction>("down");
  const [walking, setWalking] = useState(false);

  const setGender = (g: Gender) => {
    const bts = bodyTypesFor(g);
    setCfg((c) => ({ ...c, gender: g, body_type: bts.includes(c.body_type) ? c.body_type : bts[0] }));
  };

  return (
    <div className="grid gap-8 md:grid-cols-[240px_1fr] items-start">
      <div className="hud-panel flex flex-col items-center gap-3 p-6">
        <div
          className="rounded-xl p-4"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, rgba(240,185,11,0.15), transparent 60%), #1B1712",
            boxShadow: "inset 0 0 40px rgba(0,0,0,0.55)",
          }}
        >
          <AvatarSprite
            config={cfg}
            direction={direction}
            state={walking ? "walk" : "idle"}
            size={192}
          />
        </div>
        <div className="flex gap-1">
          {(["down", "side", "up"] as Direction[]).map((d) => (
            <Button
              key={d}
              variant={direction === d ? "default" : "secondary"}
              size="sm"
              onClick={() => setDirection(d)}
            >
              {d}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setWalking((w) => !w)}>
          {walking ? "Stop" : "Walk"}
        </Button>
      </div>

      <div className="space-y-6">
        <StepperRow
          label="Gender"
          value={cfg.gender}
          options={["male", "female"]}
          onChange={(v) => setGender(v as Gender)}
        />
        <StepperRow
          label="Body type"
          value={cfg.body_type}
          options={bodyTypesFor(cfg.gender)}
          onChange={(v) => setCfg((c) => ({ ...c, body_type: v as AvatarConfig["body_type"] }))}
        />
        {SLOTS.map((slot) => (
          <StepperRow
            key={slot}
            label={SLOT_LABEL[slot]}
            value={cfg[slot]}
            options={OPTIONS[slot]}
            onChange={(v) => setCfg((c) => ({ ...c, [slot]: v }))}
          />
        ))}
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

function StepperRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="hud-panel flex items-center justify-between gap-4 px-4 py-3">
      <span className="font-mono-display text-[11px] text-muted-foreground uppercase tracking-[0.2em]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onChange(step(options, value, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="w-24 text-center font-mono-display text-sm text-primary/90">{value}</span>
        <Button variant="ghost" size="icon" onClick={() => onChange(step(options, value, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
