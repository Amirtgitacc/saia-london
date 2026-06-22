/* ============================================================
   SAÏA — Home: pinned scroll-SCRUBBED FILM journey (Sample A)
   Pins #homeCanvas and scrubs a frame sequence (mat1.mp4 → JPEGs)
   as you scroll, so the real footage plays roll → unroll → feet →
   practice → community across the pin, with the [data-band] chapters
   revealing over it. Same sticky + damped-progress spine as the 3D
   journey, so it's a drop-in swap.
   Frame URLs come from window.SAIA_ASSETS so it ports to Shopify.
   ============================================================ */
(function () {
  const NS = (window.SAIA = window.SAIA || {});
  const ASSETS = window.SAIA_ASSETS || {};
  const DIR = ASSETS.filmDir || 'assets/film/';
  const COUNT = ASSETS.filmFrames || 120;

  const root = document.getElementById('homeRoot');
  const wrap = document.getElementById('top');
  const canvas = document.getElementById('homeCanvas');
  const stage = document.getElementById('stage');
  const rail = document.getElementById('homeBar');
  const hint = document.getElementById('homeHint');

  function goStatic() { if (root) root.classList.add('is-static'); }
  if (!wrap || !canvas) { goStatic(); return; }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { goStatic(); return; }

  const ctx2d = canvas.getContext('2d');
  const bandEls = stage ? Array.prototype.slice.call(stage.querySelectorAll('[data-band]')) : [];

  /* ---- preload the frame sequence ---- */
  const frames = new Array(COUNT);
  let loaded = 0;
  const pad = (n) => String(n).padStart(3, '0');
  for (let i = 0; i < COUNT; i++) {
    const img = new Image();
    const done = () => { loaded++; };
    img.onload = done; img.onerror = done;
    img.src = DIR + 'f' + pad(i + 1) + '.jpg';
    frames[i] = img;
  }

  /* ---- state ---- */
  let cw = 0, ch = 0, last = -1, current = 0, target = 0, lastT = 0, revealed = false, paused = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = canvas.clientWidth || window.innerWidth;
    ch = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    last = -1;
  }

  function drawFrame(idx) {
    const img = frames[idx];
    if (!img || !img.complete || !img.naturalWidth) return false;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(cw / iw, ch / ih);
    const w = iw * s, h = ih * s;
    ctx2d.clearRect(0, 0, cw, ch);
    ctx2d.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    return true;
  }

  function frameFor(p) { return Math.max(0, Math.min(COUNT - 1, Math.round(p * (COUNT - 1)))); }

  function bands(p) {
    for (const e of bandEls) {
      const parts = (e.getAttribute('data-band') || '0,1').split(',').map(Number);
      const a = parts[0], b = parts[1];
      const f = Math.min(0.055, (b - a) * 0.4);
      const kin = a <= 0.001 ? 1 : Math.min(1, Math.max(0, (p - a) / f));
      const kout = b >= 0.999 ? 1 : Math.min(1, Math.max(0, (b - p) / f));
      let k = Math.min(kin, kout); if (p < a - 0.001 || p > b + 0.001) k = 0;
      e.style.opacity = k.toFixed(3);
      const inner = e.firstElementChild;
      if (inner) inner.style.transform = 'translateY(' + ((1 - k) * 24).toFixed(1) + 'px)';
      e.style.pointerEvents = k > 0.5 ? 'auto' : 'none';
    }
  }

  function paint(p) {
    const idx = frameFor(p);
    if (idx !== last) { if (drawFrame(idx)) last = idx; }
    if (!revealed && last >= 0) { canvas.style.transition = 'opacity .8s ease'; canvas.style.opacity = '1'; revealed = true; }
    if (rail) rail.style.height = (p * 100).toFixed(1) + '%';
    if (hint) hint.style.opacity = (1 - Math.min(1, p / 0.04)).toFixed(3);
    bands(p);
  }

  function updateTarget() {
    const total = wrap.offsetHeight - window.innerHeight;
    const scrolled = -wrap.getBoundingClientRect().top;
    target = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
  }

  resize();
  window.addEventListener('resize', resize);

  /* debug rig so tools/shots.mjs can render an exact frame at progress p */
  NS._rig = { at(p) { paused = true; paint(p); }, resume() { paused = false; } };

  function loop(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
    if (!paused) {
      updateTarget();
      const k = 1 - Math.exp(-9 * dt);               // critically-damped feel
      current += (target - current) * k;
      if (Math.abs(current - target) < 0.0002) current = target;
      paint(current);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
