import { state } from './state.ts';
import { elements, showLoading, hideLoading, showError } from './ui.ts';
import { t } from './i18n.ts';
import { clearLoadTimeout, setIsEmbedMode, getIsEmbedMode } from './player-shared.ts';
import { updatePlayPauseButton, autoKiosk } from './player-ui-helpers.ts';
import { Channel } from './types.ts';

var embedIframe: HTMLIFrameElement | null = null;
var currentEmbedType: string | null = null;

function isTwitchUrl(url: string): boolean {
    if (!url) return false;
    return /twitch\.tv/i.test(url);
}

function isDailymotionUrl(url: string): boolean {
    if (!url) return false;
    return /dailymotion\.com/i.test(url);
}

function extractTwitchChannel(url: string): string | null {
    if (!url) return null;
    var match = url.match(/[?&]channel=([^&]+)/);
    if (match) return match[1];
    match = url.match(/(?:twitch\.tv\/)([a-zA-Z0-9_]+)/i);
    if (match) return match[1];
    return null;
}

function extractDailymotionId(url: string): string | null {
    if (!url) return null;
    var match = url.match(/dailymotion\.com\/(?:embed\/)?video\/([a-zA-Z0-9]+)/i);
    if (match) return match[1];
    return null;
}

function playTwitchChannel(channel: Channel): void {
    if (!elements.embedContainer || !elements.embedPlayer) {
        console.error('Embed container not found in DOM');
        hideLoading();
        showError(t('player.embedContainerNotFound'));
        return;
    }

    var twitchChannel = extractTwitchChannel(channel.url);
    if (!twitchChannel) {
        hideLoading();
        showError(t('player.twitchExtractError'));
        return;
    }

    setIsEmbedMode(true);
    currentEmbedType = 'twitch';
    (elements.video as HTMLElement).style.display = 'none';
    elements.embedContainer.classList.remove('hidden');
    elements.embedPlayer.innerHTML = '';

    var parent = window.location.hostname || 'localhost';
    var iframe = document.createElement('iframe');
    iframe.src = 'https://player.twitch.tv/?channel=' + encodeURIComponent(twitchChannel) +
        '&parent=' + encodeURIComponent(parent) + '&autoplay=true';
    iframe.allow = 'autoplay; encrypted-media; fullscreen';
    iframe.allowFullscreen = true;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    elements.embedPlayer.appendChild(iframe);
    embedIframe = iframe;

    clearLoadTimeout();
    hideLoading();
    state.isPlaying = true;
    updatePlayPauseButton();
    autoKiosk();
}

function playDailymotionChannel(channel: Channel): void {
    if (!elements.embedContainer || !elements.embedPlayer) {
        console.error('Embed container not found in DOM');
        hideLoading();
        showError(t('player.embedContainerNotFound'));
        return;
    }

    var videoId = extractDailymotionId(channel.url);
    if (!videoId) {
        hideLoading();
        showError(t('player.dailymotionExtractError'));
        return;
    }

    setIsEmbedMode(true);
    currentEmbedType = 'dailymotion';
    (elements.video as HTMLElement).style.display = 'none';
    elements.embedContainer.classList.remove('hidden');
    elements.embedPlayer.innerHTML = '';

    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.dailymotion.com/embed/video/' + encodeURIComponent(videoId) +
        '?autoplay=1&ui-highlight=0088cc&ui-logo=false';
    iframe.allow = 'autoplay; encrypted-media; fullscreen';
    iframe.allowFullscreen = true;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    elements.embedPlayer.appendChild(iframe);
    embedIframe = iframe;

    clearLoadTimeout();
    hideLoading();
    state.isPlaying = true;
    updatePlayPauseButton();
    autoKiosk();
}

function destroyEmbedPlayer(): void {
    if (embedIframe) {
        embedIframe.src = '';
        embedIframe.remove();
        embedIframe = null;
    }
    elements.embedPlayer!.innerHTML = '';
    elements.embedContainer!.classList.add('hidden');
    setIsEmbedMode(false);
    currentEmbedType = null;
}

export {
    embedIframe, currentEmbedType, getIsEmbedMode,
    isTwitchUrl, isDailymotionUrl,
    playTwitchChannel, playDailymotionChannel, destroyEmbedPlayer
};
