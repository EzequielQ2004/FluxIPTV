import { parseM3U } from './parser.ts';
import { t } from './i18n.ts';
import { state, saveState } from './state.ts';
import { elements, renderChannelList, renderPlaylistList, showLoading, hideLoading, showListLoading, closeModal, showError, showToast } from './ui.ts';
import { loadEpgFromUrl } from './epg.ts';
import { clearStreamTypeCache } from './player-core.ts';

function savePlaylist(url: string, name: string | undefined, channelCount: number): void {
    const existing = state.playlists.findIndex(p => p.url === url);
    if (existing >= 0) {
        if (name) state.playlists[existing].name = name;
        state.playlists[existing].channelCount = channelCount;
    } else {
        state.playlists.push({
            url,
            name: name || '',
            channelCount,
            addedAt: new Date().toISOString()
        });
    }
    saveState();
}

function deletePlaylist(url: string): void {
    state.playlists = state.playlists.filter(p => p.url !== url);
    saveState();
    renderPlaylistList();
}

async function loadM3UFromUrl(url: string, name?: string, epgUrl?: string): Promise<void> {
    // 1. Validate URL format before anything
    try {
        new URL(url);
    } catch (_) {
        showToast(t('loader.urlInvalid'), 'error');
        return;
    }

    elements.confirmM3uBtn.disabled = true;
    closeModal(elements.m3uModal);
    showListLoading(true);

    function done(): void {
        showListLoading(false);
        elements.confirmM3uBtn.disabled = false;
    }

    try {
        // 2. Fetch with 30s timeout
        var controller = new AbortController();
        var timeoutId: any = setTimeout(function () { controller.abort(); }, 30000);

        var response: Response;
        try {
            response = await fetch(url, { signal: controller.signal });
        } catch (e: any) {
            clearTimeout(timeoutId);
            done();
            if (e.name === 'AbortError') {
                showError(t('loader.timeout'));
            } else {
                showError(t('loader.connectionError'));
            }
            return;
        }
        clearTimeout(timeoutId);

        // 3. Check HTTP status
        if (!response.ok) {
            done();
            showError(t('loader.unexpectedError') + '(' + response.status + ' ' + response.statusText + ')');
            return;
        }

        // 4. Check Content-Length header
        var contentLength = response.headers.get('Content-Length');
        if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
            done();
            showError(t('loader.tooLarge'));
            return;
        }

        // 5. Read response body
        var content = await response.text();

        // 6. Size check for responses without Content-Length header
        if (content.length > 50 * 1024 * 1024) {
            done();
            showError(t('loader.tooLarge'));
            return;
        }

        // 7. Parse and validate
        var channels = parseM3U(content, url);

        if (channels.length === 0) {
            done();
            if (content.trim().length < 10) {
                showError(t('loader.empty'));
            } else if (!content.trim().startsWith('#EXTM3U')) {
                showError(t('loader.noM3UHeader'));
            } else {
                showError(t('loader.noChannels'));
            }
            return;
        }

        // 8. Success path
        state.channels = channels;
        clearStreamTypeCache();
        state.expandedGroups.clear();
        savePlaylist(url, name, channels.length);
        renderChannelList();
        renderPlaylistList();

        var epgUrlToLoad = epgUrl || state.epgSource || autoDetectEpgUrl(url);
        if (epgUrlToLoad) {
            loadEpgFromUrl(epgUrlToLoad).catch(function () {
                // EPG is optional, silently fail
            });
        }

        done();
        closeModal(elements.m3uModal);
    } catch (error: any) {
        done();
        showError(t('loader.unexpectedError') + error.message);
    }
}

function autoDetectEpgUrl(m3uUrl: string): string {
    if (!m3uUrl) return '';
    return m3uUrl.replace(/\.m3u8?$/i, '.xml').replace(/\/playlist\.[a-z]+$/i, '/xmltv.xml');
}

function loadM3UFromFile(file: File, name: string): Promise<void> {
    elements.confirmM3uBtn.disabled = true;
    closeModal(elements.m3uModal);
    showListLoading(true);

    var maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
        showListLoading(false);
        elements.confirmM3uBtn.disabled = false;
        showError(t('loader.fileTooLarge'));
        return Promise.resolve();
    }

    return new Promise<void>(function (resolve) {
        const reader = new FileReader();

        function done(): void {
            showListLoading(false);
            elements.confirmM3uBtn.disabled = false;
        }

        reader.onload = function (e: any) {
            try {
                const content = e.target.result;

                if (content.length < 10) {
                    done();
                    showError(t('loader.empty'));
                    resolve();
                    return;
                }

                const channels = parseM3U(content);

                if (channels.length === 0) {
                    done();
                    if (!content.trim().startsWith('#EXTM3U')) {
                        showError(t('loader.noM3UHeader'));
                    } else {
                        showError(t('loader.noChannels'));
                    }
                    resolve();
                    return;
                }

                state.channels = channels;
                clearStreamTypeCache();
                state.expandedGroups.clear();
                if (file.name) {
                    const playlistName = name || file.name.replace(/\.[^/.]+$/, '');
                    savePlaylist('file:///' + file.name, playlistName, channels.length);
                }
                renderChannelList();
                renderPlaylistList();
                done();
                closeModal(elements.m3uModal);
                resolve();
            } catch (error: any) {
                done();
                showError(t('loader.unexpectedError') + error.message);
                resolve();
            }
        };

        reader.onerror = function () {
            done();
            showError(t('loader.empty'));
            resolve();
        };

        reader.readAsText(file);
    });
}

export { loadM3UFromUrl, loadM3UFromFile, deletePlaylist };
