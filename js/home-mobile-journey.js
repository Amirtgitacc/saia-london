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

  /* chapters keyed to journey progress (0..1) */
  var CH = [
    { a: 0.00, b: 0.22, e: "A women's club in London", t: "Yoga mat hire,<br>across London.", x: "Rent our mats for £8.50 each, with same-day delivery from our Central London warehouse." },
    { a: 0.22, b: 0.44, e: "Fitness",    t: "Pilates with<br>Cristina.",        x: "I believe that the body is the vessel that takes us through life — designed to do incredible things if you let it." },
    { a: 0.44, b: 0.63, e: "The method", t: "Strengthen, heal,<br>realign.",  x: "My mission is to share the transformative practice of Joseph Pilates. Through his method, Contrology, Pilates empowers individuals to strengthen, heal, and realign their bodies from within." },
    { a: 0.63, b: 0.82, e: "Where",      t: "NW3 &amp;<br>Hampstead.",          x: "I offer 1-2-1 classes for women in NW3 and group classes in Hampstead, London." },
    { a: 0.82, b: 1.01, e: "Every body", t: "For every<br>body.",   x: "The body is the greatest investment we can make in ourselves. Pilates is a beautiful, powerful, and accessible practice for every body." }
  ];
  var N = CH.length;
  var UNROLL_END = 0.16, HANDOFF_END = 0.22;   // mat rolls open, then dissolves to the flow

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
            '<div class="mj-bcue"><span class="mj-mouse"></span><span class="mj-cue-lbl">Scroll</span></div>' +
            '<div class="mj-ladder"></div>' +
          '</div>' +
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

  /* ---- 3D mat (rolls open via morph clip, scrubbed) ---- */
  var renderer, scene, camera, mixer, matReady = false, matDur = 4, MAT_OPEN = 0.72;
  function initMat() {
    renderer = new THREE.WebGLRenderer({ canvas: matgl, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(anim.clientWidth, anim.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, anim.clientWidth / anim.clientHeight, 0.1, 100);
    camera.position.set(0, 1.15, 5.6); camera.lookAt(0, 0.08, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    var key = new THREE.DirectionalLight(0xfff3e6, 1.5); key.position.set(2.5, 6, 4); scene.add(key);
    var rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(-3, 2, -2); scene.add(rim);
    new GLTFLoader().load('assets/saia-mat-roll-open.glb', function (gltf) {
      var m = gltf.scene;
      var box = new THREE.Box3().setFromObject(m);
      var size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      m.position.sub(center);
      var span = Math.max(size.x, size.y, size.z) || 1;
      var pivot = new THREE.Group(); pivot.add(m);
      pivot.rotation.x = -1.18; pivot.scale.setScalar(2.1 / span);
      scene.add(pivot);
      if (gltf.animations && gltf.animations[0]) {
        mixer = new THREE.AnimationMixer(m);
        mixer.clipAction(gltf.animations[0]).play();
        matDur = gltf.animations[0].duration || 4;
      }
      matReady = true; draw(curP);
    }, undefined, function (err) { console.warn('SAÏA mat GLB failed', err); });
  }
  initMat();
  function renderMat(u) { if (!matReady) return; if (mixer) mixer.setTime(clamp(u, 0, 1) * matDur * MAT_OPEN); renderer.render(scene, camera); }

  function draw(p) {
    var u = clamp(p / UNROLL_END, 0, 1);
    if (p < HANDOFF_END + 0.03) renderMat(u);
    var ho = clamp((p - UNROLL_END) / (HANDOFF_END - UNROLL_END), 0, 1);
    matgl.style.opacity = 1 - ho;
    cv.style.opacity = ho;
    var fp = clamp((p - UNROLL_END) / (1 - UNROLL_END), 0, 1);
    drawFlow(1 + fp * (FLOW_COUNT - 1));
    chaps.forEach(function (c, i) { c.classList.toggle('on', p >= CH[i].a && p < CH[i].b); });
    var ai = 0;
    for (var ci = 0; ci < N; ci++) { if (p >= CH[ci].a && p < CH[ci].b) { ai = ci; break; } if (p >= CH[ci].b) ai = Math.min(ci + 1, N - 1); }
    for (var si = 0; si < ladder.length; si++) { ladder[si].classList.toggle('done', si < ai); ladder[si].classList.toggle('on', si === ai); }
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
  targetP = curP = measure();
  setTimeout(function () { draw(curP); }, 120);
  draw(curP);
}
