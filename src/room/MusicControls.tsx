import { Volume2, VolumeX } from "lucide-react";

interface Props {
  volume: number;
  muted: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
}

export function MusicControls({ volume, muted, onVolumeChange, onToggleMute }: Props) {
  return (
    <div className="hud-chip flex items-center gap-2 px-2.5 py-1">
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? "Unmute music" : "Mute music"}
        aria-pressed={muted}
        className="text-primary/90 hover:text-primary transition-colors"
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        aria-label="Music volume"
        className="w-20 accent-primary cursor-pointer"
      />
    </div>
  );
}