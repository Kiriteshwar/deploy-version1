/**
 * Homepage widgets: floating SSC results promo card
 */
(function () {
  'use strict';

  const SHOW_DELAY_MS = 120;

  document.addEventListener('DOMContentLoaded', initFloatingPromo);

  function initFloatingPromo() {
    const card = document.getElementById('floating-results-promo');
    if (!card) return;

    const closeBtn = card.querySelector('.floating-promo-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        card.classList.remove('is-visible');
        card.classList.add('is-dismissed');
      });
    }

    window.setTimeout(() => {
      card.classList.add('is-visible');
    }, SHOW_DELAY_MS);
  }
})();
