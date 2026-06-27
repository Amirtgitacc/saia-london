/* ============================================================
   SAÏA — Home page controller (mobile nav drawer only)
   The agentic concierge — thread, brain, hire basket, modes and
   all hire-CTA / launcher wiring — now lives in js/home-concierge.js
   (one shared brain across the inline block and the floating panel).
   ============================================================ */
(function () {
  /* ---------- mobile nav drawer ---------- */
  const drawer = document.getElementById('mobileDrawer');
  if (!drawer) return;
  const openDrawer = () => { drawer.style.display = 'block'; };
  const closeDrawer = () => { drawer.style.display = 'none'; };
  const toggle = document.getElementById('navToggle');
  const close = document.getElementById('navClose');
  if (toggle) toggle.addEventListener('click', openDrawer);
  if (close) close.addEventListener('click', closeDrawer);
  Array.prototype.slice.call(document.querySelectorAll('[data-drawer-link]')).forEach((a) =>
    a.addEventListener('click', closeDrawer));
})();
