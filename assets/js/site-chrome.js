/* Sticky header shadow. No network, no storage. */
(function () {
  'use strict';
  var header = document.querySelector('.site-header');
  if (!header) return;
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 4);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();
