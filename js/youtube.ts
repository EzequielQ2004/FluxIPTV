declare var YT: any;

import { state } from './state.ts';
import { elements, showLoading, hideLoading, showError } from './ui.ts';
import { escapeHtml } from './fallback-image.ts';
import { t } from './i18n.ts';
import { clearLoadTimeout, setIsYoutubeMode } from './player-shared.ts';
import { updatePlayPauseButton, autoKiosk } from './player-ui-helpers.ts';
import { destroyEmbedPlayer } from './embeds.ts';
import { Channel } from './types.ts';

var ytPlayer: any = null;
var ytReady: boolean = false;
var pendingVideoId: string | null = null;
var isChannelLiveMode: boolean = false;
var channelLiveIframe: HTMLIFrameElement | null = null;
var videoIdListener: any = null;
var youtubeApiLoading: boolean = false;
var youtubeApiReady: boolean = false;
var youtubeApiCallbacks: (() => void)[] = [];

function isYoutubeUrl(url: string): boolean {
    if (!url) return false;
    return /(?:youtube\.com|youtu\.be|youtube-nocookie\.com|y2u\.be)/i.test(url);
}

function extractYoutubeId(url: string): string | null {
    if (!url) return null;
    const patterns = [
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /y2u\.be\/([a-zA-Z0-9_-]{11})/,
        /(?:youtube|youtube-nocookie)\.com\/(?:watch\?v=|live\/|embed\/|shorts\/|v\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube|youtube-nocookie)\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
        const match = url.match(p);
        if (match) return match[1];
    }
    return null;
}

function extractChannelId(url: string): string | null {
    if (!url) return null;
    var match = url.match(/\/channel\/(UC[a-zA-Z0-9_-]{21,25})/);
    if (match) return match[1];
    match = url.match(/\/@([a-zA-Z0-9_-]+)(?:\/live)?(?:\/)?$/);
    if (match) return 'youtube_handle:' + match[1];
    match = url.match(/\/c\/([a-zA-Z0-9_-]+)(?:\/live)?(?:\/)?$/);
    if (match) return 'youtube_c:' + match[1];
    match = url.match(/\/user\/([a-zA-Z0-9_-]+)(?:\/live)?(?:\/)?$/);
    if (match) return 'youtube_user:' + match[1];
    return null;
}

function extractLiveVideoId(html: string): string | null {
    var m = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});\s*\n/);
    if (m) {
        try {
            var data = JSON.parse(m[1]);
            if (data && data.videoDetails && data.videoDetails.videoId) {
                return data.videoDetails.videoId;
            }
            if (data && data.args && data.args.videoId) {
                return data.args.videoId;
            }
        } catch (e) {}
    }
    m = html.match(/<link\s+rel="canonical"\s+href="[^"]*\/(?:watch\?v=|embed\/)([a-zA-Z0-9_-]{11})"/);
    if (m) return m[1];
    m = html.match(/<meta\s+property="og:video:url"\s+content="[^"]*\/(?:watch\?v=|embed\/)([a-zA-Z0-9_-]{11})"/);
    if (m) return m[1];
    m = html.match(/<meta\s+property="og:url"\s+content="[^"]*\/(?:watch\?v=|embed\/)([a-zA-Z0-9_-]{11})"/);
    if (m) return m[1];
    return null;
}

function resolveChannelViaProxy(channelId: string, callback: (videoId: string | null) => void): void {
    var proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?url='
    ];
    var channelUrl = 'https://www.youtube.com/channel/' + channelId + '/live';
    var tried = 0;

    function tryNext() {
        if (tried >= proxies.length) {
            callback(null);
            return;
        }
        var proxy = proxies[tried++];
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 8000);
        fetch(proxy + encodeURIComponent(channelUrl), { signal: controller.signal })
            .then(function (r) { return r.text(); })
            .then(function (html) {
                clearTimeout(timer);
                var videoId = extractLiveVideoId(html);
                if (videoId) {
                    callback(videoId);
                } else {
                    tryNext();
                }
            })
            .catch(function () {
                clearTimeout(timer);
                tryNext();
            });
    }

    tryNext();
}

function extractVideoIdFromOembed(data: any): string | null {
    if (!data) return null;
    if (data.thumbnail_url) {
        var m = data.thumbnail_url.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);
        if (m) return m[1];
    }
    if (data.html) {
        var m = data.html.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        if (m) return m[1];
    }
    if (data.video_id) return data.video_id;
    return null;
}

function resolveYoutubeLiveUrl(youtubeUrl: string, callback: (videoId: string | null) => void): void {
    var tried = 0;
    var methods: ((next: () => void) => void)[] = [];

    methods.push(function (next: () => void) {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); next(); }, 8000);
        fetch('https://noembed.com/embed?url=' + encodeURIComponent(youtubeUrl), { signal: controller.signal })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                clearTimeout(timer);
                var id = extractVideoIdFromOembed(data);
                if (id) callback(id);
                else next();
            })
            .catch(function () { clearTimeout(timer); next(); });
    });

    var proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?url='
    ];
    for (var p = 0; p < proxies.length; p++) {
        (function (proxyUrl) {
            methods.push(function (next: () => void) {
                var controller = new AbortController();
                var timer = setTimeout(function () { controller.abort(); next(); }, 8000);
                fetch(proxyUrl + encodeURIComponent(youtubeUrl), { signal: controller.signal })
                    .then(function (r) { return r.text(); })
                    .then(function (html) {
                        clearTimeout(timer);
                        var videoId = extractLiveVideoId(html);
                        if (videoId) callback(videoId);
                        else next();
                    })
                    .catch(function () { clearTimeout(timer); next(); });
            });
        })(proxies[p]);
    }

    methods.push(function (next: () => void) {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); next(); }, 8000);
        fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(youtubeUrl) + '&format=json', { signal: controller.signal })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                clearTimeout(timer);
                var id = extractVideoIdFromOembed(data);
                if (id) callback(id);
                else next();
            })
            .catch(function () { clearTimeout(timer); next(); });
    });

    function tryNext() {
        if (tried >= methods.length) {
            callback(null);
            return;
        }
        methods[tried++](tryNext);
    }

    tryNext();
}

function loadYouTubeAPI(callback: () => void): void {
    if (typeof YT !== 'undefined' && YT.Player) {
        youtubeApiReady = true;
        callback();
        return;
    }

    youtubeApiCallbacks.push(callback);

    if (youtubeApiLoading) return;
    youtubeApiLoading = true;

    (window as any).onYouTubeIframeAPIReady = function () {
        youtubeApiReady = true;
        const cbs = youtubeApiCallbacks.slice();
        youtubeApiCallbacks = [];
        for (const cb of cbs) cb();
    };

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = function () {
        youtubeApiLoading = false;
        youtubeApiCallbacks = [];
        hideLoading();
        showError(t('player.youtubeLoadError'));
    };
    document.body.appendChild(tag);
}

function onYouTubeReady(): void {
    ytReady = true;
    if (pendingVideoId && ytPlayer && ytPlayer.loadVideoById) {
        ytPlayer.loadVideoById(pendingVideoId);
        pendingVideoId = null;
    }
    clearLoadTimeout();
    hideLoading();
    updatePlayPauseButton();
    if (state.isMuted && ytPlayer) ytPlayer.mute();
}

function onYouTubeStateChange(e: any): void {
    if (e.data === YT.PlayerState.PLAYING) {
        state.isPlaying = true;
        clearLoadTimeout();
        hideLoading();
        autoKiosk();
    } else if (e.data === YT.PlayerState.PAUSED) {
        state.isPlaying = false;
    } else if (e.data === YT.PlayerState.BUFFERING) {
        showLoading(true);
    } else if (e.data === YT.PlayerState.CUED) {
        hideLoading();
    }
    updatePlayPauseButton();
}

function onYouTubeError(e: any): void {
    console.error('YouTube error:', e);
    clearLoadTimeout();
    hideLoading();
    const messages: Record<string, string> = {};
    messages[2] = t('player.youtubeInvalidParam');
    messages[5] = t('player.youtubeHtml5Error');
    messages[100] = t('player.youtubeNotFound');
    messages[101] = t('player.youtubeNotAllowed');
    messages[150] = t('player.youtubeNotAllowed');
    showError(t('player.youtubeError') + (messages[e.data as string] || t('player.youtubeUnknown') + ' (' + e.data + ')'));
}

function getOrigin(iframe: HTMLIFrameElement): string {
    try {
        return new URL(iframe.src).origin;
    } catch (e) {
        return '*';
    }
}

function sendYtCommand(command: string): void {
    if (channelLiveIframe && channelLiveIframe.contentWindow) {
        channelLiveIframe.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: command,
            args: ''
        }), getOrigin(channelLiveIframe));
    }
}

function playYoutubeChannel(channel: Channel): void {
    var videoId = extractYoutubeId(channel.url);
    var channelId = videoId ? null : extractChannelId(channel.url);

    if (!videoId && !channelId) {
        hideLoading();
        showError(t('player.youtubeExtractError'));
        return;
    }

    if (channelId && (channelId.indexOf('youtube_handle:') === 0 || channelId.indexOf('youtube_c:') === 0 || channelId.indexOf('youtube_user:') === 0)) {
        setIsYoutubeMode(true);
        isChannelLiveMode = true;
        (elements.video as HTMLElement).style.display = 'none';
        elements.youtubeContainer!.classList.remove('hidden');
        document.getElementById('youtubePlayer')!.innerHTML = '';
        showLoading(true);

        var prefix;
        if (channelId.indexOf('youtube_handle:') === 0) prefix = '@';
        else if (channelId.indexOf('youtube_c:') === 0) prefix = 'c/';
        else prefix = 'user/';
        var handleName = channelId.split(':')[1];
        var channelUrl = 'https://www.youtube.com/' + prefix + handleName + '/live';

        resolveYoutubeLiveUrl(channelUrl, function (resolvedId) {
            if (resolvedId && resolvedId.length === 11) {
                hideLoading();
                loadYouTubeAPI(function () {
                    try {
                        if (ytPlayer) ytPlayer.destroy();
                        ytPlayer = new YT.Player('youtubePlayer', {
                            height: '100%',
                            width: '100%',
                            videoId: resolvedId,
                            playerVars: {
                                autoplay: 1,
                                controls: 0,
                                disablekb: 1,
                                fs: 0,
                                modestbranding: 1,
                                playsinline: 1,
                                rel: 0,
                                origin: window.location.origin
                            },
                            events: {
                                onReady: onYouTubeReady,
                                onStateChange: onYouTubeStateChange,
                                onError: onYouTubeError
                            }
                        });
                    } catch (e) {
                        console.error('Error al crear reproductor YouTube para handle:', e);
                        hideLoading();
                        showError(t('player.youtubeLoadError'));
                    }
                });
            } else {
                hideLoading();
                document.getElementById('youtubePlayer')!.innerHTML = [
                    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1rem;padding:2rem;text-align:center">',
                    '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
                    '<p style="color:var(--text-secondary)">No se pudo obtener el stream en vivo automáticamente.</p>',
                    '<a href="' + escapeHtml(channelUrl) + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.75rem 1.5rem;background:var(--accent);color:var(--flux-black);border-radius:0.5rem;text-decoration:none;font-weight:600">Abrir en YouTube</a>',
                    '</div>'
                ].join('');
                state.isPlaying = true;
                updatePlayPauseButton();
            }
        });
        return;
    }

    setIsYoutubeMode(true);
    isChannelLiveMode = !!channelId;

    if (isChannelLiveMode) {
        console.log('YouTube channel live detected:', channelId);
        (elements.video as HTMLElement).style.display = 'none';
        elements.youtubeContainer!.classList.remove('hidden');
        document.getElementById('youtubePlayer')!.innerHTML = '';

        const iframe = document.createElement('iframe');
        iframe.src = 'https://www.youtube.com/embed/live_stream?channel=' + channelId +
            '&autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&origin=' +
            encodeURIComponent(window.location.origin);
        iframe.allow = 'autoplay; encrypted-media';
        iframe.allowFullscreen = true;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        document.getElementById('youtubePlayer')!.appendChild(iframe);
        channelLiveIframe = iframe;

        clearLoadTimeout();
        hideLoading();
        state.isPlaying = true;
        updatePlayPauseButton();
        autoKiosk();

        var resolved = false;

        function upgradeToYTPlayer(resolvedId: string) {
            if (resolved) return;
            resolved = true;
            console.log('Resolved live video ID:', resolvedId);
            window.removeEventListener('message', videoIdListener);
            videoIdListener = null;

            try {
                if (ytPlayer) ytPlayer.destroy();
            } catch (e) {}
            if (channelLiveIframe) {
                channelLiveIframe.src = '';
                channelLiveIframe.remove();
                channelLiveIframe = null;
            }
            document.getElementById('youtubePlayer')!.innerHTML = '';
            ytPlayer = null;
            ytReady = false;
            pendingVideoId = null;

            const upgradePlayer = function () {
                if (ytPlayer) {
                    if (ytReady) {
                        ytPlayer.loadVideoById(resolvedId);
                    } else {
                        pendingVideoId = resolvedId;
                    }
                    return;
                }
                try {
                    ytPlayer = new YT.Player('youtubePlayer', {
                        height: '100%',
                        width: '100%',
                        videoId: resolvedId,
                        playerVars: {
                            autoplay: 1,
                            controls: 0,
                            disablekb: 1,
                            fs: 0,
                            modestbranding: 1,
                            playsinline: 1,
                            rel: 0,
                            origin: window.location.origin
                        },
                        events: {
                            onReady: onYouTubeReady,
                            onStateChange: onYouTubeStateChange,
                            onError: onYouTubeError
                        }
                    });
                } catch (e) {
                    console.error('Error al crear reproductor YouTube:', e);
                    hideLoading();
                    showError(t('player.youtubeLoadError'));
                }
            };
            loadYouTubeAPI(upgradePlayer);
        }

        var listener = function (event: any) {
            if (event.source !== iframe.contentWindow) return;
            try {
                var data = JSON.parse(event.data);
                if (!data) return;

                var resolvedId = null;
                if (data.info && typeof data.info === 'object' && data.info.videoId) {
                    resolvedId = data.info.videoId;
                } else if (data.videoId) {
                    resolvedId = data.videoId;
                }

                if (resolvedId && resolvedId.length === 11) {
                    upgradeToYTPlayer(resolvedId);
                }
            } catch (e) {}
        };
        videoIdListener = listener;
        window.addEventListener('message', listener);

        setTimeout(function () {
            if (!resolved) {
                resolved = true;
                if (videoIdListener === listener) {
                    window.removeEventListener('message', listener);
                    videoIdListener = null;
                }
                console.log('PostMessage timeout, keeping live_stream iframe');
            }
        }, 15000);

        resolveChannelViaProxy(channelId!, function (videoId: string | null) {
            if (!resolved && videoId && videoId.length === 11) {
                console.log('Resolved live video ID via proxy:', videoId);
                upgradeToYTPlayer(videoId);
            }
        });
        return;
    }

    isChannelLiveMode = false;
    (elements.video as HTMLElement).style.display = 'none';
    elements.youtubeContainer!.classList.remove('hidden');

    function createOrUpdatePlayer() {
        if (ytPlayer) {
            if (ytReady) {
                ytPlayer.loadVideoById(videoId);
            } else {
                pendingVideoId = videoId;
            }
            return;
        }
        try {
            ytPlayer = new YT.Player('youtubePlayer', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    rel: 0,
                    origin: window.location.origin
                },
                events: {
                    onReady: onYouTubeReady,
                    onStateChange: onYouTubeStateChange,
                    onError: onYouTubeError
                }
            });
        } catch (e) {
            console.error('Error al crear el reproductor de YouTube:', e);
            hideLoading();
            showError(t('player.youtubeLoadError'));
        }
    }

    loadYouTubeAPI(createOrUpdatePlayer);
}

function destroyYoutubePlayer(): void {
    destroyEmbedPlayer();
    try {
        if (ytPlayer) {
            ytPlayer.destroy();
        }
    } catch (e) {
        console.error('Error destroying YT player:', e);
    }
    if (channelLiveIframe) {
        channelLiveIframe.src = '';
        channelLiveIframe.remove();
        channelLiveIframe = null;
    }
    if (videoIdListener) {
        window.removeEventListener('message', videoIdListener);
        videoIdListener = null;
    }
    document.getElementById('youtubePlayer')!.innerHTML = '';
    ytPlayer = null;
    ytReady = false;
    pendingVideoId = null;
    setIsYoutubeMode(false);
    isChannelLiveMode = false;
    elements.youtubeContainer!.classList.add('hidden');
    (elements.video as HTMLElement).style.display = '';
}

export {
    ytPlayer, isChannelLiveMode, channelLiveIframe,
    isYoutubeUrl, extractYoutubeId,
    playYoutubeChannel, destroyYoutubePlayer, sendYtCommand
};
