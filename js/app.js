import { state, loadState } from './state.ts';
import { initI18n } from './i18n.ts';
import { applyTheme, renderHistory, elements, startSystemThemeListener } from './ui.ts';
import { setupEventListeners } from './events.ts';
import { updateVolumeSlider } from './player.js';
import { createLocalStorageProvider, setSyncProvider } from './sync.ts';

function init() {
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

    var kioskBtn = document.getElementById('kioskBtn');
    if (kioskBtn) kioskBtn.classList.toggle('active', state.kioskMode);
}

document.addEventListener('DOMContentLoaded', init);
