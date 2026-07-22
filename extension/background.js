const FLUX_URL = 'https://fluxiptv.qzz.io';

const CONTEXT_MENU = { es: 'Abrir en Flux IPTV', en: 'Open in Flux IPTV' };

function getLocale() {
  var lang = typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage
    ? chrome.i18n.getUILanguage()
    : 'es';
  return lang.startsWith('en') ? 'en' : 'es';
}

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: 'openInFlux',
    title: CONTEXT_MENU[getLocale()],
    contexts: ['link'],
    targetUrlPatterns: ['*://*/*.m3u*', '*://*/*.m3u8*']
  });
});

chrome.contextMenus.onClicked.addListener(function (info) {
  if (info.menuItemId === 'openInFlux' && info.linkUrl) {
    const targetUrl = FLUX_URL + '/?m3u=' + encodeURIComponent(info.linkUrl);

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
});
