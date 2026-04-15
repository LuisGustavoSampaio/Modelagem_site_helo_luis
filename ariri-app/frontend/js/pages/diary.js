/**
 * diary.js - Pagina do Diario de Bordo
 */
(function () {
  'use strict';

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      var d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      var day = String(d.getDate()).padStart(2, '0');
      var month = String(d.getMonth() + 1).padStart(2, '0');
      var year = d.getFullYear();
      var hours = String(d.getHours()).padStart(2, '0');
      var minutes = String(d.getMinutes()).padStart(2, '0');
      return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes;
    } catch (e) { return isoStr; }
  }

  function normalizeName(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function normalizePendingPost(item) {
    return {
      id: item.id,
      volunteer_name: item.data && item.data.volunteer_name,
      owner_key: item.data && item.data.owner_key,
      title: item.data && item.data.title,
      description: item.data && item.data.description,
      image_url: item.data && item.data.image,
      created_at: item.created_at,
      pending_sync: true
    };
  }

  function canDeletePost(post, currentVolunteer, currentOwnerKey) {
    if (!currentVolunteer) return false;
    if (post && post.owner_key) {
      return !!currentOwnerKey && post.owner_key === currentOwnerKey;
    }
    return normalizeName(post && post.volunteer_name) === normalizeName(currentVolunteer);
  }

  function sortPostsDescending(posts) {
    return posts.sort(function (a, b) {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }

  function mergePosts(lists) {
    var byId = {};

    lists.forEach(function (list) {
      (list || []).forEach(function (post) {
        if (!post) return;
        var existing = byId[post.id];
        if (!existing) {
          byId[post.id] = post;
          return;
        }

        if (post.pending_sync) {
          byId[post.id] = post;
          return;
        }

        if (!existing.pending_sync) {
          byId[post.id] = post;
        }
      });
    });

    return Object.keys(byId).map(function (id) { return byId[id]; });
  }

  function buildPostCard(post, baseUrl, currentVolunteer, currentOwnerKey) {
    var authorName = post.volunteer_name || 'Anonimo';
    var dateStr = formatDate(post.created_at);
    var pendingBadge = post.pending_sync
      ? '<span class="sync-pending-badge">Aguardando conexao</span>'
      : '';
    var imageSrc = post.image_url || (post.image_path ? (baseUrl + '/uploads/' + post.image_path) : '');
    var canDelete = canDeletePost(post, currentVolunteer, currentOwnerKey);

    var imageHtml = '';
    if (imageSrc) {
      imageHtml =
        '<div class="diary-post-media">' +
          '<img class="diary-post-image" src="' + imageSrc + '" alt="Imagem da postagem" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.style.display=\'none\'">' +
        '</div>';
    }

    return '<article class="diary-post-card' + (post.pending_sync ? ' pending-sync' : '') + '">' +
      '<div class="diary-post-header">' +
        '<div class="diary-post-header-main">' +
          '<span class="diary-post-author">' + authorName + '</span>' +
          '<span class="diary-post-date">' + dateStr + '</span>' +
        '</div>' +
        (canDelete
          ? '<button class="diary-post-delete" type="button" data-delete-post="' + escapeAttr(post.id) + '" data-pending-sync="' + (post.pending_sync ? 'true' : 'false') + '" aria-label="Excluir postagem">Excluir</button>'
          : '') +
      '</div>' +
      (pendingBadge ? '<div class="diary-pending-badge-row">' + pendingBadge + '</div>' : '') +
      imageHtml +
      '<div class="diary-post-body">' +
        '<h3 class="diary-post-title">' + (post.title || '') + '</h3>' +
        '<p class="diary-post-desc">' + (post.description || '') + '</p>' +
      '</div>' +
    '</article>';
  }

  function renderPosts(feedEl, posts, base, currentVolunteer, currentOwnerKey) {
    if (!posts || posts.length === 0) {
      feedEl.innerHTML =
        '<div class="empty-state">' +
          '<p class="empty-state-text">Nenhuma postagem ainda.<br>Seja o primeiro a compartilhar!</p>' +
        '</div>';
      return;
    }

    var feedHtml = '<div class="diary-feed-list">';
    posts.forEach(function (post) { feedHtml += buildPostCard(post, base, currentVolunteer, currentOwnerKey); });
    feedHtml += '</div>';
    feedEl.innerHTML = feedHtml;
  }

  function loadPendingPosts() {
    if (!window.DB || !window.DB.getPending) return Promise.resolve([]);
    return window.DB.getPending('pending_posts')
      .then(function (items) { return items.map(normalizePendingPost); })
      .catch(function () { return []; });
  }

  function renderDiaryPage(container) {
    var html =
      '<div class="page-top-bar">' +
        '<div class="page-top-brand" aria-label="Mackenzie"><span class="page-top-brand-kicker">UPM</span><span class="page-top-brand-title">Mackenzie</span></div>' +
        '<h1 class="page-top-title">Diario de Bordo</h1>' +
      '</div>' +
      '<div class="detail-cards">' +
        '<div class="detail-card new-form-card" id="new-post-card" role="button" tabindex="0" aria-label="Nova postagem">' +
          '<div class="new-form-card-inner">' +
            '<span class="detail-card-label" style="margin-bottom:0">Nova<br>postagem:</span>' +
            '<button class="add-circle-btn" aria-label="Adicionar postagem">' +
              '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="diary-feed" class="mt-16"></div>' +
      '<div id="diary-loading" class="text-center mt-24"><div class="spinner"></div></div>';

    container.innerHTML = html;

    var card = document.getElementById('new-post-card');
    var base = window.Sync ? window.Sync.getServerUrl() : '';
    var currentVolunteer = (localStorage.getItem('volunteer_name') || '').trim();
    var currentOwnerKey = window.Sync && window.Sync.getOwnerKeyForVolunteer
      ? window.Sync.getOwnerKeyForVolunteer(currentVolunteer)
      : '';
    var feedEl = document.getElementById('diary-feed');
    var loadingEl = document.getElementById('diary-loading');
    var initialPendingPosts = [];

    function goNew() { window.location.hash = '#/diary/new'; }

    function removePost(postId, isPendingOnly) {
      if (!postId || !currentVolunteer) return;
      if (!window.confirm('Deseja excluir esta postagem?')) return;

      var removeLocal = Promise.resolve();
      if (window.DB && window.DB.deletePending) {
        removeLocal = window.DB.deletePending('pending_posts', postId).catch(function () {});
      }

      if (window.Sync && window.Sync.removeCachedListItem) {
        window.Sync.removeCachedListItem('posts', postId);
      }

      if (isPendingOnly) {
        removeLocal.then(function () {
          window.dispatchEvent(new CustomEvent('app:data-changed'));
        });
        return;
      }

      removeLocal.then(function () {
        return fetch(base + '/api/posts/' + encodeURIComponent(postId) + '/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volunteer_name: currentVolunteer, owner_key: currentOwnerKey })
        });
      }).then(function (res) {
        if (!res.ok) throw new Error('delete_failed');
        window.dispatchEvent(new CustomEvent('app:data-changed'));
      }).catch(function () {
        window.alert('Nao foi possivel excluir esta postagem.');
      });
    }

    card.addEventListener('click', goNew);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goNew(); }
    });

    feedEl.addEventListener('click', function (e) {
      var deleteTrigger = e.target.closest('[data-delete-post]');
      if (deleteTrigger) {
        removePost(
          deleteTrigger.getAttribute('data-delete-post'),
          deleteTrigger.getAttribute('data-pending-sync') === 'true'
        );
        return;
      }
    });

    loadPendingPosts().then(function (pendingPosts) {
      initialPendingPosts = pendingPosts || [];
      if (initialPendingPosts.length > 0) {
        loadingEl.classList.add('hidden');
        renderPosts(feedEl, sortPostsDescending(mergePosts([initialPendingPosts])), base, currentVolunteer, currentOwnerKey);
      }

      return window.Sync && window.Sync.fetchJsonWithCache
        ? window.Sync.fetchJsonWithCache('/api/posts', 'posts', 2500)
        : fetch(base + '/api/posts')
            .then(function (res) {
              if (!res.ok) throw new Error('err');
              return res.json();
            })
            .catch(function () { return []; });
    }).then(function (onlinePosts) {
      loadingEl.classList.add('hidden');
      renderPosts(feedEl, sortPostsDescending(mergePosts([initialPendingPosts, onlinePosts || []])), base, currentVolunteer, currentOwnerKey);
    }).catch(function () {
      loadingEl.classList.add('hidden');
      if (initialPendingPosts.length > 0) {
        renderPosts(feedEl, sortPostsDescending(mergePosts([initialPendingPosts])), base, currentVolunteer, currentOwnerKey);
        return;
      }
      feedEl.innerHTML =
        '<div class="empty-state"><p class="empty-state-text">Nao foi possivel carregar as postagens.</p></div>';
    });
  }

  window.renderDiaryPage = renderDiaryPage;
})();
