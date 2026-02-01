/**
 * ChladniBadge
 *
 * Tiny animated Chladni nodal-line pattern used as the app logo.
 * Matches the loading screen aesthetic — thin lines, muted palette cycling,
 * slow morphing. Renders on a 32×32 canvas with marching-squares contours.
 */

import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

const PI = Math.PI;
const cos = Math.cos;

// --- tunables ---------------------------------------------------------------
const GRID = 64; // lower than loader — readable at badge size
const LINE_W = 0.7; // thin, elegant
const MAX_ALPHA = 0.52; // subtle
const DURATION = 20.0; // slow morph
const FIELD_SC = 2.0; // domain [-1,1]
const MIN_FRAME_MS = 100; // ~10 fps — plenty for a 20s cycle

// --- DESIGN.md muted palette ------------------------------------------------
const PALETTE: [number, number, number][] = [
  [0x3f, 0x5c, 0x6e], // Oxide Blue
  [0x6f, 0x7f, 0x5c], // Moss Green
  [0xb8, 0x9b, 0x5e], // Desaturated Amber
  [0x8a, 0x5a, 0x3c], // Burnt Umber
  [0x8c, 0x4a, 0x4a], // Iron Red
];

// --- marching-squares lookup (same as loader) -------------------------------
const SEGS = [
  [],
  [[2, 3]],
  [[1, 2]],
  [[1, 3]],
  [[0, 1]],
  [
    [0, 1],
    [2, 3],
  ],
  [[0, 2]],
  [[0, 3]],
  [[0, 3]],
  [[0, 2]],
  [
    [0, 3],
    [1, 2],
  ],
  [[0, 1]],
  [[1, 3]],
  [[1, 2]],
  [[2, 3]],
  [],
];

function chladni(x: number, y: number, n: number, m: number) {
  return cos(n * PI * x) * cos(m * PI * y) - cos(m * PI * x) * cos(n * PI * y);
}

function lerpColor(t01: number) {
  const n = PALETTE.length;
  const pos = t01 * n;
  const i = Math.floor(pos) % n;
  const j = (i + 1) % n;
  const f = pos - Math.floor(pos);
  const s = f * f * (3 - 2 * f); // smoothstep
  const r = Math.round(PALETTE[i][0] + (PALETTE[j][0] - PALETTE[i][0]) * s);
  const g = Math.round(PALETTE[i][1] + (PALETTE[j][1] - PALETTE[i][1]) * s);
  const b = Math.round(PALETTE[i][2] + (PALETTE[j][2] - PALETTE[i][2]) * s);
  return `rgba(${r},${g},${b},${MAX_ALPHA})`;
}

export function ChladniBadge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = devicePixelRatio || 1;
    canvas.width = 32 * dpr;
    canvas.height = 32 * dpr;

    let rafId: number | null = null;
    let running = true;
    let t0: number | null = null;
    let lastFrame = 0;

    function evalField(t01: number) {
      const w = 0.5 - 0.5 * cos(2 * PI * t01);
      const inv = FIELD_SC / GRID;
      const half = FIELD_SC * 0.5;
      const buf = new Float64Array((GRID + 1) * (GRID + 1));

      for (let iy = 0; iy <= GRID; iy++) {
        for (let ix = 0; ix <= GRID; ix++) {
          const qx = ix * inv - half;
          const qy = iy * inv - half;
          // Lower modes than loader — legible at 32px
          const f =
            (1 - w) * chladni(qx, qy, 2, 5) +
            w * chladni(qx, qy, 3, 7) +
            0.4 * (w * chladni(qx, qy, 1, 6) + (1 - w) * chladni(qx, qy, 4, 2));
          buf[iy * (GRID + 1) + ix] = f;
        }
      }
      return buf;
    }

    function drawContours(field: Float64Array, t01: number) {
      const cw = canvas!.width;
      const scale = cw / GRID;
      const cols = GRID + 1;

      ctx!.clearRect(0, 0, cw, cw);
      ctx!.strokeStyle = lerpColor(t01);
      ctx!.lineWidth = LINE_W * dpr;
      ctx!.lineCap = 'round';
      ctx!.beginPath();

      for (let iy = 0; iy < GRID; iy++) {
        for (let ix = 0; ix < GRID; ix++) {
          const i00 = iy * cols + ix;
          const v00 = field[i00];
          const v10 = field[i00 + 1];
          const v01 = field[i00 + cols];
          const v11 = field[i00 + cols + 1];

          const idx =
            (v00 > 0 ? 8 : 0) |
            (v10 > 0 ? 4 : 0) |
            (v11 > 0 ? 2 : 0) |
            (v01 > 0 ? 1 : 0);

          if (idx === 0 || idx === 15) continue;

          const lerp = (a: number, b: number) => a / (a - b);

          const ex = [ix + lerp(v00, v10), ix + 1, ix + lerp(v01, v11), ix];
          const ey = [iy, iy + lerp(v10, v11), iy + 1, iy + lerp(v00, v01)];

          const pairs = SEGS[idx];
          for (let p = 0; p < pairs.length; p++) {
            const a = pairs[p][0];
            const b = pairs[p][1];
            ctx!.moveTo(ex[a] * scale, ey[a] * scale);
            ctx!.lineTo(ex[b] * scale, ey[b] * scale);
          }
        }
      }
      ctx!.stroke();
    }

    function frame(now: number) {
      if (!running) return;
      if (now - lastFrame < MIN_FRAME_MS) {
        rafId = requestAnimationFrame(frame);
        return;
      }
      lastFrame = now;
      if (t0 === null) t0 = now;

      const elapsed = (now - t0) / 1000;
      const t01 = (elapsed % DURATION) / DURATION;

      drawContours(evalField(t01), t01);
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    function onVisibility() {
      if (document.hidden) {
        running = false;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else {
        running = true;
        t0 = null;
        rafId = requestAnimationFrame(frame);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <Link
      to="/"
      className="block w-8 h-8 rounded-lg overflow-hidden hover:opacity-75 transition-opacity"
      title="Home"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ background: 'var(--ws-bg, #F5F2ED)' }}
      />
    </Link>
  );
}
