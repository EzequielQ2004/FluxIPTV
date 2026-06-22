import { t } from './i18n.ts';
import { state, saveState, getPinContext } from './state.ts';
import {
    elements,
    renderChannelList,
    renderPlaylistList,
    showLoading,
    hideLoading,
    showError,
    hideError,
    openModal,
    closeModal,
    showToast,
    showConfirmModal,
    showPlaylistDetails,
    toggleTheme,
    toggleSidebar,
    toggleFavorite,
    toggleLock
} from './ui.ts';
import {
    playChannel,
    togglePlayPause,
    updatePlayPauseButton,
    toggleMute,
    toggleFullscreen,
    toggleKioskMode,
    togglePiP,
    nextChannel,
    prevChannel,
    setVolume,
    verifyPin
} from './player.js';
import { showEpg } from './epg.ts';
import { navigateFocus } from './keyboard.js';
import { loadM3UFromUrl, loadM3UFromFile, deletePlaylist } from './loader.ts';
import { openSettings, closeSettings, setupSettings } from './settings.ts';

function setupEventListeners() {

    let waitingTimeout;

    elements.video.addEventListener('play', () => {
        state.isPlaying = true;
        updatePlayPauseButton();
        hideLoading();
        clearTimeout(waitingTimeout);
    });

    elements.video.addEventListener('pause', () => {
        state.isPlaying = false;
        updatePlayPauseButton();
    });

    elements.video.addEventListener('waiting', () => {
        showLoading(true);
        clearTimeout(waitingTimeout);
        waitingTimeout = setTimeout(() => {
            if (elements.video.style.display === 'none') return;
            if (!elements.youtubeContainer.classList.contains('hidden')) return;
            hideLoading();
            showError('El stream se ha interrumpido');
        }, 20000);
    });

    elements.video.addEventListener('playing', () => {
        clearTimeout(waitingTimeout);
        hideLoading();
    });

    elements.video.addEventListener('error', () => {
        showError('Error al cargar el stream');
        hideLoading();
    });

    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.prevBtn.addEventListener('click', prevChannel);
    elements.nextBtn.addEventListener('click', nextChannel);
    elements.volumeBtn.addEventListener('click', toggleMute);
    elements.volumeSlider.addEventListener('input', function () {
        setVolume(parseFloat(elements.volumeSlider.value));
    });
    elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
    elements.kioskBtn.addEventListener('click', toggleKioskMode);
    elements.epgBtn.addEventListener('click', showEpg);
    elements.pipBtn.addEventListener('click', togglePiP);

    elements.settingsBtn.addEventListener('click', openSettings);
    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.loadM3uBtn.addEventListener('click', () => openModal(elements.m3uModal));
    elements.menuToggle.addEventListener('click', toggleSidebar);
    elements.sidebarOverlay.addEventListener('click', toggleSidebar);

    let searchTimeout;
    renderPlaylistList();

    elements.searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(renderChannelList, 200);
    });

    document.querySelector('.filter-tabs').addEventListener('click', (e) => {
        var tab = e.target.closest('.filter-tab');
        if (!tab) return;
        document.querySelectorAll('.filter-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        state.currentFilter = tab.dataset.filter;
        renderChannelList();
    });

    function toggleGroup(groupItem) {
        var groupName = groupItem.dataset.group;
        if (state.expandedGroups.has(groupName)) {
            state.expandedGroups.delete(groupName);
        } else {
            state.expandedGroups.add(groupName);
        }
        renderChannelList();
    }

    elements.channelList.addEventListener('keydown', (e) => {
        var groupItem = e.target.closest('.group-item');
        if (groupItem && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            toggleGroup(groupItem);
        }
    });

    elements.channelList.addEventListener('click', (e) => {
        var groupItem = e.target.closest('.group-item');
        if (groupItem) {
            toggleGroup(groupItem);
            return;
        }

        const channelItem = e.target.closest('.channel-item');
        const actionBtn = e.target.closest('.channel-action-btn');

        if (actionBtn) {
            const index = parseInt(actionBtn.dataset.index);
            const action = actionBtn.dataset.action;

            if (action === 'favorite') {
                toggleFavorite(index);
            } else if (action === 'lock') {
                toggleLock(index);
            }
            e.stopPropagation();
        } else if (channelItem) {
            const index = parseInt(channelItem.dataset.index);
            playChannel(index);
        }
    });

    elements.historyBar.addEventListener('click', (e) => {
        const historyItem = e.target.closest('.history-item');
        if (historyItem) {
            var historyId = historyItem.dataset.historyId;
            var histEntry = state.history.find(function (h) { return h.id === historyId; });
            if (!histEntry) return;
            var channelIndex = state.channels.findIndex(function (ch) {
                return ch.url === histEntry.url;
            });
            if (channelIndex === -1) {
                showToast(t('toast.playlist.channelUnavailable'), 'error');
                return;
            }
            playChannel(channelIndex);
        }
    });

    document.querySelectorAll('.m3u-modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            var tabName = tab.dataset.m3uTab;
            document.querySelectorAll('.m3u-modal-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.m3u-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('m3u' + tabName.charAt(0).toUpperCase() + tabName.slice(1) + 'Tab').classList.add('active');
        });
    });

    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (tabName === 'url') {
                document.getElementById('urlTab').classList.remove('hidden');
                document.getElementById('fileTab').classList.add('hidden');
            } else {
                document.getElementById('urlTab').classList.add('hidden');
                document.getElementById('fileTab').classList.remove('hidden');
            }
        });
    });

    elements.confirmM3uBtn.addEventListener('click', () => {
        var savedTab = document.getElementById('m3uSavedTab');
        if (savedTab.classList.contains('active')) {
            document.querySelector('.m3u-modal-tab[data-m3u-tab="add"]').click();
            return;
        }

        const name = elements.m3uName.value.trim();
        const urlTabActive = document.querySelector('.modal-tab[data-tab="url"]').classList.contains('active');

        function autoPlayFirst() {
            if (state.channels.length > 0) playChannel(0);
        }

        if (urlTabActive) {
            const url = elements.m3uUrl.value.trim();
            if (url) {
                var epgUrl = elements.epgUrl.value.trim();
                loadM3UFromUrl(url, name, epgUrl || null).then(autoPlayFirst);
            } else {
                showToast(t('toast.url.invalid'), 'error');
            }
        } else {
            const file = elements.m3uFile.files[0];
            if (file) {
                loadM3UFromFile(file, name).then(autoPlayFirst);
            } else {
                showToast(t('toast.url.selectFile'), 'error');
            }
        }
    });

    elements.playlistList.addEventListener('click', (e) => {
        var actionBtn = e.target.closest('.pl-action-btn');
        var playlistItem = e.target.closest('.playlist-item');
        if (!playlistItem) return;
        var url = actionBtn ? actionBtn.dataset.url : playlistItem.dataset.url;

        if (actionBtn) {
            var action = actionBtn.dataset.action;
            if (action === 'update') {
                loadM3UFromUrl(url);
            } else if (action === 'details') {
                showPlaylistDetails(url);
            } else if (action === 'delete') {
                showConfirmModal(t('toast.playlist.deleteConfirm'), function (confirmed) {
                    if (confirmed) {
                        deletePlaylist(url);
                    }
                });
            }
        } else {
            loadM3UFromUrl(url);
        }
    });

    elements.plCopyUrlBtn.addEventListener('click', function () {
        var url = elements.plCopyUrlBtn.dataset.url;
        if (!url) return;
        navigator.clipboard.writeText(url).then(function () {
            showToast(t('toast.url.copied'));
        }).catch(function () {
            showToast(t('toast.url.copyFailed'), 'error');
        });
    });

    elements.closePlDetailBtn.addEventListener('click', function () {
        closeModal(elements.playlistDetailsModal);
    });

    elements.savePlDetailBtn.addEventListener('click', function () {
        var url = elements.savePlDetailBtn.dataset.url;
        var name = elements.plDetailName.value.trim();
        if (!url) return;
        var pl = state.playlists.find(function (p) { return p.url === url; });
        if (pl) {
            pl.name = name;
            saveState();
            renderPlaylistList();
        }
        closeModal(elements.playlistDetailsModal);
    });

    elements.cancelM3uBtn.addEventListener('click', () => {
        closeModal(elements.m3uModal);
    });

    document.getElementById('confirmPinBtn').addEventListener('click', verifyPin);
    function resetPinModal() {
        elements.pinInput.value = '';
        document.getElementById('pinConfirmInput').value = '';
        document.getElementById('pinConfirmInput').style.display = 'none';
        state.pendingChannelIndex = null;
    }

    document.getElementById('cancelPinBtn').addEventListener('click', function () {
        closeModal(elements.pinModal);
        resetPinModal();
    });

    elements.pinInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            var ctx = getPinContext();
            if (ctx === 'set-lock') {
                document.getElementById('pinConfirmInput').focus();
            } else {
                verifyPin();
            }
        }
    });

    document.getElementById('pinConfirmInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            verifyPin();
        }
    });

    document.getElementById('closeEpgBtn').addEventListener('click', () => {
        closeModal(elements.epgModal);
    });

    elements.retryBtn.addEventListener('click', () => {
        hideError();
        if (state.currentChannelIndex >= 0) {
            playChannel(state.currentChannelIndex);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
            if (e.key !== 'Escape') return;
        }

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                navigateFocus(-1, 'vertical');
                break;
            case 'ArrowDown':
                e.preventDefault();
                navigateFocus(1, 'vertical');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                navigateFocus(-1, 'horizontal');
                break;
            case 'ArrowRight':
                e.preventDefault();
                navigateFocus(1, 'horizontal');
                break;
            case 'Enter':
                e.preventDefault();
                const focused = document.activeElement;
                if (focused) {
                    focused.click();
                }
                break;
            case 'Backspace':
                if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
                    return;
                }
                e.preventDefault();
                if (elements.m3uModal.classList.contains('active')) {
                    closeModal(elements.m3uModal);
                } else if (elements.pinModal.classList.contains('active')) {
                    closeModal(elements.pinModal);
                    resetPinModal();
                } else if (elements.settingsModal.classList.contains('active')) {
                    closeSettings();
                } else if (elements.epgModal.classList.contains('active')) {
                    closeModal(elements.epgModal);
                } else if (elements.sidebar.classList.contains('open')) {
                    toggleSidebar();
                }
                break;
            case 'Escape':
                e.preventDefault();
                if (elements.m3uModal.classList.contains('active')) {
                    closeModal(elements.m3uModal);
                } else if (elements.pinModal.classList.contains('active')) {
                    closeModal(elements.pinModal);
                    resetPinModal();
                } else if (elements.settingsModal.classList.contains('active')) {
                    closeSettings();
                } else if (elements.epgModal.classList.contains('active')) {
                    closeModal(elements.epgModal);
                } else if (elements.sidebar.classList.contains('open')) {
                    toggleSidebar();
                }
                break;
            case ' ':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'm':
            case 'M':
                e.preventDefault();
                toggleMute();
                break;
            case 'k':
            case 'K':
                e.preventDefault();
                toggleKioskMode();
                break;
            case '+':
            case '=':
                e.preventDefault();
                setVolume(Math.min(1, state.volume + 0.1));
                break;
            case '-':
            case '_':
                e.preventDefault();
                setVolume(Math.max(0, state.volume - 0.1));
                break;
        }
    });

    [elements.m3uModal, elements.pinModal, elements.epgModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
                if (modal === elements.pinModal) resetPinModal();
            }
        });
    });

    let controlsTimer;
    function showControls(keep) {
        elements.playerControls.classList.add('visible');
        elements.videoContainer.classList.remove('hide-cursor');
        clearTimeout(controlsTimer);
        if (keep || !state.isPlaying) return;
        controlsTimer = setTimeout(function () {
            elements.playerControls.classList.remove('visible');
            if (document.fullscreenElement) {
                elements.videoContainer.classList.add('hide-cursor');
            }
        }, 3000);
    }

    function hideControls() {
        elements.playerControls.classList.remove('visible');
        elements.videoContainer.classList.remove('hide-cursor');
        clearTimeout(controlsTimer);
    }

    document.addEventListener('mousemove', function (e) {
        if (!state.isPlaying) return;
        if (!document.fullscreenElement && !elements.videoContainer.contains(e.target)) return;
        showControls();
    });
    document.addEventListener('fullscreenchange', function () {
        if (document.fullscreenElement === elements.videoContainer) {
            var overlays = document.querySelectorAll('.modal-overlay');
            overlays.forEach(function (m) { elements.videoContainer.appendChild(m); });
        } else if (!document.fullscreenElement) {
            elements.videoContainer.classList.remove('hide-cursor');
            var body = document.body;
            var overlays = document.querySelectorAll('.modal-overlay');
            overlays.forEach(function (m) { body.appendChild(m); });
        }
    });
    elements.videoContainer.addEventListener('mouseleave', function () {
        if (!state.isPlaying || document.fullscreenElement) return;
        hideControls();
    });
    elements.videoContainer.addEventListener('touchstart', function () { showControls(true); });

    var clickTimer = null;
    elements.videoContainer.addEventListener('click', function (e) {
        if (e.target.closest('.player-controls, .error-overlay, .modal-overlay')) return;
        if (clickTimer) {
            clearTimeout(clickTimer);
            clickTimer = null;
            toggleFullscreen();
            return;
        }
        clickTimer = setTimeout(function () {
            clickTimer = null;
            togglePlayPause();
        }, 250);
    });

    elements.video.addEventListener('pause', function () {
        showControls(true);
    });
    elements.video.addEventListener('play', function () {
        if (elements.playerControls.classList.contains('visible') && state.isPlaying) {
            clearTimeout(controlsTimer);
            controlsTimer = setTimeout(function () {
                elements.playerControls.classList.remove('visible');
            }, 3000);
        }
    });

    setupSettings();
}

export { setupEventListeners };
