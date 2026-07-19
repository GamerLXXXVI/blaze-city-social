import { useEffect, useRef } from "react";

/**
 * Ambient ember particles + burst on `spark-burst` custom events.
 * detail: { x?: number; y?: number; count?: number; hue?: "gold" | "violet" }
 */
export function EmberField() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const spawn = (xPct: number, yPct: number, hue: "gold" | "violet" = "gold") => {
      const el = document.createElement("span");
      el.className = "ember-spark";
      el.style.left = `${xPct}%`;
      el.style.top = `${yPct}%`;
      const dx = (Math.random() - 0.5) * 80;
      el.style.setProperty("--dx", `${dx}px`);
      const size = 3 + Math.random() * 6;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
      if (hue === "violet") {
        el.style.background =
          "radial-gradient(circle,#F5E7FF 0%,#C084FC 40%,#7C3AED 80%,transparent 100%)";
        el.style.filter = "blur(0.4px) drop-shadow(0 0 6px #A855F7)";
      }
      host.appendChild(el);
      window.setTimeout(() => el.remove(), 3500);
    };

    // ambient drift
    const amb = window.setInterval(() => {
      spawn(Math.random() * 100, 85 + Math.random() * 10);
    }, 900);

    const onBurst = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {};
      const count = d.count ?? 22;
      const x = d.x ?? 50;
      const y = d.y ?? 60;
      for (let i = 0; i < count; i++) {
        window.setTimeout(
          () => spawn(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 4, d.hue),
          i * 20,
        );
      }
    };
    window.addEventListener("spark-burst", onBurst);

    return () => {
      window.clearInterval(amb);
      window.removeEventListener("spark-burst", onBurst);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    />
  );
}