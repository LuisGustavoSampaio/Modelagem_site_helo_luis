/**
 * forms.js - Pagina de Formularios e Dashboard
 */
(function () {
  'use strict';

  var ACTION_TYPES = [
    'Evangelismo', 'Visitacao', 'Oracao', 'Aconselhamento',
    'Infantil', 'Manutencao', 'Auxilio ao MEAP', 'Cozinha',
    'Educacao', 'Odontologia', 'P. Socorros', 'Outros'
  ];

  var PIE_COLORS = [
    '#1a4731', '#2d6b4a', '#3d8b63', '#4caf7c',
    '#66c295', '#80d4ae', '#a8e0c4', '#c8ecd8',
    '#f9a825', '#ff8f00', '#d32f2f', '#7b1fa2'
  ];

  function formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      var d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return String(d.getDate()).padStart(2, '0') + '/' +
        String(d.getMonth() + 1).padStart(2, '0') + '/' +
        d.getFullYear() + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0');
    } catch (e) { return isoStr; }
  }

  function normalizeAction(action) {
    var map = {
      'Visitação': 'Visitacao',
      'Oração': 'Oracao',
      'Manutenção': 'Manutencao',
      'Educação': 'Educacao',
      'Auxílio ao MEAP': 'Auxilio ao MEAP'
    };
    return map[action] || action;
  }

  function normalizePendingForm(item) {
    return {
      id: item.id,
      volunteer_name: item.data && item.data.volunteer_name,
      actions: ((item.data && item.data.actions) || []).map(normalizeAction),
      description: item.data && item.data.description,
      people_served: item.data && item.data.people_served,
      created_at: item.created_at,
      pending_sync: true
    };
  }

  function mergeForms(lists) {
    var byId = {};

    lists.forEach(function (list) {
      (list || []).forEach(function (form) {
        if (!form) return;
        var existing = byId[form.id];
        if (!existing) {
          byId[form.id] = form;
          return;
        }

        if (form.pending_sync) {
          byId[form.id] = form;
          return;
        }

        if (!existing.pending_sync) {
          byId[form.id] = form;
        }
      });
    });

    return Object.keys(byId).map(function (id) { return byId[id]; });
  }

  function aggregateActions(forms) {
    var counts = {};
    var total = 0;
    ACTION_TYPES.forEach(function (a) { counts[a] = 0; });
    forms.forEach(function (form) {
      (form.actions || []).forEach(function (a) {
        var key = normalizeAction(a);
        if (counts[key] !== undefined) { counts[key]++; total++; }
      });
    });
    return { counts: counts, total: total };
  }

  function buildBarChart(counts, maxCount) {
    var html = '<div class="bar-chart">';
    ACTION_TYPES.forEach(function (action) {
      var count = counts[action] || 0;
      var pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
      html +=
        '<div class="bar-row">' +
          '<span class="bar-label">' + action + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="bar-value">' + count + '</span>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  function buildPieChart(counts, total) {
    if (total === 0) return '<div class="pie-chart"><span class="text-muted">Sem dados</span></div>';

    var stops = [];
    var cumulative = 0;
    ACTION_TYPES.forEach(function (action, i) {
      var count = counts[action] || 0;
      if (count === 0) return;
      var pct = (count / total) * 100;
      stops.push(PIE_COLORS[i] + ' ' + cumulative.toFixed(1) + '% ' + (cumulative + pct).toFixed(1) + '%');
      cumulative += pct;
    });

    var gradient = 'conic-gradient(' + stops.join(', ') + ')';

    var legendHtml = '<div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0">';
    ACTION_TYPES.forEach(function (action, i) {
      var count = counts[action] || 0;
      if (count === 0) return;
      var pct = ((count / total) * 100).toFixed(0);
      legendHtml +=
        '<div style="display:flex;align-items:center;gap:6px;font-size:11px">' +
          '<span style="width:10px;height:10px;border-radius:2px;background:' + PIE_COLORS[i] + ';flex-shrink:0"></span>' +
          '<span style="color:var(--text-secondary)">' + action + ' (' + pct + '%)</span>' +
        '</div>';
    });
    legendHtml += '</div>';

    return '<div class="pie-chart" style="flex-direction:row;gap:16px;align-items:center">' +
      '<div style="width:100px;height:100px;border-radius:50%;background:' + gradient + ';flex-shrink:0"></div>' +
      legendHtml + '</div>';
  }

  function buildDashboardCard(forms) {
    var agg = aggregateActions(forms);
    var maxCount = 0;
    ACTION_TYPES.forEach(function (a) { if (agg.counts[a] > maxCount) maxCount = agg.counts[a]; });

    var totalPeople = 0;
    forms.forEach(function (f) {
      totalPeople += (f.people_served || 1);
    });

    return '<div class="detail-card">' +
      '<p class="detail-card-label">Dashboard:</p>' +
      '<div class="detail-card-content">' +
        '<div style="text-align:center;margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.5);border-radius:12px">' +
          '<div style="font-size:36px;font-weight:800;color:var(--green)">' + totalPeople + '</div>' +
          '<div style="font-size:13px;color:var(--text-secondary);font-weight:500">Pessoas impactadas</div>' +
        '</div>' +
        '<div class="chart-container" style="background:transparent;box-shadow:none;padding:0;margin-bottom:16px">' +
          buildBarChart(agg.counts, maxCount) +
        '</div>' +
        '<div class="chart-container" style="background:transparent;box-shadow:none;padding:0">' +
          buildPieChart(agg.counts, agg.total) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function buildPendingFormsCard(forms) {
    if (!forms || forms.length === 0) return '';

    var html = '<div class="detail-card">' +
      '<div class="pending-item-header" style="margin-bottom:12px">' +
        '<p class="detail-card-label" style="margin-bottom:0">Envios pendentes</p>' +
        '<span class="sync-pending-badge">Aguardando conexao</span>' +
      '</div>' +
      '<div class="pending-list">';

    forms.forEach(function (form) {
      var actions = (form.actions || []).join(', ') || 'Sem acao informada';
      html += '<div class="pending-item">' +
        '<div class="pending-item-header">' +
          '<span class="pending-item-title">' + (form.volunteer_name || 'Formulario salvo offline') + '</span>' +
          '<span class="pending-item-meta">' + formatDate(form.created_at) + '</span>' +
        '</div>' +
        '<div class="pending-item-actions"><strong>Acoes:</strong> ' + actions + '</div>' +
        '<div class="pending-item-meta"><strong>Pessoas atendidas:</strong> ' + (form.people_served || 1) + '</div>' +
        (form.description ? '<div class="pending-item-meta">' + form.description + '</div>' : '') +
      '</div>';
    });

    html += '</div></div>';
    return html;
  }

  function loadPendingForms() {
    if (!window.DB || !window.DB.getPending) return Promise.resolve([]);
    return window.DB.getPending('pending_forms')
      .then(function (items) { return items.map(normalizePendingForm); })
      .catch(function () { return []; });
  }

  function renderFormsPage(container) {
    var html =
      '<div class="page-top-bar">' +
        '<img src="assets/logo.png" alt="IPRA no Ariri" class="page-top-logo" onerror="this.style.display=\'none\'">' +
        '<h1 class="page-top-title">Formulario</h1>' +
      '</div>' +
      '<div class="detail-cards">' +
        '<div class="detail-card new-form-card" id="new-form-card" role="button" tabindex="0" aria-label="Novo formulario">' +
          '<div class="new-form-card-inner">' +
            '<span class="detail-card-label" style="margin-bottom:0">Novo<br>formulario:</span>' +
            '<button class="add-circle-btn" id="new-form-btn" aria-label="Adicionar formulario">' +
              '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
                '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' +
              '</svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="forms-dashboard" class="mt-16"></div>' +
      '<div id="forms-loading" class="text-center mt-24"><div class="spinner"></div></div>';

    container.innerHTML = html;

    var card = document.getElementById('new-form-card');
    function goNew() { window.location.hash = '#/forms/new'; }
    card.addEventListener('click', goNew);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goNew(); }
    });

    var base = window.Sync ? window.Sync.getServerUrl() : '';
    var dashboardEl = document.getElementById('forms-dashboard');
    var loadingEl = document.getElementById('forms-loading');
    var initialPendingForms = [];

    loadPendingForms().then(function (pendingForms) {
      initialPendingForms = pendingForms || [];
      loadingEl.classList.add('hidden');

      if (initialPendingForms.length > 0) {
        dashboardEl.innerHTML = '<div class="detail-cards">' +
          buildDashboardCard(mergeForms([initialPendingForms])) +
          buildPendingFormsCard(initialPendingForms) +
          '</div>';
      }

      return window.Sync && window.Sync.fetchJsonWithCache
        ? window.Sync.fetchJsonWithCache('/api/forms', 'forms', 2500)
        : fetch(base + '/api/forms')
            .then(function (res) {
              if (!res.ok) throw new Error('err');
              return res.json();
            })
            .catch(function () { return []; });
    }).then(function (syncedForms) {
      var allForms = mergeForms([initialPendingForms, syncedForms || []]);
      loadingEl.classList.add('hidden');

      if (allForms.length > 0) {
        dashboardEl.innerHTML = '<div class="detail-cards">' +
          buildDashboardCard(allForms) +
          buildPendingFormsCard(initialPendingForms) +
          '</div>';
      } else {
        dashboardEl.innerHTML = '<div class="detail-cards"><div class="detail-card"><p class="detail-card-label">Dashboard:</p><div class="detail-card-content"><p class="text-muted" style="text-align:center;padding:24px 0">Nenhum dado ainda</p></div></div></div>';
      }
    }).catch(function () {
      loadingEl.classList.add('hidden');
      if (initialPendingForms.length > 0) {
        dashboardEl.innerHTML = '<div class="detail-cards">' +
          buildDashboardCard(mergeForms([initialPendingForms])) +
          buildPendingFormsCard(initialPendingForms) +
          '</div>';
        return;
      }
      dashboardEl.innerHTML = '<div class="detail-cards"><div class="detail-card"><p class="detail-card-label">Dashboard:</p><div class="detail-card-content"><p class="text-muted" style="text-align:center;padding:24px 0">Nenhum dado ainda</p></div></div></div>';
    });
  }

  window.renderFormsPage = renderFormsPage;
})();
