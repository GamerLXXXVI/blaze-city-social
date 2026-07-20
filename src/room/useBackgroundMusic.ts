import { useCallback, useEffect, useRef, useState } from "react";

const SRC = "/assets/audio/blaze-city-loop.mp3";
const CROSSFADE_SEC = 2;
const VOLUME_KEY = "blaze-city:music-volume";
const MUTE_KEY = "blaze-city:music-muted";
const DEFAULT_VOLUME = 0.45;

function readStoredVolume(): number {
  if (typeof window === "undefined") return DEFAULT_VOLUME;
  const raw = window.localStorage.getItem(VOLUME_KEY);
  if (raw == null) return DEFAULT_VOLUME;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULT_VOLUME;
}

function readStoredMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function useBackgroundMusic() {
  const [volume, setVolumeState] = useState<number>(() => readStoredVolume());
  const [muted, setMutedState] = useState<boolean>(() => readStoredMuted());
  const [started, setStarted] = useState(false);

  const aRef = useRef<HTMLAudioElement | null>(null);
  const bRef = useRef<HTMLAudioElement | null>(null);
  // per-element fade gain (0..1) that gets multiplied with master volume
  const fadeRef = useRef<{ a: number; b: number }>({ a: 1, b: 0 });
  const activeRef = useRef<"a" | "b">("a");
  const crossfadingRef = useRef(false);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);

  // create the two audio elements once
  useEffect(() => {
    const a = new Audio(SRC);
    const b = new Audio(SRC);
    for (const el of [a, b]) {
      el.preload = "auto";
      el.loop = false;
      el.crossOrigin = "anonymous";
    }
    aRef.current = a;
    bRef.current = b;
    return () => {
      a.pause();
      b.pause();
      aRef.current = null;
      bRef.current = null;
    };
  }, []);

  const applyVolumes = useCallback(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;
    const master = mutedRef.current ? 0 : volumeRef.current;
    a.volume = Math.min(1, Math.max(0, master * fadeRef.current.a));
    b.volume = Math.min(1, Math.max(0, master * fadeRef.current.b));
  }, []);

  useEffect(() => {
    volumeRef.current = volume;
    applyVolumes();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VOLUME_KEY, String(volume));
    }
  }, [volume, applyVolumes]);

  useEffect(() => {
    mutedRef.current = muted;
    applyVolumes();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    }
  }, [muted, applyVolumes]);

  // crossfade loop scheduler
  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;

    let raf = 0;
    let fadeStart = 0;
    let outgoing: HTMLAudioElement | null = null;
    let incoming: HTMLAudioElement | null = null;
    let outgoingKey: "a" | "b" = "a";
    let incomingKey: "a" | "b" = "b";

    const tick = () => {
      const active = activeRef.current === "a" ? a : b;
      const other = activeRef.current === "a" ? b : a;
      const dur = active.duration;

      if (!crossfadingRef.current) {
        if (
          Number.isFinite(dur) &&
          dur > CROSSFADE_SEC + 0.1 &&
          !active.paused &&
          dur - active.currentTime <= CROSSFADE_SEC
        ) {
          crossfadingRef.current = true;
          fadeStart = performance.now();
          outgoing = active;
          incoming = other;
          outgoingKey = activeRef.current;
          incomingKey = activeRef.current === "a" ? "b" : "a";
          incoming.currentTime = 0;
          fadeRef.current[incomingKey] = 0;
          applyVolumes();
          void incoming.play().catch(() => {});
        }
      } else if (outgoing && incoming) {
        const t = Math.min(1, (performance.now() - fadeStart) / (CROSSFADE_SEC * 1000));
        fadeRef.current[outgoingKey] = 1 - t;
        fadeRef.current[incomingKey] = t;
        applyVolumes();
        if (t >= 1) {
          outgoing.pause();
          outgoing.currentTime = 0;
          fadeRef.current[outgoingKey] = 0;
          fadeRef.current[incomingKey] = 1;
          activeRef.current = incomingKey;
          crossfadingRef.current = false;
          outgoing = null;
          incoming = null;
          applyVolumes();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [applyVolumes]);

  const start = useCallback(async () => {
    const a = aRef.current;
    if (!a || started) return started;
    fadeRef.current = { a: 1, b: 0 };
    activeRef.current = "a";
    applyVolumes();
    try {
      await a.play();
      setStarted(true);
      return true;
    } catch {
      return false;
    }
  }, [started, applyVolumes]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    // adjusting volume should implicitly unmute
    if (clamped > 0) setMutedState(false);
  }, []);

  const toggleMute = useCallback(() => setMutedState((m) => !m), []);

  return { volume, muted, started, start, setVolume, toggleMute };
}