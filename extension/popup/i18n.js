const I18N = {
  es: {
    title: 'Flux IPTV',
    clipboardSuggestion: 'URL detectada en clipboard',
    emptyState: 'No hay listas guardadas',
    emptyHint: 'Agregá una URL de lista M3U abajo',
    urlPlaceholder: 'https://ejemplo.com/lista.m3u',
    namePlaceholder: 'Nombre (opcional)',
    add: 'Agregar',
    openFlux: 'Abrir Flux IPTV',
    noName: 'Sin nombre',
    channels: 'canales',
    delete: 'Eliminar',
    open: 'Abrir',
    errEmptyUrl: 'Ingresá una URL',
    errInvalidUrl: 'URL inválida',
    errWrongExt: 'La URL debe terminar en .m3u o .m3u8',
    errDuplicate: 'Ya tenés guardada esta lista',
    contextMenu: 'Abrir en Flux IPTV'
  },
  en: {
    title: 'Flux IPTV',
    clipboardSuggestion: 'URL detected in clipboard',
    emptyState: 'No saved playlists',
    emptyHint: 'Add an M3U playlist URL below',
    urlPlaceholder: 'https://example.com/list.m3u',
    namePlaceholder: 'Name (optional)',
    add: 'Add',
    openFlux: 'Open Flux IPTV',
    noName: 'Untitled',
    channels: 'channels',
    delete: 'Delete',
    open: 'Open',
    errEmptyUrl: 'Enter a URL',
    errInvalidUrl: 'Invalid URL',
    errWrongExt: 'URL must end in .m3u or .m3u8',
    errDuplicate: 'This playlist is already saved',
    contextMenu: 'Open in Flux IPTV'
  }
};

function getLocale() {
  var lang = (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getUILanguage)
    ? chrome.i18n.getUILanguage()
    : (navigator.language || 'es');
  return lang.startsWith('en') ? 'en' : 'es';
}

function t(key) {
  var locale = getLocale();
  return (I18N[locale] && I18N[locale][key]) || I18N.es[key] || key;
}
