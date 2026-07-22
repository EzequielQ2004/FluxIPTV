const FLUX_URL = 'https://fluxiptv.qzz.io';

let playlists = [];
let clipboardUrl = '';

document.addEventListener('DOMContentLoaded', function () {
  applyTranslations();
  loadPlaylists();
  document.getElementById('addBtn').addEventListener('click', addPlaylist);
  document.getElementById('urlInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') addPlaylist();
  });
  document.getElementById('suggestionAdd').addEventListener('click', acceptClipboard);
  document.getElementById('suggestionDismiss').addEventListener('click', dismissClipboard);
  checkClipboard();
});

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

function loadPlaylists() {
  chrome.storage.sync.get('playlists', function (data) {
    playlists = data.playlists || [];
    renderPlaylists();
  });
}

function renderPlaylists() {
  const list = document.getElementById('playlistList');
  const empty = document.getElementById('emptyState');

  list.innerHTML = '';

  if (playlists.length === 0) {
    list.appendChild(empty);
    return;
  }

  playlists.forEach(function (p, i) {
    const item = document.createElement('div');
    item.className = 'playlist-item';

    const info = document.createElement('div');
    info.className = 'info';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = p.name || t('noName');

    const url = document.createElement('div');
    url.className = 'url';
    url.textContent = p.url;

    const channels = document.createElement('div');
    channels.className = 'channels';
    channels.textContent = p.channelCount ? p.channelCount + ' ' + t('channels') : '';

    info.appendChild(name);
    info.appendChild(url);
    info.appendChild(channels);

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '\u00d7';
    del.title = t('delete');
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      removePlaylist(i);
    });

    item.appendChild(info);
    item.appendChild(del);

    item.addEventListener('click', function () {
      openPlaylist(p.url, p.name);
    });

    list.appendChild(item);
  });
}

function checkClipboard() {
  readClipboardAsync().then(function (text) {
    processClipboardText(text);
  }).catch(function (err) {
    console.warn('Flux: clipboard read failed', err);
  });
}

function readClipboardAsync() {
  return new Promise(function (resolve, reject) {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      reject(new Error('Clipboard API not available'));
      return;
    }
    navigator.clipboard.readText().then(function (text) {
      resolve(text);
    }).catch(function (err) {
      console.warn('Flux: clipboard.readText failed', err);
      reject(err);
    });
  });
}

function processClipboardText(text) {
  if (!text) return;
  var url = text.trim();
  try { new URL(url); } catch (_) { return; }
  if (!url.match(/\.m3u8?$/i)) return;

  clipboardUrl = url;

  var suggestion = document.getElementById('suggestion');
  var urlEl = document.getElementById('suggestionUrl');
  urlEl.textContent = url;
  suggestion.classList.remove('hidden');

  var existing = playlists.findIndex(function (p) { return p.url === url; });
  var addBtn = document.getElementById('suggestionAdd');
  addBtn.textContent = existing >= 0 ? t('open') : t('add');
}

function acceptClipboard() {
  if (!clipboardUrl) return;

  var existing = playlists.findIndex(function (p) { return p.url === clipboardUrl; });
  if (existing >= 0) {
    openPlaylist(clipboardUrl, playlists[existing].name);
    return;
  }

  playlists.push({
    url: clipboardUrl,
    name: '',
    channelCount: 0,
    addedAt: new Date().toISOString()
  });
  savePlaylists();
  renderPlaylists();
  openPlaylist(clipboardUrl, '');
  dismissClipboard();
}

function dismissClipboard() {
  clipboardUrl = '';
  document.getElementById('suggestion').classList.add('hidden');
}

function addPlaylist() {
  const urlInput = document.getElementById('urlInput');
  const nameInput = document.getElementById('nameInput');
  const errorEl = document.getElementById('errorMsg');
  const url = urlInput.value.trim();
  const name = nameInput.value.trim();

  errorEl.textContent = '';

  if (!url) {
    errorEl.textContent = t('errEmptyUrl');
    return;
  }

  try {
    new URL(url);
  } catch (_) {
    errorEl.textContent = t('errInvalidUrl');
    return;
  }

  if (!url.match(/\.m3u8?$/i)) {
    errorEl.textContent = t('errWrongExt');
    return;
  }

  const existing = playlists.findIndex(function (p) { return p.url === url; });
  if (existing >= 0) {
    errorEl.textContent = t('errDuplicate');
    return;
  }

  const playlist = {
    url: url,
    name: name || '',
    channelCount: 0,
    addedAt: new Date().toISOString()
  };

  playlists.push(playlist);
  savePlaylists();
  renderPlaylists();

  urlInput.value = '';
  nameInput.value = '';
  urlInput.focus();

  openPlaylist(url, name);
}

function removePlaylist(index) {
  playlists.splice(index, 1);
  savePlaylists();
  renderPlaylists();
}

function savePlaylists() {
  chrome.storage.sync.set({ playlists: playlists });
}

function openPlaylist(url, name) {
  const targetUrl = FLUX_URL + '/?m3u=' + encodeURIComponent(url);

  chrome.tabs.query({}, function (tabs) {
    var fluxTab = null;
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].url && tabs[i].url.indexOf(FLUX_URL) === 0) {
        fluxTab = tabs[i];
        break;
      }
    }
    if (fluxTab) {
      chrome.tabs.update(fluxTab.id, { url: targetUrl, active: true });
      chrome.windows.update(fluxTab.windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: targetUrl });
    }
  });
}
