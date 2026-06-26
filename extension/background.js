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

    chrome.tabs.query({ url: FLUX_URL + '/*' }, function (tabs) {
      if (tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { url: targetUrl, active: true });
        chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        chrome.tabs.create({ url: targetUrl });
      }
    });
  }
});
