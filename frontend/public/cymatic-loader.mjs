// Cymatic loading screen — Chladni nodal-line contours, seamless tiling
// Pure ES module, zero dependencies. Reads --ws-accent / --ws-bg from :root.

(function boot() {
  const canvas = document.getElementById('cymatic-loader');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // --- tunables ---------------------------------------------------------
  const GRID       = 150;   // field sample resolution
  const LINE_W     = 2.5;   // CSS-px stroke width (~0.5pt at 2x DPR)
  const FIELD_SC   = 2.0;   // field scale — domain [-1,1] for proper plate modes
  const MAX_ALPHA  = 0.72;  // peak line opacity
  const DURATION   = 4.0;   // loop period (seconds)

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

  function parseColorToRgb(color) {
    const c = color.trim();
    if (c.startsWith('#')) {
      let hex = c.slice(1);
      if (hex.length === 3 || hex.length === 4) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      else if (hex.length === 8) hex = hex.slice(0, 6);
      if (hex.length === 6) {
        const n = parseInt(hex, 16);
        if (!isNaN(n)) return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
      }
    }
    const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return [0x3F, 0x5C, 0x6E]; // Oxide Blue fallback
  }

  let ink, bg, inkStroke;
  function refreshColors() {
    ink = resolveColor('--ws-accent', '#3F5C6E');
    bg  = resolveColor('--ws-bg', '#F5F2ED');
    const [r, g, b] = parseColorToRgb(ink);
    inkStroke = `rgba(${r},${g},${b},${MAX_ALPHA})`;
    canvas.style.background = bg;
  }
  refreshColors();

  // --- sizing -----------------------------------------------------------
  let W, H, dpr, cx, cy;

  function resize() {
    dpr = devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    cx = W * dpr * 0.5;
    cy = H * dpr * 0.5;
  }
  resize();

  let ro;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(resize);
    ro.observe(canvas);
  } else {
    ro = { disconnect() {} };
  }

  // --- Chladni field ----------------------------------------------------
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
          (1 - w) * chladni(qx, qy, 3, 5) +
          w       * chladni(qx, qy, 4, 6) +
          0.55 * (w * chladni(qx, qy, 2, 7) + (1 - w) * chladni(qx, qy, 5, 3));
        buf[iy * (GRID + 1) + ix] = f;
      }
    }
    return buf;
  }

  // --- marching squares → line segments ---------------------------------
  // Returns flat array [x1,y1,x2,y2, x1,y1,x2,y2, ...]
  function marchContours(field) {
    const segs = [];
    const cols = GRID + 1;
    // Map grid coords → full canvas
    const scaleX = canvas.width / GRID;
    const scaleY = canvas.height / GRID;

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
            ex[a] * scaleX,
            ey[a] * scaleY,
            ex[b] * scaleX,
            ey[b] * scaleY,
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

    // Draw — full pattern, uniform opacity
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = inkStroke;
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

    canvas.style.transition = 'opacity 300ms ease-out';
    canvas.style.opacity = '0';
    setTimeout(() => {
      canvas.remove();
      delete window.__destroyLoader;
    }, 320);
  };
})();
