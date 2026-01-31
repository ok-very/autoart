// Cymatic loading screen — Chladni nodal-line contours in a swept ring
// Pure ES module, zero dependencies. Reads --ws-accent / --ws-bg from :root.

(function boot() {
  const canvas = document.getElementById('cymatic-loader');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // --- tunables ---------------------------------------------------------
  const GRID       = 150;   // field sample resolution
  const LINE_W     = 1.5;   // CSS-px stroke width
  const INNER_R    = 0.34;  // ring inner radius (fraction of half-min-dim)
  const OUTER_R    = 0.49;  // ring outer radius
  const ARC_LEN    = 0.22;  // sweep length in turns (0-1)
  const FIELD_SC   = 1.22;  // zoom into field space
  const MAX_ALPHA  = 0.72;  // peak line opacity
  const DURATION   = 3.0;   // loop period (seconds)

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
      if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      const n = parseInt(hex, 16);
      if (!isNaN(n)) return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    }
    const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    return [0x3F, 0x5C, 0x6E]; // Oxide Blue fallback
  }

  let ink, bg;
  function refreshColors() {
    ink = resolveColor('--ws-accent', '#3F5C6E');
    bg  = resolveColor('--ws-bg', '#F5F2ED');
    canvas.style.background = bg;
  }
  refreshColors();

  // --- sizing -----------------------------------------------------------
  let W, H, dpr, cx, cy, rInner, rOuter;
  let cachedRingClip = null;

  function resize() {
    dpr = devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    cx = W * dpr * 0.5;
    cy = H * dpr * 0.5;
    const half = Math.min(W, H) * dpr * 0.5;
    rInner = half * INNER_R;
    rOuter = half * OUTER_R;
    cachedRingClip = null; // invalidate; rebuilt lazily in ringClip()
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
    const spin = t01 * 2 * PI * 0.6;
    const w = 0.5 - 0.5 * cos(2 * PI * t01);
    const cosS = cos(spin);
    const sinS = Math.sin(spin);
    const inv = FIELD_SC / GRID;
    const half = FIELD_SC * 0.5;
    const buf = new Float64Array((GRID + 1) * (GRID + 1));

    for (let iy = 0; iy <= GRID; iy++) {
      for (let ix = 0; ix <= GRID; ix++) {
        const rawX = ix * inv - half;
        const rawY = iy * inv - half;
        const qx = rawX * cosS - rawY * sinS;
        const qy = rawX * sinS + rawY * cosS;
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
    // Map grid coords → canvas coords (centred in ring region)
    const scale = (rOuter * 2) / GRID;
    const ox = cx - rOuter;
    const oy = cy - rOuter;

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

  // --- ring clip path (cached, rebuilt on resize) -----------------------
  function updateRingClip() {
    const p = new Path2D();
    p.arc(cx, cy, rOuter, 0, 2 * PI);       // outer CW
    p.arc(cx, cy, rInner, 0, 2 * PI, true);  // inner CCW (hole)
    cachedRingClip = p;
  }

  function ringClip() {
    if (!cachedRingClip) updateRingClip();
    return cachedRingClip;
  }

  // --- conic gradient for arc sweep -------------------------------------
  const hasConicGradient = typeof ctx.createConicGradient === 'function';

  function arcGradient(t01) {
    const [r, g, b] = parseColorToRgb(ink);

    if (!hasConicGradient) {
      return `rgba(${r},${g},${b},${MAX_ALPHA})`;
    }

    // Sweep start angle: rotates with time
    const startAngle = t01 * 2 * PI - PI * 0.5;
    const grad = ctx.createConicGradient(startAngle, cx, cy);

    // Leading edge: full opacity
    grad.addColorStop(0, `rgba(${r},${g},${b},${MAX_ALPHA})`);
    // Ramp down over arcLen turns
    grad.addColorStop(ARC_LEN * 0.5, `rgba(${r},${g},${b},${MAX_ALPHA * 0.5})`);
    grad.addColorStop(ARC_LEN, `rgba(${r},${g},${b},0)`);
    // Rest of circle: transparent
    grad.addColorStop(ARC_LEN + 0.001, `rgba(${r},${g},${b},0)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

    return grad;
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
    const clip = ringClip();
    const grad = arcGradient(t01);

    // Draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.clip(clip, 'evenodd');
    ctx.strokeStyle = grad;
    ctx.lineWidth = LINE_W * dpr;
    ctx.lineCap = 'round';
    ctx.stroke(contourPath);
    ctx.restore();

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
