const FLUX_URL = 'https://fluxiptv.qzz.io';

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: 'openInFlux',
    title: 'Abrir en Flux IPTV',
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
