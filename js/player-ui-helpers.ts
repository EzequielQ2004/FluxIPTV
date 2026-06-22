import { state } from './state.ts';
import { elements, hideLoading, showError } from './ui.ts';
import { t } from './i18n.ts';
import { getIsYoutubeMode, getIsEmbedMode } from './player-shared.ts';

export function updatePlayPauseButton() {
    if (getIsYoutubeMode() || getIsEmbedMode()) {
        if (state.isPlaying) {
            elements.playIcon!.classList.add('hidden');
            elements.pauseIcon!.classList.remove('hidden');
        } else {
            elements.playIcon!.classList.remove('hidden');
            elements.pauseIcon!.classList.add('hidden');
        }
    } else {
        const video = elements.video as HTMLVideoElement;
        if (video.paused) {
            elements.playIcon!.classList.remove('hidden');
            elements.pauseIcon!.classList.add('hidden');
        } else {
            elements.playIcon!.classList.add('hidden');
            elements.pauseIcon!.classList.remove('hidden');
        }
    }
}

export function autoKiosk() {
    if (state.kioskMode && !document.fullscreenElement) {
        elements.videoContainer!.requestFullscreen().catch(function () {});
    }
}

export function fallbackToNative(url: string) {
    const video = elements.video as HTMLVideoElement;
    video.src = url;
    video.play().catch((e: any) => {
        if (e.name === 'AbortError') return;
        console.error('Error en fallback:', e);
        hideLoading();
        showError(t('player.streamUnsupported'));
    });
}
