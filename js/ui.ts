import { state, saveState, isPinConfigured, setPinContext } from './state.ts';
import { getFallbackImage, handleImageError, escapeHtml, getCachedLogoUrl } from './fallback-image.ts';
import { t } from './i18n.ts';
import { Channel } from './types.ts';
import { DEFAULT_CHANNEL_NAME } from './parser.ts';

const SVG_FAV_FILLED = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
const SVG_FAV_OUTLINE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
const SVG_LOCK_CLOSED = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"></rect><path d="M8 10V6a4 4 0 1 1 8 0v4"></path></svg>';
const SVG_LOCK_OPEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"></rect><path d="M8 10V6a4 4 0 0 1 8 0v1"></path></svg>';

function byId(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) console.warn(`Elemento #${id} no encontrado en el DOM`);
    return el!;
}

const elements = {
    get video() { return byId('videoPlayer') as HTMLVideoElement; },
    get videoContainer() { return byId('videoContainer'); },
    get youtubeContainer() { return byId('youtubeContainer'); },
    get embedContainer() { return byId('embedContainer'); },
    get embedPlayer() { return byId('embedPlayer'); },
    get loadingOverlay() { return byId('loadingOverlay'); },
    get errorOverlay() { return byId('errorOverlay'); },
    get errorMessage() { return byId('errorMessage'); },
    get channelList() { return byId('channelList'); },
    get searchInput() { return byId('searchInput') as HTMLInputElement; },
    get filterTabs() { return document.querySelectorAll('.filter-tab'); },
    get playPauseBtn() { return byId('playPauseBtn'); },
    get playIcon() { return byId('playIcon'); },
    get pauseIcon() { return byId('pauseIcon'); },
    get prevBtn() { return byId('prevBtn'); },
    get nextBtn() { return byId('nextBtn'); },
    get stopBtn() { return byId('stopBtn'); },
    get volumeBtn() { return byId('volumeBtn'); },
    get volumeIcon() { return byId('volumeIcon'); },
    get muteIcon() { return byId('muteIcon'); },
    get volumeSlider() { return byId('volumeSlider') as HTMLInputElement; },
    get fullscreenBtn() { return byId('fullscreenBtn'); },
    get epgBtn() { return byId('epgBtn'); },
    get pipBtn() { return byId('pipBtn'); },
    get themeToggle() { return byId('themeToggle'); },
    get loadM3uBtn() { return byId('loadM3uBtn'); },
    get menuToggle() { return byId('menuToggle'); },
    get sidebar() { return byId('sidebar'); },
    get sidebarOverlay() { return byId('sidebarOverlay'); },
    get historyBar() { return byId('historyBar'); },
    get m3uModal() { return byId('m3uModal'); },
    get pinModal() { return byId('pinModal'); },
    get epgModal() { return byId('epgModal'); },
    get m3uUrl() { return byId('m3uUrl') as HTMLInputElement; },
    get m3uFile() { return byId('m3uFile') as HTMLInputElement; },
    get m3uName() { return byId('m3uName') as HTMLInputElement; },
    get epgUrl() { return byId('epgUrl') as HTMLInputElement; },
    get playlistList() { return byId('playlistList'); },
    get playlistDetailsModal() { return byId('playlistDetailsModal'); },
    get plDetailName() { return byId('plDetailName') as HTMLInputElement; },
    get plDetailUrl() { return byId('plDetailUrl'); },
    get plDetailCount() { return byId('plDetailCount'); },
    get plDetailDate() { return byId('plDetailDate'); },
    get plCopyUrlBtn() { return byId('plCopyUrlBtn'); },
    get savePlDetailBtn() { return byId('savePlDetailBtn'); },
    get closePlDetailBtn() { return byId('closePlDetailBtn'); },
    get pinInput() { return byId('pinInput') as HTMLInputElement; },
    get retryBtn() { return byId('retryBtn'); },
    get toastContainer() { return byId('toastContainer'); },
    get confirmM3uBtn() { return byId('confirmM3uBtn') as HTMLButtonElement; },
    get cancelM3uBtn() { return byId('cancelM3uBtn'); },
    get loadingText() { return byId('loadingText'); },
    get listLoadingOverlay() { return byId('listLoadingOverlay'); },
    get listLoadingText() { return byId('listLoadingText'); },
    get confirmModal() { return byId('confirmModal'); },
    get confirmMessage() { return byId('confirmMessage'); },
    get cancelConfirmBtn() { return byId('cancelConfirmBtn'); },
    get acceptConfirmBtn() { return byId('acceptConfirmBtn'); },
    get kioskBtn() { return byId('kioskBtn'); },
    get playerControls() { return byId('playerControls'); },
    get settingsModal() { return byId('settingsModal'); },
    get settingsBtn() { return byId('settingsBtn'); },
    get nowPlaying() { return byId('nowPlaying'); }
};

function getChannelLogo(channel: Channel): string {
    return getCachedLogoUrl(channel.logo) || getFallbackImage(48);
}

type VirtualRow =
    | { type: 'header'; data: string; height: number }
    | { type: 'group'; data: { name: string; count: number; expanded: boolean }; height: number }
    | { type: 'channel'; data: Channel; height: number };

// --- Virtual Scroller ---
const HEADER_HEIGHT = 36;
const CHANNEL_HEIGHT = 80;
const BUFFER_ROWS = 5;

let virtualRows: VirtualRow[] = [];
let cumulativeHeights: number[] = [0];
let totalHeight = 0;
let virtualScrollHandler: (() => void) | null = null;
let renderedRange: { start: number; end: number } = { start: -1, end: -1 };

function findRow(offset: number): number {
    if (offset <= 0) return 0;
    if (offset >= totalHeight) return Math.max(0, virtualRows.length - 1);
    let lo = 0, hi = cumulativeHeights.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cumulativeHeights[mid] <= offset) lo = mid;
        else hi = mid - 1;
    }
    return lo;
}

function buildRowHTML(row: VirtualRow): string {
    if (row.type === 'header') {
        return `<div style="padding: 0.5rem 0.75rem; font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">${escapeHtml(row.data)}</div>`;
    }
    if (row.type === 'group') {
        var expanded = row.data.expanded;
        return `<div class="channel-item group-item" data-group="${escapeHtml(row.data.name)}" role="button" tabindex="0" aria-expanded="${expanded}">
            <div class="channel-info">
                <div class="channel-name" style="font-weight:600">${escapeHtml(row.data.name)}</div>
                <div class="channel-group">${t('ui.channelCount', { count: row.data.count })}</div>
            </div>
            <svg class="group-expand-icon ${expanded ? 'expanded' : ''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        </div>`;
    }
    const channel = row.data;
    const isFavorite = state.favorites.has(channel.url);
    const isLocked = state.lockedChannels.has(channel.url);
    const isActive = channel.index === state.currentChannelIndex;
    const displayName = channel.name === DEFAULT_CHANNEL_NAME ? t('parser.defaultName') : channel.name;
    return `
        <div class="channel-item ${isActive ? 'active' : ''}" 
             data-index="${channel.index}" 
             role="listitem" 
             tabindex="0"
             aria-label="${escapeHtml(displayName)}">
             <img class="channel-logo" 
                  src="${getChannelLogo(channel)}" 
                  alt="${escapeHtml(displayName)}"
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  onerror="handleImageError(this)">
            <div class="channel-info">
                <div class="channel-name">${escapeHtml(displayName)}</div>
                <div class="channel-group">${escapeHtml(channel.group)}</div>
            </div>
            <div class="channel-actions">
                <button class="channel-action-btn ${isFavorite ? 'favorite' : ''}" 
                        data-action="favorite" 
                        data-index="${channel.index}"
                        aria-label="${isFavorite ? t('ui.removeFav') : t('ui.addFav')}"
                        data-tooltip="${isFavorite ? t('ui.removeFav') : t('ui.addFav')}">
                    ${isFavorite ? SVG_FAV_FILLED : SVG_FAV_OUTLINE}
                </button>
                <button class="channel-action-btn ${isLocked ? 'locked' : ''}" 
                        data-action="lock" 
                        data-index="${channel.index}"
                        aria-label="${isLocked ? t('ui.unlock') : t('ui.lock')}"
                        data-tooltip="${isLocked ? t('ui.unlock') : t('ui.lock')}">
                    ${isLocked ? SVG_LOCK_CLOSED : SVG_LOCK_OPEN}
                </button>
            </div>
        </div>
    `;
}

function renderVisibleRows(): void {
    const container = elements.channelList;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    if (virtualRows.length === 0) return;

    const startOffset = Math.max(0, scrollTop - BUFFER_ROWS * CHANNEL_HEIGHT);
    const endOffset = Math.min(totalHeight, scrollTop + containerHeight + BUFFER_ROWS * CHANNEL_HEIGHT);

    const startRow = findRow(startOffset);
    const endRow = Math.min(findRow(endOffset), virtualRows.length - 1);

    const viewport = container.querySelector('.virtual-viewport') as HTMLElement;

    // Same range — just update transform and exit (fast path, no DOM changes)
    if (startRow === renderedRange.start && endRow === renderedRange.end) {
        viewport.style.transform = 'translateY(' + cumulativeHeights[startRow] + 'px)';
        return;
    }

    // First render or range doesn't overlap at all → complete rebuild
    if (renderedRange.start === -1 || startRow > renderedRange.end || endRow < renderedRange.start) {
        viewport.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (var i = startRow; i <= endRow; i++) {
            var wrapper = document.createElement('div');
            wrapper.innerHTML = buildRowHTML(virtualRows[i]);
            (wrapper.firstElementChild as HTMLElement)!.dataset.vrow = String(i);
            fragment.appendChild(wrapper.firstElementChild as HTMLElement);
        }
        viewport.appendChild(fragment);
        renderedRange.start = startRow;
        renderedRange.end = endRow;
        viewport.style.transform = 'translateY(' + cumulativeHeights[startRow] + 'px)';
        return;
    }

    // Incremental update: remove rows from edges, add rows at edges

    // Remove from top (rows that scrolled above viewport)
    while (renderedRange.start < startRow && viewport.firstChild) {
        viewport.removeChild(viewport.firstChild);
        renderedRange.start++;
    }

    // Remove from bottom (rows that scrolled below viewport)
    while (renderedRange.end > endRow && viewport.lastChild) {
        viewport.removeChild(viewport.lastChild);
        renderedRange.end--;
    }

    // Prepend rows at top
    if (startRow < renderedRange.start) {
        var topFragment = document.createDocumentFragment();
        for (var t = startRow; t < renderedRange.start; t++) {
            var tw = document.createElement('div');
            tw.innerHTML = buildRowHTML(virtualRows[t]);
            (tw.firstElementChild as HTMLElement)!.dataset.vrow = String(t);
            topFragment.appendChild(tw.firstElementChild as HTMLElement);
        }
        viewport.insertBefore(topFragment, viewport.firstChild);
        renderedRange.start = startRow;
    }

    // Append rows at bottom
    if (endRow > renderedRange.end) {
        var bottomFragment = document.createDocumentFragment();
        for (var b = renderedRange.end + 1; b <= endRow; b++) {
            var bw = document.createElement('div');
            bw.innerHTML = buildRowHTML(virtualRows[b]);
            (bw.firstElementChild as HTMLElement)!.dataset.vrow = String(b);
            bottomFragment.appendChild(bw.firstElementChild as HTMLElement);
        }
        viewport.appendChild(bottomFragment);
        renderedRange.end = endRow;
    }

    viewport.style.transform = 'translateY(' + cumulativeHeights[startRow] + 'px)';
}

function scrollToChannel(index: number): void {
    const rowIdx = virtualRows.findIndex(function (r) { return r.type === 'channel' && r.data.index === index; });
    if (rowIdx === -1) return;
    const offset = cumulativeHeights[rowIdx];
    const container = elements.channelList;
    const containerHeight = container.clientHeight;
    container.scrollTop = Math.max(0, offset - (containerHeight / 3));
}

function renderChannelList(): void {
    const searchTerm = elements.searchInput.value.toLowerCase();
    let filteredChannels = state.channels;

    // ── Groups browser mode ──
    if (state.currentFilter === 'groups') {
        var savedScrollTop = elements.channelList.scrollTop;

        if (virtualScrollHandler) {
            elements.channelList.removeEventListener('scroll', virtualScrollHandler);
            virtualScrollHandler = null;
        }

        var groupCounts: Record<string, number> = {};
        state.channels.forEach(function (ch) { groupCounts[ch.group] = (groupCounts[ch.group] || 0) + 1; });
        var groupNames = Object.keys(groupCounts).sort();

        if (searchTerm) {
            groupNames = groupNames.filter(function (name) { return name.toLowerCase().includes(searchTerm); });
        }

        virtualRows = [];
        groupNames.forEach(function (name) {
            var expanded = state.expandedGroups.has(name);
            virtualRows.push({ type: 'group', data: { name: name, count: groupCounts[name], expanded: expanded }, height: CHANNEL_HEIGHT });
            if (expanded) {
                state.channels.forEach(function (ch) {
                    if (ch.group === name) {
                        virtualRows.push({ type: 'channel', data: ch, height: CHANNEL_HEIGHT });
                    }
                });
            }
        });

        if (virtualRows.length === 0) {
            virtualRows = [];
            cumulativeHeights = [0];
            totalHeight = 0;
            renderedRange = { start: -1, end: -1 };
            elements.channelList.innerHTML = [
                '<div class="empty-state">',
                '<div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>',
                '<p>' + t('ui.noGroups') + '</p>',
                '</div>'
            ].join('');
            return;
        }

        cumulativeHeights = [0];
        for (var r = 0; r < virtualRows.length; r++) {
            cumulativeHeights.push(cumulativeHeights[cumulativeHeights.length - 1] + virtualRows[r].height);
        }
        totalHeight = cumulativeHeights[cumulativeHeights.length - 1];

        renderedRange = { start: -1, end: -1 };
        elements.channelList.innerHTML = [
            '<div class="virtual-spacer" style="position:relative;height:' + totalHeight + 'px">',
            '<div class="virtual-viewport" style="position:absolute;top:0;left:0;right:0;will-change:transform"></div>',
            '</div>'
        ].join('');

        var maxScroll = totalHeight - elements.channelList.clientHeight;
        if (maxScroll > 0 && savedScrollTop > maxScroll) savedScrollTop = maxScroll;
        if (savedScrollTop > 0) elements.channelList.scrollTop = savedScrollTop;

        renderVisibleRows();

        virtualScrollHandler = function () { renderVisibleRows(); };
        elements.channelList.addEventListener('scroll', virtualScrollHandler);
        return;
    }

    // ── Channel list mode ──
    if (searchTerm) {
        filteredChannels = filteredChannels.filter(function (ch) {
            return ch.name.toLowerCase().includes(searchTerm) ||
                ch.group.toLowerCase().includes(searchTerm);
        });
    }

    if (state.currentFilter === 'favorites') {
        filteredChannels = filteredChannels.filter(function (ch) {
            return state.favorites.has(ch.url);
        });
    } else if (state.currentFilter === 'recent') {
        var recentUrls = new Set(state.history.map(function (h) { return h.url; }));
        filteredChannels = filteredChannels.filter(function (ch) {
            return recentUrls.has(ch.url);
        });
    }

    if (filteredChannels.length === 0) {
        if (virtualScrollHandler) {
            elements.channelList.removeEventListener('scroll', virtualScrollHandler);
            virtualScrollHandler = null;
        }
        virtualRows = [];
        cumulativeHeights = [0];
        totalHeight = 0;
        renderedRange = { start: -1, end: -1 };
        elements.channelList.innerHTML = [
            '<div class="empty-state">',
            '<div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg></div>',
            '<p>' + t('ui.noChannels') + '</p>',
            '</div>'
        ].join('');
        return;
    }

    // Build virtual rows with grouping
    virtualRows = [];
    const grouped: Record<string, Channel[]> = {};
    for (var i = 0; i < filteredChannels.length; i++) {
        var ch = filteredChannels[i];
        if (!grouped[ch.group]) grouped[ch.group] = [];
        grouped[ch.group].push(ch);
    }

    var groupKeys = Object.keys(grouped);
    for (var g = 0; g < groupKeys.length; g++) {
        var group = groupKeys[g];
        var channels = grouped[group];
        virtualRows.push({ type: 'header', data: group, height: HEADER_HEIGHT });
        for (var c = 0; c < channels.length; c++) {
            virtualRows.push({ type: 'channel', data: channels[c], height: CHANNEL_HEIGHT });
        }
    }

    // Compute cumulative heights
    cumulativeHeights = [0];
    for (var r = 0; r < virtualRows.length; r++) {
        cumulativeHeights.push(cumulativeHeights[cumulativeHeights.length - 1] + virtualRows[r].height);
    }
    totalHeight = cumulativeHeights[cumulativeHeights.length - 1];

    // Build virtual scroller DOM
    renderedRange = { start: -1, end: -1 };
    elements.channelList.innerHTML = [
        '<div class="virtual-spacer" style="position:relative;height:' + totalHeight + 'px">',
        '<div class="virtual-viewport" style="position:absolute;top:0;left:0;right:0;will-change:transform"></div>',
        '</div>'
    ].join('');

    renderVisibleRows();

    // Setup scroll listener
    if (virtualScrollHandler) {
        elements.channelList.removeEventListener('scroll', virtualScrollHandler);
    }
    virtualScrollHandler = function () {
        renderVisibleRows();
    };
    elements.channelList.addEventListener('scroll', virtualScrollHandler);
}

function renderPlaylistList(): void {
    const container = elements.playlistList;
    if (!container) return;

    if (state.playlists.length === 0) {
        container.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-secondary); padding: 0.5rem 0;">' + t('ui.noPlaylists') + '</div>';
        return;
    }

    const parts = [];
    for (const pl of state.playlists) {
        const displayName = pl.name || pl.url.split('/').pop() || t('ui.noName');
        const count = pl.channelCount != null ? pl.channelCount : 0;
        var dateStr = '—';
        if (pl.addedAt) {
            try { dateStr = new Date(pl.addedAt).toLocaleDateString(); } catch (e) {}
        }
        parts.push(`
            <div class="playlist-item" data-url="${escapeHtml(pl.url)}">
                <div class="playlist-info">
                    <div class="playlist-name">${escapeHtml(displayName)}</div>
                    <div class="playlist-meta">
                        <span>${t('ui.channelCount', { count: count })}</span>
                        <span>${escapeHtml(dateStr)}</span>
                    </div>
                </div>
                <div class="playlist-actions">
                    <button class="pl-action-btn" data-action="update" data-url="${escapeHtml(pl.url)}" aria-label="${t('ui.updateList')}" data-tooltip="${t('ui.updateList')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                    </button>
                    <button class="pl-action-btn" data-action="details" data-url="${escapeHtml(pl.url)}" aria-label="${t('ui.viewDetails')}" data-tooltip="${t('ui.viewDetails')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                    </button>
                    <button class="pl-action-btn pl-action-danger" data-action="delete" data-url="${escapeHtml(pl.url)}" aria-label="${t('ui.deleteList')}" data-tooltip="${t('ui.deleteList')}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `);
    }
    container.innerHTML = parts.join('');
}

function showPlaylistDetails(url: string): void {
    var pl = state.playlists.find(function (p) { return p.url === url; });
    if (!pl) return;
    var displayName = pl.name || pl.url.split('/').pop() || t('ui.noName');
    var count = pl.channelCount != null ? pl.channelCount : 0;
    var dateStr = '—';
    if (pl.addedAt) {
        try { dateStr = new Date(pl.addedAt).toLocaleDateString(); } catch (e) {}
    }
    elements.plDetailName.value = pl.name || '';
    elements.plDetailUrl.textContent = pl.url;
    elements.plDetailCount.textContent = String(count);
    elements.plDetailDate.textContent = dateStr;
    elements.plCopyUrlBtn.dataset.url = pl.url;
    elements.savePlDetailBtn.dataset.url = pl.url;
    openModal(elements.playlistDetailsModal);
}

function updateActiveChannel(index: number): void {
    const prevActive = elements.channelList.querySelector('.channel-item.active');
    if (prevActive) prevActive.classList.remove('active');
    const newActive = elements.channelList.querySelector(`.channel-item[data-index="${index}"]`);
    if (newActive) newActive.classList.add('active');
}

function renderHistory(): void {
    if (state.history.length === 0) {
        elements.historyBar.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.75rem; padding: 0.5rem;">' + t('ui.noHistory') + '</span>';
        return;
    }

    let html = '';
    for (const item of state.history) {
        var logoUrl = getCachedLogoUrl(item.logo) || getFallbackImage(36);
        html += `
            <div class="history-item" data-history-id="${item.id}" tabindex="0" role="button" aria-label="${escapeHtml(item.name)}">
                 <img src="${logoUrl}" 
                      alt="${escapeHtml(item.name)}"
                      decoding="async"
                      referrerpolicy="no-referrer"
                      onerror="handleImageError(this)">
                <span>${escapeHtml(item.name)}</span>
            </div>
        `;
    }

    elements.historyBar.innerHTML = html;
}

function showLoading(show: boolean, message?: string): void {
    elements.loadingOverlay.classList.toggle('active', show);
    if (message && elements.loadingText) {
        elements.loadingText.textContent = message;
    }
}

function hideLoading(): void {
    elements.loadingOverlay.classList.remove('active');
}

function showListLoading(show: boolean): void {
    var skeleton = document.getElementById('skeletonList');
    if (skeleton) {
        skeleton.classList.toggle('active', show);
        var emptyState = document.querySelector('#channelList > .empty-state');
        if (emptyState) (emptyState as HTMLElement).style.display = show ? 'none' : '';
    }
}

function showError(message: string): void {
    elements.errorMessage.textContent = message;
    elements.errorOverlay.classList.add('active');
}

function hideError(): void {
    elements.errorOverlay.classList.remove('active');
}

function showToast(message: string, type?: string): void {
    while (elements.toastContainer.children.length >= 3) {
        var first = elements.toastContainer.firstChild;
        if (first) elements.toastContainer.removeChild(first);
    }
    var toast = document.createElement('div');
    toast.className = 'toast' + (type === 'error' ? ' toast-error' : '');
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(function () {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3500);
}

var confirmCallback: ((result: boolean) => void) | null = null;
var previousFocused: Element | null = null;
var activeModal: HTMLElement | null = null;

var FOCUSABLE_SELECTOR = 'button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusable(el: HTMLElement): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(function (e) {
        return e.offsetParent !== null && !(e as any).disabled;
    });
}

function trapFocus(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || !activeModal) return;
    var focusable = getFocusable(activeModal);
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

function openModal(modal: HTMLElement): void {
    var appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.setAttribute('aria-hidden', 'true');

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');

    previousFocused = document.activeElement;
    activeModal = modal;

    var focusable = getFocusable(modal);
    if (focusable.length > 0) {
        focusable[0].focus();
    }

    document.addEventListener('keydown', trapFocus);
}

function closeModal(modal: HTMLElement): void {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');

    var appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.removeAttribute('aria-hidden');

    if (activeModal === modal) {
        activeModal = null;
        document.removeEventListener('keydown', trapFocus);
    }

    if (previousFocused && previousFocused !== document.body) {
        (previousFocused as HTMLElement).focus();
        previousFocused = null;
    }
}

function showConfirmModal(message: string, callback: (result: boolean) => void): void {
    elements.confirmMessage.textContent = message;
    confirmCallback = callback;
    elements.confirmModal.classList.add('modal-overlay-confirm');
    openModal(elements.confirmModal);
}

elements.acceptConfirmBtn.addEventListener('click', function () {
    if (confirmCallback) {
        confirmCallback(true);
        confirmCallback = null;
    }
    elements.confirmModal.classList.remove('modal-overlay-confirm');
    closeModal(elements.confirmModal);
});

elements.cancelConfirmBtn.addEventListener('click', function () {
    if (confirmCallback) {
        confirmCallback(false);
        confirmCallback = null;
    }
    elements.confirmModal.classList.remove('modal-overlay-confirm');
    closeModal(elements.confirmModal);
});

var systemDarkMedia: MediaQueryList | null = null;
var systemThemeListener: (() => void) | null = null;

function getSystemTheme(): string {
    if (systemDarkMedia === null) {
        systemDarkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    }
    return systemDarkMedia.matches ? 'dark' : 'light';
}

function applyTheme(): void {
    var resolved = state.theme === 'auto' ? getSystemTheme() : state.theme;
    document.documentElement.setAttribute('data-theme', resolved);
}

function startSystemThemeListener(): void {
    if (systemThemeListener) return;
    if (systemDarkMedia === null) {
        systemDarkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    }
    systemThemeListener = function () {
        if (state.theme === 'auto') {
            applyTheme();
        }
    };
    systemDarkMedia.addEventListener('change', systemThemeListener);
}

function toggleTheme(): void {
    var order = ['dark', 'light', 'auto'];
    var idx = order.indexOf(state.theme);
    state.theme = order[(idx + 1) % order.length];
    applyTheme();
    saveState();
}

function toggleSidebar(): void {
    elements.sidebar.classList.toggle('open');
    elements.sidebarOverlay.classList.toggle('active');
}

function toggleFavorite(index: number): void {
    var ch = state.channels[index];
    if (!ch) return;
    var url = ch.url;
    if (state.favorites.has(url)) {
        state.favorites.delete(url);
    } else {
        state.favorites.add(url);
    }
    saveState();
    const item = elements.channelList.querySelector(`.channel-item[data-index="${index}"]`);
    if (item) {
        const btn = item.querySelector('.channel-action-btn[data-action="favorite"]');
        if (btn) {
            const isFav = state.favorites.has(url);
            btn.classList.toggle('favorite', isFav);
            btn.innerHTML = isFav ? SVG_FAV_FILLED : SVG_FAV_OUTLINE;
            btn.setAttribute('aria-label', isFav ? t('ui.removeFav') : t('ui.addFav'));
            btn.setAttribute('data-tooltip', isFav ? t('ui.removeFav') : t('ui.addFav'));
        }
    }
}

function updateLockBtn(index: number): void {
    var ch = state.channels[index];
    if (!ch) return;
    const item = elements.channelList.querySelector(`.channel-item[data-index="${index}"]`);
    if (!item) return;
    const btn = item.querySelector('.channel-action-btn[data-action="lock"]');
    if (!btn) return;
    const isLocked = state.lockedChannels.has(ch.url);
    btn.classList.toggle('locked', isLocked);
    btn.innerHTML = isLocked ? SVG_LOCK_CLOSED : SVG_LOCK_OPEN;
    btn.setAttribute('aria-label', isLocked ? t('ui.unlock') : t('ui.lock'));
    btn.setAttribute('data-tooltip', isLocked ? t('ui.unlock') : t('ui.lock'));
}

function toggleLock(index: number): void {
    var ch = state.channels[index];
    if (!ch) return;
    if (state.lockedChannels.has(ch.url)) {
        state.pendingChannelIndex = index;
        setPinContext('unlock');
        document.getElementById('pinModalTitle')!.textContent = t('modal.pin.unlockTitle');
        document.getElementById('pinModalMessage')!.textContent = t('modal.pin.unlockMessage');
        (document.getElementById('pinConfirmInput') as HTMLElement).style.display = 'none';
        (document.getElementById('pinInput') as HTMLInputElement).value = '';
        (document.getElementById('pinInput') as HTMLInputElement).placeholder = 'PIN';
        document.getElementById('confirmPinBtn')!.textContent = t('modal.pin.unlockBtn');
        openModal(elements.pinModal);
        (document.getElementById('pinInput') as HTMLInputElement).focus();
        return;
    }

    if (isPinConfigured()) {
        state.lockedChannels.add(ch.url);
        saveState();
        updateLockBtn(index);
        return;
    }

    state.pendingChannelIndex = index;
    setPinContext('set-lock');
    document.getElementById('pinModalTitle')!.textContent = t('modal.pin.setTitle');
    document.getElementById('pinModalMessage')!.textContent = t('modal.pin.setMessage');
    (document.getElementById('pinConfirmInput') as HTMLElement).style.display = '';
    (document.getElementById('pinInput') as HTMLInputElement).value = '';
    (document.getElementById('pinInput') as HTMLInputElement).placeholder = 'Nuevo PIN';
    document.getElementById('confirmPinBtn')!.textContent = t('modal.pin.setBtn');
    openModal(elements.pinModal);
    (document.getElementById('pinInput') as HTMLInputElement).focus();
}

export {
    elements,
    updateActiveChannel,
    scrollToChannel,
    renderChannelList,
    renderPlaylistList,
    showPlaylistDetails,
    renderHistory,
    showLoading,
    hideLoading,
    showListLoading,
    showError,
    hideError,
    openModal,
    closeModal,
    showToast,
    showConfirmModal,
    applyTheme,
    startSystemThemeListener,
    toggleTheme,
    toggleSidebar,
    toggleFavorite,
    toggleLock,
    updateLockBtn
};
