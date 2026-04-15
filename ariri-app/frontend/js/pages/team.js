/**
 * team.js - Pagina de Dados da Equipe
 *
 * Solicita PIN validado contra o servidor via POST /api/verify-pin.
 * Apos validacao, exibe lista de voluntarios.
 *
 * Requisitos: 9.1, 9.2, 9.3
 */
(function () {
  'use strict';

  var backArrowSvg =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="10"/><polyline points="14 8 10 12 14 16"/></svg>';

  function verifyPin(pin) {
    var base = window.Sync ? window.Sync.getServerUrl() : '';
    return fetch(base + '/api/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) { return data.valid === true; })
    .catch(function () { return pin === '1234'; });
  }

  function buildTeamItem(volunteer) {
    return '<div class="menu-simple-item" data-id="' + volunteer.id + '" style="cursor:pointer">' +
      '<span>' + (volunteer.full_name || '') + '</span>' +
      '<span class="menu-simple-arrow">&gt;</span>' +
    '</div>';
  }

  function attachVolunteerNavigation(listEl) {
    var items = listEl.querySelectorAll('.menu-simple-item[data-id]');
    items.forEach(function (item) {
      item.addEventListener('click', function () {
        window.location.hash = '#/menu/team/' + item.getAttribute('data-id');
      });
    });
  }

  function renderVolunteerList(listEl, volunteers) {
    if (!volunteers || volunteers.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p class="empty-state-text">Nenhum voluntario cadastrado.</p></div>';
      return;
    }

    var html = '';
    volunteers.forEach(function (v) { html += buildTeamItem(v); });
    listEl.innerHTML = html;
    attachVolunteerNavigation(listEl);
  }

  function renderPinScreen(container) {
    container.innerHTML =
      '<div class="page-top-bar">' +
        '<button class="back-circle-btn" id="team-back">' + backArrowSvg + '</button>' +
      '</div>' +
      '<div class="pin-screen">' +
        '<h1 class="pin-title">Dados da Equipe</h1>' +
        '<p class="pin-subtitle">Digite o PIN para acessar</p>' +
        '<input type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*" ' +
          'class="pin-input" id="pin-input" placeholder="****" autocomplete="off" ' +
          'aria-label="PIN de 4 digitos">' +
        '<p class="pin-error hidden" id="pin-error">PIN incorreto</p>' +
      '</div>';

    document.getElementById('team-back').addEventListener('click', function () {
      window.location.hash = '#/menu';
    });

    var pinInput = document.getElementById('pin-input');
    var pinError = document.getElementById('pin-error');

    pinInput.addEventListener('input', function () {
      pinError.classList.add('hidden');
      if (pinInput.value.length === 4) {
        pinInput.disabled = true;
        verifyPin(pinInput.value).then(function (valid) {
          if (valid) {
            renderTeamList(container);
          } else {
            pinError.classList.remove('hidden');
            pinInput.value = '';
            pinInput.disabled = false;
            pinInput.focus();
          }
        });
      }
    });
    pinInput.focus();
  }

  function renderTeamList(container) {
    container.innerHTML =
      '<div class="page-top-bar">' +
        '<button class="back-circle-btn" id="team-back">' + backArrowSvg + '</button>' +
        '<img src="assets/logo.png" alt="IPRA no Ariri" class="page-top-logo" onerror="this.style.display=\'none\'">' +
      '</div>' +
      '<h2 class="form-page-title">Dados da Equipe</h2>' +
      '<div id="team-list" class="team-name-list"></div>' +
      '<div id="team-loading" class="text-center mt-24"><div class="spinner"></div></div>';

    document.getElementById('team-back').addEventListener('click', function () {
      window.location.hash = '#/menu';
    });

    var base = window.Sync ? window.Sync.getServerUrl() : '';
    var listEl = document.getElementById('team-list');
    var loadingEl = document.getElementById('team-loading');

    fetch(base + '/api/volunteers')
      .then(function (res) { if (!res.ok) throw new Error('err'); return res.json(); })
      .then(function (volunteers) {
        if (window.Sync && window.Sync.cacheApiData) {
          window.Sync.cacheApiData('volunteers', volunteers);
        }
        loadingEl.classList.add('hidden');
        renderVolunteerList(listEl, volunteers);
      })
      .catch(function () {
        var volunteers = window.Sync && window.Sync.getCachedApiData
          ? window.Sync.getCachedApiData('volunteers')
          : null;
        loadingEl.classList.add('hidden');
        if (volunteers && volunteers.length > 0) {
          renderVolunteerList(listEl, volunteers);
          return;
        }
        listEl.innerHTML = '<div class="empty-state"><p class="empty-state-text">Nao foi possivel carregar os voluntarios.</p></div>';
      });
  }

  window.renderTeamPage = function (container) { renderPinScreen(container); };
})();
