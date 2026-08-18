import { state, loadState } from './state.ts';
import { initI18n } from './i18n.ts';
import { applyTheme, elements, startSystemThemeListener, showView, renderViewLists } from './ui.ts';
import { setupEventListeners } from './events.ts';
import { updateVolumeSlider } from './player-core.ts';
import { createLocalStorageProvider, setSyncProvider } from './backup.ts';
import { loadM3UFromUrl } from './loader.ts';

function init(): void {
    loadState();
    showView('lists');
    renderViewLists();
    initI18n();
    setupEventListeners();
    startSystemThemeListener();
    applyTheme();
    if (elements.video) {
        elements.video.volume = state.volume;
    }
    updateVolumeSlider();

    setSyncProvider(createLocalStorageProvider());

    if (state.kioskMode) document.body.classList.add('tv-mode');

    const params = new URLSearchParams(window.location.search);
    const m3uUrl = params.get('m3u');
    if (m3uUrl) {
        loadM3UFromUrl(decodeURIComponent(m3uUrl));
    }
}

document.addEventListener('DOMContentLoaded', init);
