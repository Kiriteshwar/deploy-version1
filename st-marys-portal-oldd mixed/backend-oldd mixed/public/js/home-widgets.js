/**
 * Homepage widgets: floating SSC results promo card
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'smhs_results_promo_closed';
  const DELAY_MS = 4000;

  document.addEventListener('DOMContentLoaded', initFloatingPromo);

  function initFloatingPromo() {
    const card = document.getElementById('floating-results-promo');
    if (!card) return;

    if (localStorage.getItem(STORAGE_KEY) === 'true') return;

    const closeBtn = card.querySelector('.floating-promo-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        card.classList.remove('is-visible');
        localStorage.setItem(STORAGE_KEY, 'true');
      });
    }

    setTimeout(() => {
      card.classList.add('is-visible');
    }, DELAY_MS);
  }
})();
