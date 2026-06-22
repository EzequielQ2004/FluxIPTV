import Hls from 'hls.js';
import dashjs from 'dashjs';
import { state, saveState, addToHistory, verifyPin, setPin, removePin, setPinContext, getPinContext } from './state.ts';
import { elements, updateActiveChannel, scrollToChannel, renderHistory, showLoading, hideLoading, showError, hideError, openModal, closeModal, showToast, updateLockBtn } from './ui.ts';
import { escapeHtml } from './fallback-image.ts';
import { loadM3UFromUrl } from './loader.ts';
import { openSettings } from './settings.ts';
import { t } from './i18n.ts';
import {
    setLoadTimeout,
    resetHlsRetry,
    resetNonFatalErrors,
    clearNonFatalErrorTimer,
    getIsYoutubeMode,
    getIsEmbedMode
} from './player-shared.ts';
import { updatePlayPauseButton, autoKiosk, fallbackToNative } from './player-ui-helpers.ts';
import { isYoutubeUrl, playYoutubeChannel, destroyYoutubePlayer, sendYtCommand, ytPlayer, isChannelLiveMode, channelLiveIframe } from './youtube.js';
import { isTwitchUrl, isDailymotionUrl, playTwitchChannel, playDailymotionChannel, embedIframe, currentEmbedType } from './embeds.js';
import { setupHls } from './hls.js';
import { setupDash, dashManifestLoaded, dashError } from './dash.js';

var streamTypeCache = new Map();
var streamTypeController = null;

function probeStreamType(url) {
    if (streamTypeCache.has(url)) {
        return Promise.resolve(streamTypeCache.get(url));
    }
    if (streamTypeController) {
        streamTypeController.abort();
    }
    streamTypeController = new AbortController();
    var signal = streamTypeController.signal;
    var timeout = setTimeout(function () {
        streamTypeController.abort();
    }, 5000);
    return fetch(url, { method: 'HEAD', signal: signal }).then(function (resp) {
        clearTimeout(timeout);
        var type = resp.headers.get('Content-Type') || '';
        var result = 'unknown';
        if (/application\/vnd\.apple\.mpegurl/i.test(type) || /application\/x-mpegURL/i.test(type)) {
            result = 'hls';
        } else if (/application\/dash\+xml/i.test(type)) {
            result = 'dash';
        }
        streamTypeCache.set(url, result);
        return result;
    }).catch(function () {
        clearTimeout(timeout);
        streamTypeCache.set(url, 'unknown');
        return 'unknown';
    });
}

function playChannel(index, skipLockCheck) {
    if (index < 0 || index >= state.channels.length) return;

    const channel = state.channels[index];

    if (!skipLockCheck && state.lockedChannels.has(index)) {
        state.pendingChannelIndex = index;
        setPinContext('play');
        document.getElementById('pinModalTitle').textContent = t('player.pin.playTitle');
        document.getElementById('pinModalMessage').textContent = t('player.pin.playMessage');
        document.getElementById('pinConfirmInput').style.display = 'none';
        document.getElementById('pinInput').value = '';
        document.getElementById('pinInput').placeholder = 'PIN';
        document.getElementById('confirmPinBtn').textContent = t('player.pin.playBtn');
        openModal(elements.pinModal);
        document.getElementById('pinInput').focus();
        return;
    }

    if ((channel.url.endsWith('.m3u') || channel.url.endsWith('.m3u?')) && !channel.url.endsWith('.m3u8')) {
        showToast(t('player.loadingNested') + channel.name, '');
        loadM3UFromUrl(channel.url, channel.name).then(function () {
            if (state.channels.length > 0) playChannel(0);
        });
        return;
    }

    state.currentChannelIndex = index;
    addToHistory(channel);

    var hlsRetryCount_ = 0;
    setLoadTimeout(null);
    resetHlsRetry();
    resetNonFatalErrors();
    clearNonFatalErrorTimer();
    showLoading(true);
    hideError();

    setLoadTimeout(setTimeout(() => {
        if (state.hls) {
            state.hls.destroy();
            state.hls = null;
        }
        hideLoading();
        showError(t('player.streamTimeout'));
    }, 20000));

    if (state.hls) {
        state.hls.destroy();
        state.hls = null;
    }
    if (state.dash) {
        try {
            state.dash.off(dashjs.MediaPlayer.events.MANIFEST_LOADED, dashManifestLoaded);
            state.dash.off(dashjs.MediaPlayer.events.ERROR, dashError);
        } catch (e) {}
        state.dash.reset();
        state.dash = null;
    }

    destroyYoutubePlayer();

    if (isYoutubeUrl(channel.url)) {
        console.log('YouTube channel detected:', channel.url);
        playYoutubeChannel(channel);
        updateActiveChannel(channel.index);
        scrollToChannel(channel.index);
        renderHistory();
        updatePlayPauseButton();
        return;
    }

    console.log('checking twitch for url:', channel.url, 'result:', isTwitchUrl(channel.url));
    if (isTwitchUrl(channel.url)) {
        console.log('Twitch channel detected:', channel.url);
        playTwitchChannel(channel);
        updateActiveChannel(channel.index);
        scrollToChannel(channel.index);
        renderHistory();
        updatePlayPauseButton();
        return;
    }

    console.log('checking dailymotion for url:', channel.url, 'result:', isDailymotionUrl(channel.url));
    if (isDailymotionUrl(channel.url)) {
        console.log('Dailymotion channel detected:', channel.url);
        playDailymotionChannel(channel);
        updateActiveChannel(channel.index);
        scrollToChannel(channel.index);
        renderHistory();
        updatePlayPauseButton();
        return;
    }

    const video = elements.video;
    video.volume = state.volume;
    video.muted = state.isMuted;

    if (isDashUrl(channel.url)) {
        console.log('DASH stream detected:', channel.url);
        setupDash(video, channel);
    } else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        setupHls(video, channel);
    } else {
        probeStreamType(channel.url).then(function (probeType) {
            if (probeType === 'hls' && typeof Hls !== 'undefined' && Hls.isSupported()) {
                setupHls(video, channel);
            } else if (probeType === 'dash' && typeof dashjs !== 'undefined') {
                setupDash(video, channel);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = channel.url;
                video.play().catch(function (e) {
                    if (e.name === 'AbortError') return;
                    console.error('Error al reproducir:', e);
                    hideLoading();
                    showError(t('player.streamFailed'));
                });
            } else {
                fallbackToNative(channel.url);
            }
        }).catch(function () {
            fallbackToNative(channel.url);
        });
    }

    video.addEventListener('playing', function () {
        autoKiosk();
    }, { once: true });

    updateActiveChannel(channel.index);
    scrollToChannel(channel.index);
    renderHistory();
    updatePlayPauseButton();
}

function isDashUrl(url) {
    if (!url) return false;
    return /\.(?:mpd|dash)(?:$|[?#])/i.test(url) || /format=mpd-time/i.test(url);
}

function togglePlayPause() {
    if (getIsYoutubeMode() && ytPlayer) {
        state.isPlaying = !state.isPlaying;
        if (state.isPlaying) {
            ytPlayer.playVideo();
        } else {
            ytPlayer.pauseVideo();
        }
    } else if (isChannelLiveMode && channelLiveIframe) {
        state.isPlaying = !state.isPlaying;
        sendYtCommand(state.isPlaying ? 'playVideo' : 'pauseVideo');
    } else if (getIsEmbedMode() && embedIframe) {
        state.isPlaying = !state.isPlaying;
        try {
            embedIframe.contentWindow.postMessage(JSON.stringify(
                currentEmbedType === 'twitch'
                    ? { play: state.isPlaying }
                    : { command: state.isPlaying ? 'play' : 'pause' }
            ), getOrigin(embedIframe));
        } catch (e) {
            console.error('Error al enviar comando al embed:', e);
        }
    } else {
        const video = elements.video;
        if (video.paused) {
            video.play().catch(function(e) {
                if (e.name === 'AbortError') return;
                console.error('Error al reproducir:', e);
            });
            state.isPlaying = true;
        } else {
            video.pause();
            state.isPlaying = false;
        }
    }

    updatePlayPauseButton();
}

function getOrigin(iframe) {
    try {
        return new URL(iframe.src).origin;
    } catch (e) {
        return '*';
    }
}

function toggleMute() {
    state.isMuted = !state.isMuted;

    if (getIsYoutubeMode() && ytPlayer) {
        if (state.isMuted) {
            ytPlayer.mute();
        } else {
            ytPlayer.unMute();
            ytPlayer.setVolume(state.volume * 100);
        }
    } else if (isChannelLiveMode && channelLiveIframe) {
        sendYtCommand(state.isMuted ? 'mute' : 'unMute');
    } else if (getIsEmbedMode() && embedIframe) {
        try {
            embedIframe.contentWindow.postMessage(JSON.stringify(
                currentEmbedType === 'twitch'
                    ? { volume: state.isMuted ? 0 : state.volume }
                    : { command: state.isMuted ? 'mute' : 'unmute' }
            ), getOrigin(embedIframe));
        } catch (e) {
            console.error('Error al enviar comando de mute al embed:', e);
        }
    } else {
        elements.video.muted = state.isMuted;
        if (!state.isMuted) {
            elements.video.volume = state.volume;
        }
    }

    if (state.isMuted) {
        elements.volumeIcon.classList.add('hidden');
        elements.muteIcon.classList.remove('hidden');
    } else {
        elements.volumeIcon.classList.remove('hidden');
        elements.muteIcon.classList.add('hidden');
    }
    updateVolumeSlider();
}

function setVolume(volume) {
    state.volume = volume;
    if (state.isMuted) {
        state.isMuted = false;
        elements.video.muted = false;
        elements.volumeIcon.classList.remove('hidden');
        elements.muteIcon.classList.add('hidden');
    }
    if (getIsYoutubeMode() && ytPlayer) {
        ytPlayer.setVolume(volume * 100);
    } else {
        elements.video.volume = volume;
    }
    updateVolumeSlider();
}

function updateVolumeSlider() {
    if (state.isMuted) {
        elements.volumeSlider.value = 0;
    } else {
        elements.volumeSlider.value = state.volume;
    }
}

function toggleFullscreen() {
    const container = elements.videoContainer;

    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(e => console.error('Error al entrar en fullscreen:', e));
    } else {
        document.exitFullscreen();
    }
}

function toggleKioskMode() {
    state.kioskMode = !state.kioskMode;
    var msg = state.kioskMode ? t('player.kioskOn') : t('player.kioskOff');
    showToast(msg, '');
    var btn = document.getElementById('kioskBtn');
    if (btn) btn.classList.toggle('active', state.kioskMode);
}

function togglePiP() {
    if (getIsYoutubeMode() || getIsEmbedMode()) {
        showError(t('player.pipUnavailable'));
        return;
    }

    const video = elements.video;

    if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
    } else if (video.readyState >= 1) {
        video.requestPictureInPicture().catch(e => console.error('Error al activar PiP:', e));
    }
}

function nextChannel() {
    if (state.channels.length === 0) return;

    let nextIndex = state.currentChannelIndex + 1;
    if (nextIndex >= state.channels.length) {
        nextIndex = 0;
    }

    playChannel(nextIndex);
}

function prevChannel() {
    if (state.channels.length === 0) return;

    let prevIndex = state.currentChannelIndex - 1;
    if (prevIndex < 0) {
        prevIndex = state.channels.length - 1;
    }

    playChannel(prevIndex);
}

async function onVerifyPin() {
    var inputPin = elements.pinInput.value;
    var ctx = getPinContext();

    if (ctx === 'set-lock') {
        var confirmPin = document.getElementById('pinConfirmInput').value;
        if (inputPin.length !== 4 || !/^\d{4}$/.test(inputPin)) {
            showToast(t('player.pin.invalidLength'), 'error');
            elements.pinInput.focus();
            return;
        }
        if (inputPin !== confirmPin) {
            showToast(t('player.pin.mismatch'), 'error');
            document.getElementById('pinConfirmInput').value = '';
            document.getElementById('pinConfirmInput').focus();
            return;
        }
        await setPin(inputPin);
        closeModal(elements.pinModal);
        elements.pinInput.value = '';
        document.getElementById('pinConfirmInput').value = '';
        state.lockedChannels.add(state.pendingChannelIndex);
        saveState();
        updateLockBtn(state.pendingChannelIndex);
        state.pendingChannelIndex = null;
        showToast(t('player.pin.configured'));
        return;
    }

    var ok = await verifyPin(inputPin);
    if (!ok) {
        elements.pinInput.value = '';
        elements.pinInput.focus();
        showToast(t('player.pin.incorrect'), 'error');
        return;
    }

    closeModal(elements.pinModal);
    elements.pinInput.value = '';
    var idx = state.pendingChannelIndex;
    state.pendingChannelIndex = null;

    if (ctx === 'play' && idx !== null) {
        playChannel(idx, true);
    } else if (ctx === 'unlock' && idx !== null) {
        state.lockedChannels.delete(idx);
        saveState();
        updateLockBtn(idx);
        showToast(t('player.pin.unlocked'));
    } else if (ctx === 'remove-pin') {
        state.lockedChannels.clear();
        saveState();
        removePin();
        showToast(t('player.pin.removed'));
        openSettings();
    }
}

export {
    playChannel,
    togglePlayPause,
    updatePlayPauseButton,
    updateVolumeSlider,
    toggleMute,
    setVolume,
    toggleFullscreen,
    toggleKioskMode,
    togglePiP,
    nextChannel,
    prevChannel,
    onVerifyPin as verifyPin
};
