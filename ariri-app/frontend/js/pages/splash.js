/**
 * IPRA no Ariri — Splash Screen (splash.js)
 *
 * Exibe logo "IPRA no Ariri" centralizado com ilustração.
 * Versículo no canto inferior esquerdo.
 * Fundo creme com shape diagonal decorativo.
 * Ao tocar/clicar em qualquer área, navega para #/info.
 *
 * Requisitos: 1.1, 1.2, 1.3
 */

(function () {
  'use strict';

  window.renderSplashPage = function (container) {
    container.innerHTML =
      '<div class="splash-screen" id="splash-area" role="button" tabindex="0" aria-label="Toque para continuar">' +
        '<div class="splash-logo-area">' +
          '<div class="splash-logo">' +
            '<div class="mackenzie-mark" aria-label="Mackenzie">' +
              '<span class="mackenzie-mark-kicker">Universidade Presbiteriana</span>' +
              '<span class="mackenzie-mark-title">Mackenzie</span>' +
              '<span class="mackenzie-mark-subtitle">Sistema de Campo e Diario</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="splash-verse-area">' +
          '<p class="splash-verse">' +
            '"Ide ao mundo, pregai o evangelho<br>a toda criatura."' +
            '<cite>Marcos 16: 15</cite>' +
          '</p>' +
        '</div>' +
      '</div>';

    var splashArea = document.getElementById('splash-area');

    function goToInfo() {
      window.location.hash = '#/info';
    }

    splashArea.addEventListener('click', goToInfo);
    splashArea.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goToInfo();
      }
    });
  };
})();
