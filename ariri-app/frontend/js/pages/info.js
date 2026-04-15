(function () {
  'use strict';
  var DAYS = [
    { id: 'sabado', label: 'Sábado:', shortLabel: 'Sab' },
    { id: 'domingo', label: 'Domingo:', shortLabel: 'Dom' },
    { id: 'segunda', label: 'Segunda:', shortLabel: 'Seg' },
    { id: 'terca', label: 'Terça:', shortLabel: 'Ter' }
  ];

  window.renderInfoPage = function (container) {
    var html =
      '<div class="page-top-bar">' +
        '<div class="page-top-brand" aria-label="Mackenzie"><span class="page-top-brand-kicker">UPM</span><span class="page-top-brand-title">Mackenzie</span></div>' +
        '<h1 class="page-top-title">Informações</h1>' +
      '</div>' +
      '<div class="info-cards">';
    for (var i = 0; i < DAYS.length; i++) {
      html += '<div class="info-day-card info-day-card-' + DAYS[i].id + '" data-day="' + DAYS[i].id + '" role="button" tabindex="0">' +
        '<div class="info-day-card-inner">' +
          '<span class="info-day-block info-day-block-' + DAYS[i].id + '">' + DAYS[i].shortLabel + '</span>' +
          '<div class="info-day-copy">' +
            '<span class="info-day-kicker">Programacao</span>' +
            '<span class="info-day-label">' + DAYS[i].label + '</span>' +
          '</div>' +
          '<span class="info-day-arrow info-day-arrow-' + DAYS[i].id + '" aria-hidden="true">&rarr;</span>' +
        '</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.info-day-card[data-day]').forEach(function (card) {
      var dayId = card.getAttribute('data-day');
      card.addEventListener('click', function () { window.location.hash = '#/info/' + dayId; });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.location.hash = '#/info/' + dayId; }
      });
    });
  };
})();
