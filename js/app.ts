import { state, loadState } from './state.ts';
import { initI18n } from './i18n.ts';
import { applyTheme, renderHistory, elements, startSystemThemeListener } from './ui.ts';
import { setupEventListeners } from './events.ts';
import { updateVolumeSlider } from './player-core.ts';
import { createLocalStorageProvider, setSyncProvider } from './sync.ts';
import { loadM3UFromUrl } from './loader.ts';

function init(): void {
    loadState();
    initI18n();
    setupEventListeners();
    startSystemThemeListener();
    applyTheme();
    renderHistory();
    if (elements.video) {
        elements.video.volume = state.volume;
    }
    updateVolumeSlider();

    setSyncProvider(createLocalStorageProvider());

    const kioskBtn = document.getElementById('kioskBtn');
    if (kioskBtn) kioskBtn.classList.toggle('active', state.kioskMode);

    const params = new URLSearchParams(window.location.search);
    const m3uUrl = params.get('m3u');
    if (m3uUrl) {
        loadM3UFromUrl(decodeURIComponent(m3uUrl));
    }
}

document.addEventListener('DOMContentLoaded', init);
