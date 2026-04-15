/**
 * sync.js - Synchronization logic for offline-first data.
 */
const Sync = (() => {
  'use strict';

  var POLL_INTERVAL = 30000;
  var STORES = ['pending_forms', 'pending_posts', 'pending_receipts'];
  var LS_KEY = 'server_url';
  var DEFAULT_SERVER_URL = 'https://modelagem-site-helo-luis.onrender.com';
  var CACHE_PREFIX = 'api_cache:';

  var _intervalId = null;

  function _notifyConnectivityChanged() {
    window.dispatchEvent(new CustomEvent('app:connectivity-changed'));
  }

  function getServerUrl() {
    return localStorage.getItem(LS_KEY) || DEFAULT_SERVER_URL;
  }

  function setServerUrl(url) {
    localStorage.setItem(LS_KEY, url || '');
  }

  function cacheApiData(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to cache API data for key:', key, err);
    }
  }

  function getCachedApiData(key) {
    try {
      var raw = localStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('Failed to read cached API data for key:', key, err);
      return null;
    }
  }

  function appendCachedListItem(key, item) {
    var current = getCachedApiData(key);
    var list = Array.isArray(current) ? current.slice() : [];
    list.unshift(item);
    cacheApiData(key, list);
    return list;
  }

  function replaceCachedListIfUseful(key, items) {
    var current = getCachedApiData(key);
    var currentList = Array.isArray(current) ? current : [];
    var nextList = Array.isArray(items) ? items : [];

    if (nextList.length === 0 && currentList.length > 0) {
      return currentList;
    }

    cacheApiData(key, nextList);
    return nextList;
  }

  function _updateIndicator(status) {
    var el = document.getElementById('connectivity-indicator');
    if (!el) return;

    el.classList.remove('online', 'pending', 'offline');
    el.classList.add(status);

    var label = el.querySelector('.connectivity-label');
    if (label) {
      var labels = { online: 'Online', pending: 'Pendente', offline: 'Offline' };
      label.textContent = labels[status] || 'Offline';
    }
  }

  function ping() {
    var base = getServerUrl();
    return fetch(base + '/api/ping', { method: 'GET' })
      .then(function (res) { return res.ok; })
      .catch(function () { return false; });
  }

  function syncAll() {
    var base = getServerUrl();

    return Promise.all(
      STORES.map(function (store) {
        return window.DB.getPending(store).then(function (items) {
          return items.map(function (item) {
            item._store = store;
            return item;
          });
        });
      })
    ).then(function (arrays) {
      var all = [];
      arrays.forEach(function (arr) { all = all.concat(arr); });
      all.sort(function (a, b) {
        return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
      });

      if (all.length === 0) {
        return { synced: [], errors: [] };
      }

      var payload = all.map(function (item) {
        return {
          id: item.id,
          type: item.type,
          data: item.data,
          created_at: item.created_at
        };
      });

      return fetch(base + '/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
      })
      .then(function (res) {
        if (!res.ok) throw new Error('Sync request failed: ' + res.status);
        return res.json();
      })
      .then(function (result) {
        var syncedIds = result.synced || [];
        var promises = [];

        all.forEach(function (item) {
          if (syncedIds.indexOf(item.id) !== -1) {
            promises.push(window.DB.markSynced(item._store, item.id));
          }
        });

        return Promise.all(promises)
          .then(function () {
            return Promise.all(
              STORES.map(function (store) { return window.DB.clearSynced(store); })
            );
          })
          .then(function () {
            window.dispatchEvent(new CustomEvent('app:data-changed'));
            return { synced: result.synced || [], errors: result.errors || [] };
          });
      });
    });
  }

  function _poll() {
    ping().then(function (reachable) {
      if (!reachable) {
        _updateIndicator('offline');
        _notifyConnectivityChanged();
        return;
      }

      return Promise.all(
        STORES.map(function (store) { return window.DB.getPending(store); })
      ).then(function (arrays) {
        var totalPending = 0;
        arrays.forEach(function (arr) { totalPending += arr.length; });

        if (totalPending === 0) {
          _updateIndicator('online');
          _notifyConnectivityChanged();
          return;
        }

        _updateIndicator('pending');
        _notifyConnectivityChanged();
        return syncAll().then(function () {
          _updateIndicator('online');
          _notifyConnectivityChanged();
        }).catch(function () {
          _updateIndicator('pending');
          _notifyConnectivityChanged();
        });
      });
    }).catch(function () {
      _updateIndicator('offline');
      _notifyConnectivityChanged();
    });
  }

  function start() {
    if (_intervalId) return;
    window.addEventListener('online', _poll);
    window.addEventListener('offline', _poll);
    _poll();
    _intervalId = setInterval(_poll, POLL_INTERVAL);
  }

  function stop() {
    if (_intervalId) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
    window.removeEventListener('online', _poll);
    window.removeEventListener('offline', _poll);
  }

  return {
    start: start,
    stop: stop,
    ping: ping,
    syncAll: syncAll,
    getServerUrl: getServerUrl,
    setServerUrl: setServerUrl,
    cacheApiData: cacheApiData,
    getCachedApiData: getCachedApiData,
    appendCachedListItem: appendCachedListItem,
    replaceCachedListIfUseful: replaceCachedListIfUseful
  };
})();

window.Sync = Sync;
