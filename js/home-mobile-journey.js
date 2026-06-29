/* ============================================================
   SAÏA — Mobile scroll journey  (≤767px only)
   Text on top, animation on the bottom. The signature mat rolls
   open (real GLB morph, scrubbed) then hands off to the 303-frame
   watercolour Cristina flow. Eased loop keeps the scrub smooth.
   Powered by the vendored three.js r150 ES modules.
   ============================================================ */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

export function initMobileJourney() {
  var root = document.getElementById('mobileJourney');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  var FLOW_COUNT = 303, STEP = 1;
  var loaded = {};
  function frameURL(i) { return 'assets/flow-frames/f' + String(i).padStart(3, '0') + '.webp'; }
  function preload(i) { if (loaded[i]) return; var im = new Image(); im.onload = function () { if (rafId === null) draw(curP); }; im.src = frameURL(i); loaded[i] = im; }

  /* chapters keyed to journey progress (0..1)
     0.00–0.41 = mat phase (rolls open, then holds flat): hero → signature mat → hiring effortless
     0.41–1.00 = Cristina watercolour flow: Pilates → method → where → every body
     (mirrors the desktop flow — the mat-hire story is told over the opening mat, not in separate sections) */
  var CH = [
    { a: 0.00, b: 0.15, e: "A women's club in London", t: "Yoga mat hire,<br>across London.", x: "Rent our mats for £8.50 each, with same-day delivery from our Central London warehouse." },
    { a: 0.15, b: 0.30, e: "The signature mat", t: "Made for grip,<br>made to last.", x: "One mat, exceptionally made: an ethically sourced natural-rubber base with a non-slip, anti-odour PU surface. Weighted to fall open and lie flat the moment you unroll it." },
    { a: 0.30, b: 0.45, e: "Mat hire",   t: "Hiring is<br>effortless.", x: "From a 10-mat morning class to a 50-person retreat, we handle delivery, set-up and collection. £8.50 a mat, 2-day hire, minimum of ten." },
    { a: 0.45, b: 0.59, e: "Fitness",    t: "Pilates with<br>Cristina.",        x: "I believe that the body is the vessel that takes us through life — designed to do incredible things if you let it." },
    { a: 0.59, b: 0.72, e: "The method", t: "Strengthen, heal,<br>realign.",  x: "My mission is to share the transformative practice of Joseph Pilates. Through his method, Contrology, Pilates empowers individuals to strengthen, heal, and realign their bodies from within." },
    { a: 0.72, b: 0.86, e: "Where",      t: "NW3 &amp;<br>Hampstead.",          x: "I offer 1-2-1 classes for women in NW3 and group classes in Hampstead, London." },
    { a: 0.86, b: 1.01, e: "Every body", t: "For every<br>body.",   x: "The body is the greatest investment we can make in ourselves. Pilates is a beautiful, powerful, and accessible practice for every body." }
  ];
  var N = CH.length;
  // mat unrolls slowly across hero→signature→hiring (ease-in: holds rolled, falls open, lies flat),
  // ~half-open under "Made for grip", fully flat by UNROLL_END, then dissolves to Cristina at HANDOFF_START
  var UNROLL_START = 0.05, UNROLL_END = 0.43, HANDOFF_START = 0.45, HANDOFF_END = 0.51;

  root.innerHTML =
    '<div class="mj-track">' +
      '<div class="mj-pin">' +
        '<div class="mj-txt">' + CH.map(function (c, i) {
          return '<div class="mj-chap" data-i="' + i + '"><p class="mj-eb">' + c.e + '</p><h2 class="mj-h">' + c.t + '</h2><p class="mj-x">' + c.x + '</p></div>';
        }).join('') + '</div>' +
        '<div class="mj-anim">' +
          '<canvas class="mj-matgl"></canvas>' +
          '<canvas class="mj-flow"></canvas>' +
          '<div class="mj-beacon">' +
            '<div class="mj-bcue">' +
            '<div class="mj-swipe"><img class="mj-hand-img" src="assets/swipe-hand.png?v=1" alt=""></div>' +
            '<span class="mj-cue-lbl">Swipe up</span>' +
          '</div>' +
            '<div class="mj-ladder"></div>' +
          '</div>' +
          '<a class="mj-endcta" href="guest-list.html">' +
            '<span class="mj-endcta-eb">Train with Cristina</span>' +
            '<span class="mj-endcta-btn">Work out together <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></span>' +
          '</a>' +
        '</div>' +
      '</div>' +
    '</div>';

  var track = root.querySelector('.mj-track');
  var anim  = root.querySelector('.mj-anim');
  var chaps = [].slice.call(root.querySelectorAll('.mj-chap'));
  var cv    = root.querySelector('.mj-flow');
  var ctx   = cv.getContext('2d');
  var matgl = root.querySelector('.mj-matgl');
  var bcue  = root.querySelector('.mj-bcue');
  var ladEl = root.querySelector('.mj-ladder');
  var endcta = root.querySelector('.mj-endcta');
  for (var _li = 0; _li < N; _li++) ladEl.appendChild(document.createElement('i'));
  var ladder = [].slice.call(ladEl.children);

  /* ---- flow frames: eager entrance, then stream the rest ---- */
  for (var i = 1; i <= 14; i++) preload(i);
  var _li = 15;
  (function bg() { var end = Math.min(FLOW_COUNT, _li + 8); while (_li <= end) preload(_li++); if (_li <= FLOW_COUNT) setTimeout(bg, 28); })();

  function sizeFlow() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(anim.clientWidth * dpr); cv.height = Math.round(anim.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeFlow();

  function frameFor(idx) { var k = clamp(Math.round((idx - 1) / STEP) * STEP + 1, 1, FLOW_COUNT); if (!loaded[k]) preload(k); return loaded[k]; }
  var ZOOM = 1.12, FIG_Y = 0.12;
  function drawFlow(idx) {
    var img = frameFor(idx);
    if (!img || !img.complete || !img.naturalWidth) return;
    var cw = anim.clientWidth, chh = anim.clientHeight;
    ctx.clearRect(0, 0, cw, chh);
    var scale = Math.min(cw / img.naturalWidth, chh / img.naturalHeight) * ZOOM;
    var w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    ctx.drawImage(img, (cw - w) / 2, (chh - h) * FIG_Y, w, h);
  }

  /* ---- 3D mat — the real branded GLB (assets/mat yoga.glb) ----
     A morph-target "unroll" clip (SAIA_Mat_Unroll, 13 targets) scrubbed by scroll: the mat
     starts rolled and unfurls to lie dead flat. Oriented horizontal (length left-right) so it
     matches Cristina's watercolour mat for a seam-free handoff. Orientation + camera dialled
     in tools/lab/mat-glb-lab.html. */
  var renderer, scene, camera, matReady = false, matPivot, matMixer, matAction, matClipDur = 1, matRoot;

  function initMat() {
    renderer = new THREE.WebGLRenderer({ canvas: matgl, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(anim.clientWidth, anim.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, anim.clientWidth / anim.clientHeight, 0.1, 100);
    camera.position.set(0, 3.6, 3.4); camera.lookAt(0, -0.15, -0.2);
    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    var key = new THREE.DirectionalLight(0xfff3e6, 1.45); key.position.set(2, 6, 4.5); scene.add(key);
    var rim = new THREE.DirectionalLight(0xffffff, 0.4); rim.position.set(-3, 2.5, 2); scene.add(rim);

    matPivot = new THREE.Group();
    matPivot.rotation.set(-Math.PI / 2, 0, Math.PI / 2);   // lay the mat flat, length left-right (matches Cristina's mat)
    matPivot.scale.setScalar(0.82);                          // sized to match Cristina's watercolour mat at the handoff
    scene.add(matPivot);

    new GLTFLoader().load('assets/mat yoga.glb', function (gltf) {
      matRoot = gltf.scene;
      var box = new THREE.Box3().setFromObject(matRoot);            // recentre on the mat's own centre so it pivots cleanly
      matRoot.position.sub(box.getCenter(new THREE.Vector3()));
      matPivot.add(matRoot);
      if (gltf.animations && gltf.animations.length) {
        matMixer = new THREE.AnimationMixer(matRoot);
        var clip = gltf.animations[0];
        matClipDur = clip.duration || 1;
        matAction = matMixer.clipAction(clip); matAction.play();
      }
      matReady = true; draw(curP);
    }, undefined, function (err) { console.warn('[mj] mat GLB failed to load', err); });
  }
  initMat();
  function renderMat(u) {
    if (!matReady) return;
    var e = clamp(u, 0, 1); e = e * e;   // ease-in: holds rolled, falls open, lies flat
    if (matMixer && matAction) { matAction.time = e * matClipDur; matMixer.update(0); }   // scrub the unroll morph
    renderer.render(scene, camera);
  }

  function draw(p) {
    var u = clamp((p - UNROLL_START) / (UNROLL_END - UNROLL_START), 0, 1);   // unroll progress across hero→signature→hiring
    if (p < HANDOFF_END + 0.03) renderMat(u);
    var ho = clamp((p - HANDOFF_START) / (HANDOFF_END - HANDOFF_START), 0, 1);   // flat mat → Cristina dissolve
    matgl.style.opacity = 1 - clamp(ho / 0.55, 0, 1);   // 3D mat clears early so it doesn't cross the watercolour mat
    cv.style.opacity = ho;
    var fp = clamp((p - HANDOFF_START) / (1 - HANDOFF_START), 0, 1);
    drawFlow(1 + fp * (FLOW_COUNT - 1));
    chaps.forEach(function (c, i) { c.classList.toggle('on', p >= CH[i].a && p < CH[i].b); });
    var ai = 0;
    for (var ci = 0; ci < N; ci++) { if (p >= CH[ci].a && p < CH[ci].b) { ai = ci; break; } if (p >= CH[ci].b) ai = Math.min(ci + 1, N - 1); }
    for (var si = 0; si < ladder.length; si++) { ladder[si].classList.toggle('done', si < ai); ladder[si].classList.toggle('on', si === ai); }
    ladEl.style.opacity = clamp(1 - (p - 0.9) / 0.06, 0, 1).toFixed(3);   // fade the rail out before the close
    endcta.classList.toggle('show', p >= 0.93);                          // closing CTA takes the rail's place under Cristina
    bcue.style.opacity = (1 - Math.min(1, p / 0.05)).toFixed(3);
  }

  /* ---- eased loop driven by page scroll ---- */
  var targetP = 0, curP = 0, rafId = null;
  function measure() {
    var vh = window.innerHeight;
    var total = track.offsetHeight - vh;
    var topY = track.getBoundingClientRect().top;   // distance from viewport top
    return clamp((-topY) / total, 0, 1);
  }
  function tick() {
    var d = targetP - curP;
    curP += d * 0.22;
    if (Math.abs(d) < 0.0004) curP = targetP;
    draw(curP);
    rafId = (curP !== targetP) ? requestAnimationFrame(tick) : null;
  }
  function kick() { if (rafId === null) rafId = requestAnimationFrame(tick); }
  function onScroll() { targetP = measure(); kick(); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    renderer.setSize(anim.clientWidth, anim.clientHeight, false);
    camera.aspect = anim.clientWidth / anim.clientHeight; camera.updateProjectionMatrix();
    sizeFlow(); targetP = measure(); draw(curP);
  });

  /* ---- section-by-section snap (touch + wheel) ----
     Within the pinned journey each swipe eases to the next chapter at a moderate, fixed speed so
     the animation can't be flicked past — you see every step. Free native scrolling resumes above
     the hero and below the final chapter. Disabled under prefers-reduced-motion. */
  var prefersReduce = false;
  try { prefersReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (!prefersReduce) {
    var STOPS = [0.06, 0.225, 0.375, 0.52, 0.655, 0.79, 0.965];   // one settled position per chapter
    var isSnapping = false, snapRaf = null, SWIPE_MIN = 22, touchStartY = 0, wheelLock = false;
    function trackTopDoc() { return track.getBoundingClientRect().top + window.scrollY; }
    function totalScroll() { return Math.max(1, track.offsetHeight - window.innerHeight); }
    function yForP(p) { return Math.round(trackTopDoc() + clamp(p, 0, 1) * totalScroll()); }
    function nearestStop(p) { var bi = 0, bd = Infinity; for (var i = 0; i < STOPS.length; i++) { var d = Math.abs(STOPS[i] - p); if (d < bd) { bd = d; bi = i; } } return bi; }
    function engaged() {
      if (isSnapping) return true;
      if (track.offsetHeight - window.innerHeight <= 0) return false;
      var y = window.scrollY;
      return y >= yForP(0) - 1 && y <= yForP(1) + 1;
    }
    function tweenScrollTo(toY, dur) {
      if (snapRaf) cancelAnimationFrame(snapRaf);
      var fromY = window.scrollY, t0 = null;
      isSnapping = true;
      (function step(ts) {
        if (t0 === null) t0 = ts;
        var k = clamp((ts - t0) / dur, 0, 1);
        var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // easeInOutQuad — moderate, settled
        window.scrollTo(0, Math.round(fromY + (toY - fromY) * e));
        if (k < 1) { snapRaf = requestAnimationFrame(step); }
        else { snapRaf = null; isSnapping = false; setLock(inRange()); }   // re-evaluate lock (esp. after releasing past the end)
      })(performance.now());
    }
    function snapMove(dir) {
      var cur = nearestStop(measure()), next = cur + dir;
      if (next >= 0 && next < STOPS.length) tweenScrollTo(yForP(STOPS[next]), 640);
      else if (next >= STOPS.length) tweenScrollTo(yForP(1) + 4, 460);    // release down into the editorial sections
      else tweenScrollTo(Math.max(0, yForP(0) - 4), 460);                  // release up to the top
    }
    /* lock native scroll whenever we're inside the journey so iOS can't fling past chapters.
       The class flips touch-action:none on the pinned view (see index.html .mj-snaplock). */
    var locked = false;
    function inRange() {
      if (track.offsetHeight - window.innerHeight <= 0) return false;
      var y = window.scrollY;
      return y >= yForP(0) - 1 && y <= yForP(1) + 1;
    }
    function setLock(on) {
      if (on === locked) return;
      locked = on;
      document.documentElement.classList.toggle('mj-snaplock', on);
    }
    window.addEventListener('scroll', function () {
      if (isSnapping) return;                 // don't fight our own tween
      if (inRange()) { if (!locked) { setLock(true); snapMove(0); } }   // entering: lock + settle onto the nearest chapter (arrests any entry momentum)
      else setLock(false);
    }, { passive: true });

    function overConcierge(t) { return !!(t && t.closest && t.closest('#homeChatPanel, #homeChatLauncher')); }
    window.addEventListener('touchstart', function (e) { touchStartY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchmove', function (e) { if (engaged() && !overConcierge(e.target) && e.cancelable) e.preventDefault(); }, { passive: false });
    window.addEventListener('touchend', function (e) {
      if (isSnapping || !engaged() || overConcierge(e.target)) return;
      var dy = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(dy) < SWIPE_MIN) return;   // a tap — let the closing CTA / concierge through
      snapMove(dy > 0 ? 1 : -1);
    }, { passive: true });
    window.addEventListener('wheel', function (e) {
      if (!engaged() || overConcierge(e.target)) return;
      if (e.cancelable) e.preventDefault();
      if (isSnapping || wheelLock) return;
      snapMove(e.deltaY > 0 ? 1 : -1);
      wheelLock = true; setTimeout(function () { wheelLock = false; }, 700);
    }, { passive: false });
  }

  targetP = curP = measure();
  setTimeout(function () { draw(curP); }, 120);
  draw(curP);
}
