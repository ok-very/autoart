// Cymatic loading screen — Chladni nodal-line contours, seamless tiling
// Pure ES module, zero dependencies. Reads --ws-bg from :root.
// Pattern is square, centered, and cycles through DESIGN.md muted tones.

(function boot() {
  const canvas = document.getElementById('cymatic-loader');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // --- tunables ---------------------------------------------------------
  const GRID       = 150;   // field sample resolution
  const LINE_W     = 2.0;   // CSS-px stroke width
  const FIELD_SC   = 2.0;   // field scale — domain [-1,1] for proper plate modes
  const MAX_ALPHA  = 0.65;  // peak line opacity
  const DURATION   = 8.0;   // loop period (seconds)
  const SIZE_FRAC  = 0.82;  // pattern fills most of the tile

  // --- DESIGN.md muted palette ------------------------------------------
  const PALETTE = [
    [0x3F, 0x5C, 0x6E],  // Oxide Blue
    [0x6F, 0x7F, 0x5C],  // Moss Green
    [0xB8, 0x9B, 0x5E],  // Desaturated Amber
    [0x8A, 0x5A, 0x3C],  // Burnt Umber
    [0x8C, 0x4A, 0x4A],  // Iron Red
  ];

  // --- marching-squares lookup table (hoisted — constant) ---------------
  const SEGS = [
    [],           // 0
    [[2, 3]],     // 1
    [[1, 2]],     // 2
    [[1, 3]],     // 3
    [[0, 1]],     // 4
    [[0, 1], [2, 3]], // 5 (saddle)
    [[0, 2]],     // 6
    [[0, 3]],     // 7
    [[0, 3]],     // 8
    [[0, 2]],     // 9
    [[0, 3], [1, 2]], // 10 (saddle)
    [[0, 1]],     // 11
    [[1, 3]],     // 12
    [[1, 2]],     // 13
    [[2, 3]],     // 14
    [],           // 15
  ];

  // --- colour -----------------------------------------------------------
  function resolveColor(prop, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
    return v || fallback;
  }

  let bg;
  function refreshColors() {
    bg = resolveColor('--ws-bg', '#F5F2ED');
    canvas.style.background = bg;
  }
  refreshColors();

  // Smooth interpolation through the muted palette
  function lerpColor(t01) {
    const n = PALETTE.length;
    const pos = t01 * n;
    const i = Math.floor(pos) % n;
    const j = (i + 1) % n;
    const f = pos - Math.floor(pos);
    // smoothstep for gentle transitions
    const s = f * f * (3 - 2 * f);
    const r = Math.round(PALETTE[i][0] + (PALETTE[j][0] - PALETTE[i][0]) * s);
    const g = Math.round(PALETTE[i][1] + (PALETTE[j][1] - PALETTE[i][1]) * s);
    const b = Math.round(PALETTE[i][2] + (PALETTE[j][2] - PALETTE[i][2]) * s);
    return `rgba(${r},${g},${b},${MAX_ALPHA})`;
  }

  // --- sizing -----------------------------------------------------------
  let W, H, dpr;

  function resize() {
    dpr = devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
  }
  resize();

  let ro;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(resize);
    ro.observe(canvas);
  } else {
    ro = { disconnect() {} };
  }

  // --- Chladni field (wider frequency breadth: modes 1–13) --------------
  const PI = Math.PI;
  const cos = Math.cos;

  function chladni(x, y, n, m) {
    return cos(n * PI * x) * cos(m * PI * y) - cos(m * PI * x) * cos(n * PI * y);
  }

  // Evaluate field on grid, return Float64Array
  function evalField(t01) {
    const w = 0.5 - 0.5 * cos(2 * PI * t01);
    const inv = FIELD_SC / GRID;
    const half = FIELD_SC * 0.5;
    const buf = new Float64Array((GRID + 1) * (GRID + 1));

    for (let iy = 0; iy <= GRID; iy++) {
      for (let ix = 0; ix <= GRID; ix++) {
        const qx = ix * inv - half;
        const qy = iy * inv - half;
        const f =
          (1 - w) * chladni(qx, qy, 2, 7)  +
          w       * chladni(qx, qy, 5, 11)  +
          0.45 * (w * chladni(qx, qy, 1, 9) + (1 - w) * chladni(qx, qy, 7, 3)) +
          0.25 * chladni(qx, qy, 3, 13);
        buf[iy * (GRID + 1) + ix] = f;
      }
    }
    return buf;
  }

  // --- marching squares → line segments (uniform scale, centered) -------
  // Returns flat array [x1,y1,x2,y2, x1,y1,x2,y2, ...]
  function marchContours(field) {
    const segs = [];
    const cols = GRID + 1;
    // Uniform scale keeps the pattern square regardless of viewport
    const dim = Math.min(canvas.width, canvas.height) * SIZE_FRAC;
    const scale = dim / GRID;
    const ox = (canvas.width - dim) * 0.5;
    const oy = (canvas.height - dim) * 0.5;

    for (let iy = 0; iy < GRID; iy++) {
      for (let ix = 0; ix < GRID; ix++) {
        const i00 = iy * cols + ix;
        const v00 = field[i00];
        const v10 = field[i00 + 1];
        const v01 = field[i00 + cols];
        const v11 = field[i00 + cols + 1];

        // sign bits → cell index 0-15
        const idx =
          (v00 > 0 ? 8 : 0) |
          (v10 > 0 ? 4 : 0) |
          (v11 > 0 ? 2 : 0) |
          (v01 > 0 ? 1 : 0);

        if (idx === 0 || idx === 15) continue; // fully inside or outside

        // interpolation helpers (0 → ix, 1 → ix+1 etc.)
        const lerp = (a, b) => a / (a - b); // fraction from a-side toward b-side

        // Edge midpoints: top(0), right(1), bottom(2), left(3)
        const ex = [
          ix + lerp(v00, v10), // top    edge
          ix + 1,              // right  edge (x)
          ix + lerp(v01, v11), // bottom edge
          ix,                  // left   edge (x)
        ];
        const ey = [
          iy,                  // top    edge
          iy + lerp(v10, v11), // right  edge
          iy + 1,              // bottom edge
          iy + lerp(v00, v01), // left   edge
        ];

        const pairs = SEGS[idx];
        for (let p = 0; p < pairs.length; p++) {
          const a = pairs[p][0];
          const b = pairs[p][1];
          segs.push(
            ox + ex[a] * scale,
            oy + ey[a] * scale,
            ox + ex[b] * scale,
            oy + ey[b] * scale,
          );
        }
      }
    }
    return segs;
  }

  // --- build Path2D from segments ---------------------------------------
  function buildPath(segs) {
    const p = new Path2D();
    for (let i = 0; i < segs.length; i += 4) {
      p.moveTo(segs[i], segs[i + 1]);
      p.lineTo(segs[i + 2], segs[i + 3]);
    }
    return p;
  }

  // --- animation loop ---------------------------------------------------
  let rafId = null;
  let running = true;
  let t0 = null;

  function frame(now) {
    if (!running) return;
    if (t0 === null) t0 = now;

    const elapsed = (now - t0) / 1000;
    const t01 = (elapsed % DURATION) / DURATION;

    // Evaluate field + extract contours
    const field = evalField(t01);
    const segs = marchContours(field);
    const contourPath = buildPath(segs);

    // Draw — centered square pattern, cycling color
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = lerpColor(t01);
    ctx.lineWidth = LINE_W * dpr;
    ctx.lineCap = 'round';
    ctx.stroke(contourPath);

    rafId = requestAnimationFrame(frame);
  }

  rafId = requestAnimationFrame(frame);

  // --- visibility -------------------------------------------------------
  function onVisibility() {
    if (document.hidden) {
      running = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    } else {
      running = true;
      t0 = null; // reset so loop resumes smoothly
      rafId = requestAnimationFrame(frame);
    }
  }
  document.addEventListener('visibilitychange', onVisibility);

  // --- destroy API ------------------------------------------------------
  window.__destroyLoader = function destroy() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);

    const backdrop = document.getElementById('cymatic-loader-backdrop');
    const target = backdrop || canvas;
    target.style.transition = 'opacity 300ms ease-out';
    target.style.opacity = '0';
    setTimeout(() => {
      target.remove();
      delete window.__destroyLoader;
    }, 320);
  };
})();
