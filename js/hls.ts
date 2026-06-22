import Hls from 'hls.js';
import { state } from './state.ts';
import { showError, hideLoading } from './ui.ts';
import { t } from './i18n.ts';
import { fallbackToNative } from './player-ui-helpers.ts';
import {
    clearLoadTimeout,
    incHlsRetry,
    getHlsRetryCount,
    MAX_HLS_RETRIES,
    incNonFatalErrors,
    getNonFatalErrorCount,
    resetNonFatalErrors,
    setNonFatalErrorTimer,
    clearNonFatalErrorTimer
} from './player-shared.ts';
import { Channel } from './types.ts';

function setupHls(video: HTMLVideoElement, channel: Channel): void {
    var hlsConfig: any = {
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        manifestLoadingMaxRetry: 3,
        levelLoadingMaxRetry: 3,
        fragLoadingMaxRetry: 3
    };

    if (channel.referrer || channel.userAgent) {
        hlsConfig.xhrSetup = function (xhr: XMLHttpRequest, url: string): void {
            if (channel.referrer) {
                xhr.setRequestHeader('Referer', channel.referrer);
            }
        };
    }

    state.hls = new Hls(hlsConfig);
    state.hls.loadSource(channel.url);
    state.hls.attachMedia(video);

    state.hls.on(Hls.Events.MANIFEST_PARSED, function () {
        video.play().catch(function (e) {
            if (e.name === 'AbortError') return;
            console.error('Error al reproducir:', e);
            clearLoadTimeout();
            hideLoading();
            showError(t('player.streamBlocked'));
        });
    });

    state.hls.on(Hls.Events.FRAG_LOADED, function () {
        clearLoadTimeout();
        resetNonFatalErrors();
        clearNonFatalErrorTimer();
    });

    state.hls.on(Hls.Events.ERROR, function (event: any, data: any) {
        if (data.fatal) {
            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    if (getHlsRetryCount() < MAX_HLS_RETRIES) {
                        console.error('Error de red, recuperando... (intento ' + (getHlsRetryCount() + 1) + '/' + MAX_HLS_RETRIES + ')');
                        incHlsRetry();
                        state.hls.startLoad();
                    } else {
                        console.error('Demasiados errores de red, abandonando');
                        state.hls.destroy();
                        hideLoading();
                        showError(t('player.streamTooManyErrors'));
                    }
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                    console.error('Error de media, recuperando...');
                    state.hls.recoverMediaError();
                    break;
                default:
                    console.error('Error fatal, intentando fallback...');
                    state.hls.destroy();
                    fallbackToNative(channel.url);
                    break;
            }
        } else {
            if (getNonFatalErrorCount() > 8) {
                console.error('Demasiados errores no-fatales, abandonando');
                state.hls.destroy();
                hideLoading();
                showError(t('player.streamTooManyErrors'));
            } else {
                incNonFatalErrors();
                clearNonFatalErrorTimer();
                setNonFatalErrorTimer(setTimeout(function () {
                    resetNonFatalErrors();
                }, 10000));
            }
        }
    });
}

export { setupHls };
