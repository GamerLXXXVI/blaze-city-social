import { useEffect, useRef, useState, useCallback } from "react";

const W = 800;
const H = 600;
const HS_KEY = "blaze-blaster.highscore";
// NOTE: high score persisted in localStorage under HS_KEY — swap for backend leaderboard later.

type Vec = { x: number; y: number };
interface Ship {
  pos: Vec;
  vel: Vec;
  angle: number; // radians, 0 = up
  invincibleUntil: number;
  alive: boolean;
}
interface Bullet {
  pos: Vec;
  vel: Vec;
  life: number;
}
interface Asteroid {
  pos: Vec;
  vel: Vec;
  size: 3 | 2 | 1; // 3=large, 2=medium, 1=small
  radius: number;
  angle: number;
  spin: number;
  shape: number[]; // radius offsets per vertex
}

type Phase = "playing" | "gameover";

const SIZE_RADIUS: Record<1 | 2 | 3, number> = { 3: 42, 2: 22, 1: 12 };
const SIZE_SCORE: Record<1 | 2 | 3, number> = { 3: 20, 2: 50, 1: 100 };
const SHIP_RADIUS = 10;
const THRUST = 220; // px/s^2
const FRICTION = 0.6; // per second (mild drag so it "drifts")
const ROT_SPEED = 3.6; // rad/s
const BULLET_SPEED = 460;
const BULLET_LIFE = 1.1;
const FIRE_COOLDOWN = 0.22;
const RESPAWN_INVINCIBLE = 2.5;

function wrap(v: number, max: number) {
  if (v < 0) return v + max;
  if (v >= max) return v - max;
  return v;
}

function randShape(verts: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < verts; i++) out.push(0.72 + Math.random() * 0.5);
  return out;
}

function makeAsteroid(size: 1 | 2 | 3, pos: Vec, speedBoost = 0): Asteroid {
  const angle = Math.random() * Math.PI * 2;
  const speed = 30 + Math.random() * 50 + speedBoost;
  const verts = size === 3 ? 12 : size === 2 ? 10 : 8;
  return {
    pos,
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    size,
    radius: SIZE_RADIUS[size],
    angle: 0,
    spin: (Math.random() - 0.5) * 1.2,
    shape: randShape(verts),
  };
}

function spawnWave(n: number, shipPos: Vec): Asteroid[] {
  const out: Asteroid[] = [];
  for (let i = 0; i < n; i++) {
    // Spawn on a random edge, far from ship.
    let pos: Vec;
    let tries = 0;
    do {
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) pos = { x: Math.random() * W, y: 0 };
      else if (edge === 1) pos = { x: W, y: Math.random() * H };
      else if (edge === 2) pos = { x: Math.random() * W, y: H };
      else pos = { x: 0, y: Math.random() * H };
      tries++;
    } while (
      Math.hypot(pos.x - shipPos.x, pos.y - shipPos.y) < 160 &&
      tries < 10
    );
    out.push(makeAsteroid(3, pos));
  }
  return out;
}

// ---- Audio: synthesized short effects via WebAudio ----
class SFX {
  ctx: AudioContext | null = null;
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    return this.ctx;
  }
  beep(freq: number, dur: number, type: OscillatorType = "square", vol = 0.12) {
    const ctx = this.ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }
  noise(dur: number, vol = 0.18) {
    const ctx = this.ensure();
    if (!ctx) return;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(ctx.destination);
    src.start();
  }
  shoot() { this.beep(880, 0.08, "square", 0.08); }
  explode() { this.noise(0.28, 0.18); }
  shipHit() { this.noise(0.5, 0.24); this.beep(120, 0.4, "sawtooth", 0.12); }
  gameOver() {
    this.beep(440, 0.18, "square", 0.12);
    setTimeout(() => this.beep(330, 0.18, "square", 0.12), 180);
    setTimeout(() => this.beep(220, 0.32, "square", 0.12), 360);
  }
}

export function BlazeBlaster({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [phase, setPhase] = useState<Phase>("playing");
  const [isTouch, setIsTouch] = useState(false);
  const onExitRef = useRef(onExit);
  useEffect(() => { onExitRef.current = onExit; }, [onExit]);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);
  const [highScore, setHighScore] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const raw = window.localStorage.getItem(HS_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  });

  // Refs for game state (mutable, not re-rendered)
  const shipRef = useRef<Ship>({
    pos: { x: W / 2, y: H / 2 },
    vel: { x: 0, y: 0 },
    angle: -Math.PI / 2,
    invincibleUntil: 0,
    alive: true,
  });
  const bulletsRef = useRef<Bullet[]>([]);
  const asteroidsRef = useRef<Asteroid[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const fireCdRef = useRef(0);
  const waveRef = useRef(1);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const phaseRef = useRef<Phase>("playing");
  const runIdRef = useRef(0);
  const sfxRef = useRef<SFX>(new SFX());
  // Gamepad: track prior Start button state for edge-triggered exit
  const prevStartRef = useRef(false);

  const startRun = useCallback(() => {
    runIdRef.current++;
    scoreRef.current = 0;
    livesRef.current = 3;
    waveRef.current = 1;
    fireCdRef.current = 0;
    setScore(0);
    setLives(3);
    setPhase("playing");
    phaseRef.current = "playing";
    shipRef.current = {
      pos: { x: W / 2, y: H / 2 },
      vel: { x: 0, y: 0 },
      angle: -Math.PI / 2,
      invincibleUntil: performance.now() / 1000 + RESPAWN_INVINCIBLE,
      alive: true,
    };
    bulletsRef.current = [];
    asteroidsRef.current = spawnWave(4, shipRef.current.pos);
  }, []);

  // Init on mount
  useEffect(() => {
    startRun();
  }, [startRun]);

  // Keyboard
  useEffect(() => {
    const isGameKey = (k: string) =>
      k === "ArrowLeft" ||
      k === "ArrowRight" ||
      k === "ArrowUp" ||
      k === " " ||
      k === "Spacebar";
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
        return;
      }
      if (isGameKey(e.key)) {
        e.preventDefault();
        keysRef.current[e.key === "Spacebar" ? " " : e.key] = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (isGameKey(e.key)) {
        e.preventDefault();
        keysRef.current[e.key === "Spacebar" ? " " : e.key] = false;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onExit]);

  // Gamepad polling — runs alongside the main loop, feeds keysRef
  useEffect(() => {
    let raf = 0;
    const DEAD = 0.25;
    const poll = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp: Gamepad | null = null;
      for (const p of pads) {
        if (p && p.connected) { gp = p; break; }
      }
      if (gp) {
        const keys = keysRef.current;
        const axisX = gp.axes[0] ?? 0;
        const dpadL = gp.buttons[14]?.pressed ?? false;
        const dpadR = gp.buttons[15]?.pressed ?? false;
        keys["ArrowLeft"] = dpadL || axisX < -DEAD;
        keys["ArrowRight"] = dpadR || axisX > DEAD;
        keys["ArrowUp"] =
          (gp.buttons[0]?.pressed ?? false) ||
          (gp.buttons[7]?.pressed ?? false) ||
          (gp.buttons[7]?.value ?? 0) > 0.3;
        keys[" "] =
          (gp.buttons[2]?.pressed ?? false) ||
          (gp.buttons[5]?.pressed ?? false);
        const start = gp.buttons[9]?.pressed ?? false;
        if (start && !prevStartRef.current) onExitRef.current();
        prevStartRef.current = start;
      } else {
        prevStartRef.current = false;
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();

    const respawnShip = () => {
      const s = shipRef.current;
      s.pos = { x: W / 2, y: H / 2 };
      s.vel = { x: 0, y: 0 };
      s.angle = -Math.PI / 2;
      s.invincibleUntil = performance.now() / 1000 + RESPAWN_INVINCIBLE;
      s.alive = true;
    };

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (phaseRef.current === "playing") {
        const keys = keysRef.current;
        const s = shipRef.current;

        // Rotation
        if (keys["ArrowLeft"]) s.angle -= ROT_SPEED * dt;
        if (keys["ArrowRight"]) s.angle += ROT_SPEED * dt;

        // Thrust
        if (keys["ArrowUp"] && s.alive) {
          s.vel.x += Math.cos(s.angle) * THRUST * dt;
          s.vel.y += Math.sin(s.angle) * THRUST * dt;
        }
        // Friction
        const drag = Math.pow(1 - FRICTION, dt);
        s.vel.x *= drag;
        s.vel.y *= drag;

        // Move ship
        s.pos.x = wrap(s.pos.x + s.vel.x * dt, W);
        s.pos.y = wrap(s.pos.y + s.vel.y * dt, H);

        // Fire
        fireCdRef.current -= dt;
        if (keys[" "] && fireCdRef.current <= 0 && s.alive) {
          fireCdRef.current = FIRE_COOLDOWN;
          bulletsRef.current.push({
            pos: {
              x: s.pos.x + Math.cos(s.angle) * SHIP_RADIUS,
              y: s.pos.y + Math.sin(s.angle) * SHIP_RADIUS,
            },
            vel: {
              x: Math.cos(s.angle) * BULLET_SPEED + s.vel.x,
              y: Math.sin(s.angle) * BULLET_SPEED + s.vel.y,
            },
            life: BULLET_LIFE,
          });
          sfxRef.current.shoot();
        }

        // Update bullets
        bulletsRef.current = bulletsRef.current.filter((b) => {
          b.life -= dt;
          b.pos.x = wrap(b.pos.x + b.vel.x * dt, W);
          b.pos.y = wrap(b.pos.y + b.vel.y * dt, H);
          return b.life > 0;
        });

        // Update asteroids
        for (const a of asteroidsRef.current) {
          a.pos.x = wrap(a.pos.x + a.vel.x * dt, W);
          a.pos.y = wrap(a.pos.y + a.vel.y * dt, H);
          a.angle += a.spin * dt;
        }

        // Bullet ↔ asteroid collisions
        const nextAsteroids: Asteroid[] = [];
        const consumedBullets = new Set<number>();
        for (const a of asteroidsRef.current) {
          let hit = false;
          for (let bi = 0; bi < bulletsRef.current.length; bi++) {
            if (consumedBullets.has(bi)) continue;
            const b = bulletsRef.current[bi];
            if (Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y) < a.radius) {
              hit = true;
              consumedBullets.add(bi);
              scoreRef.current += SIZE_SCORE[a.size];
              setScore(scoreRef.current);
              sfxRef.current.explode();
              if (a.size > 1) {
                const childSize = (a.size - 1) as 1 | 2;
                for (let k = 0; k < 2; k++) {
                  nextAsteroids.push(makeAsteroid(childSize, { x: a.pos.x, y: a.pos.y }, 30));
                }
              }
              break;
            }
          }
          if (!hit) nextAsteroids.push(a);
        }
        bulletsRef.current = bulletsRef.current.filter((_, i) => !consumedBullets.has(i));
        asteroidsRef.current = nextAsteroids;

        // Ship ↔ asteroid collisions
        const nowSec = performance.now() / 1000;
        if (s.alive && nowSec > s.invincibleUntil) {
          for (const a of asteroidsRef.current) {
            if (Math.hypot(s.pos.x - a.pos.x, s.pos.y - a.pos.y) < a.radius + SHIP_RADIUS - 2) {
              s.alive = false;
              livesRef.current -= 1;
              setLives(livesRef.current);
              sfxRef.current.shipHit();
              if (livesRef.current <= 0) {
                phaseRef.current = "gameover";
                setPhase("gameover");
                sfxRef.current.gameOver();
                setHighScore((prev) => {
                  const next = Math.max(prev, scoreRef.current);
                  if (next !== prev) {
                    try {
                      window.localStorage.setItem(HS_KEY, String(next));
                    } catch {
                      /* ignore */
                    }
                  }
                  return next;
                });
              } else {
                setTimeout(() => {
                  if (phaseRef.current === "playing") respawnShip();
                }, 700);
              }
              break;
            }
          }
        }

        // Next wave
        if (asteroidsRef.current.length === 0) {
          waveRef.current += 1;
          asteroidsRef.current = spawnWave(3 + waveRef.current, s.pos);
        }
      }

      // Render
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, W, H);
      // Subtle starfield
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97) % W;
        const sy = (i * 53) % H;
        ctx.fillRect(sx, sy, 1, 1);
      }

      // Asteroids
      ctx.strokeStyle = "#e6e6e6";
      ctx.lineWidth = 1.5;
      for (const a of asteroidsRef.current) {
        ctx.beginPath();
        const verts = a.shape.length;
        for (let i = 0; i < verts; i++) {
          const ang = (i / verts) * Math.PI * 2 + a.angle;
          const r = a.radius * a.shape[i];
          const x = a.pos.x + Math.cos(ang) * r;
          const y = a.pos.y + Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // Bullets
      ctx.fillStyle = "#F0B90B";
      for (const b of bulletsRef.current) {
        ctx.fillRect(b.pos.x - 1.5, b.pos.y - 1.5, 3, 3);
      }

      // Ship
      const s = shipRef.current;
      if (s.alive) {
        const flashOn = performance.now() / 1000 < s.invincibleUntil;
        const blink = flashOn ? Math.floor(performance.now() / 100) % 2 === 0 : false;
        if (!blink) {
          ctx.save();
          ctx.translate(s.pos.x, s.pos.y);
          ctx.rotate(s.angle);
          ctx.strokeStyle = "#F0B90B";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(-9, 8);
          ctx.lineTo(-5, 0);
          ctx.lineTo(-9, -8);
          ctx.closePath();
          ctx.stroke();
          // Thrust flame
          if (keysRef.current["ArrowUp"] && Math.random() > 0.3) {
            ctx.strokeStyle = "#C2410C";
            ctx.beginPath();
            ctx.moveTo(-5, 3);
            ctx.lineTo(-13 - Math.random() * 4, 0);
            ctx.lineTo(-5, -3);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Blaze Blaster"
    >
      <div className="relative">
        <div className="mb-2 flex items-center justify-between gap-4 text-xs font-mono uppercase tracking-[0.25em] text-primary/80">
          <span>Blaze Blaster</span>
          <button
            onClick={onExit}
            aria-label="Exit game"
            className="rounded border border-white/20 px-2 py-0.5 text-white/80 hover:bg-white/10"
          >
            × Exit (Esc)
          </button>
        </div>
        <div className="relative rounded border border-white/15 overflow-hidden shadow-[0_20px_80px_-20px_rgba(0,0,0,0.9)]">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block"
            style={{ imageRendering: "pixelated" }}
          />
          {/* HUD */}
          <div className="pointer-events-none absolute left-3 top-2 font-mono text-xs text-white/85">
            <div>SCORE {score.toString().padStart(5, "0")}</div>
            <div>LIVES {"▲".repeat(Math.max(0, lives))}</div>
          </div>
          <div className="pointer-events-none absolute right-3 top-2 font-mono text-xs text-white/60">
            HI {Math.max(highScore, score).toString().padStart(5, "0")}
          </div>

          {phase === "gameover" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70">
              <div className="font-mono text-2xl uppercase tracking-[0.3em] text-primary">
                Game Over
              </div>
              <div className="text-center text-white/90 font-mono text-sm">
                <div>Final Score: {score}</div>
                <div>High Score: {Math.max(highScore, score)}</div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={startRun}
                  className="rounded border border-primary/70 bg-primary/20 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-primary hover:bg-primary/30"
                >
                  Play Again
                </button>
                <button
                  onClick={onExit}
                  className="rounded border border-white/25 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-white/80 hover:bg-white/10"
                >
                  Exit
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">
          ← → rotate · ↑ thrust · space fire · esc exit — touch & gamepad supported
        </div>
        {isTouch && phase === "playing" && (
          <TouchControls keysRef={keysRef} onExit={onExit} />
        )}
      </div>
    </div>
  );
}

function TouchControls({
  keysRef,
  onExit,
}: {
  keysRef: React.MutableRefObject<Record<string, boolean>>;
  onExit: () => void;
}) {
  const bind = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      keysRef.current[key] = true;
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      keysRef.current[key] = false;
    },
    onPointerCancel: () => {
      keysRef.current[key] = false;
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if ((e.buttons & 1) === 0) keysRef.current[key] = false;
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const btn =
    "select-none touch-none flex items-center justify-center rounded-full border border-white/30 bg-black/40 backdrop-blur-sm text-white/90 font-mono text-lg active:bg-primary/40 active:border-primary/70";
  return (
    <>
      {/* Exit — top-right */}
      <button
        type="button"
        onClick={onExit}
        aria-label="Exit game"
        className="absolute right-2 top-8 z-10 h-10 w-10 rounded-full border border-white/30 bg-black/50 text-white text-xl leading-none flex items-center justify-center active:bg-white/20"
      >
        ×
      </button>
      {/* Rotate cluster — bottom-left */}
      <div className="absolute left-3 bottom-4 z-10 flex gap-3">
        <button type="button" aria-label="Rotate left" className={`${btn} h-16 w-16`} {...bind("ArrowLeft")}>◀</button>
        <button type="button" aria-label="Rotate right" className={`${btn} h-16 w-16`} {...bind("ArrowRight")}>▶</button>
      </div>
      {/* Thrust + Fire — bottom-right */}
      <div className="absolute right-3 bottom-4 z-10 flex gap-3">
        <button type="button" aria-label="Thrust" className={`${btn} h-16 w-16`} {...bind("ArrowUp")}>▲</button>
        <button type="button" aria-label="Fire" className={`${btn} h-16 w-16 text-sm`} {...bind(" ")}>FIRE</button>
      </div>
    </>
  );
}