declare var firebase: any;

import { state, saveState } from './state.ts';

var syncProvider: any = null;
var syncTimer: any = null;

function setSyncProvider(provider: any): void {
    syncProvider = provider;
}

async function syncNow(): Promise<any> {
    if (!syncProvider) return;

    var data: any = {
        favorites: JSON.stringify([...state.favorites]),
        lockedChannels: JSON.stringify([...state.lockedChannels]),
        history: JSON.stringify(state.history),
        playlists: JSON.stringify(state.playlists),
        theme: state.theme,
        kioskMode: state.kioskMode
    };

    try {
        var result = await syncProvider.save(data);
        return result;
    } catch (e) {
        console.error('Sync error:', e);
        return false;
    }
}

async function syncPull(): Promise<any> {
    if (!syncProvider) return;

    try {
        var data: any = await syncProvider.load();
        if (!data) return false;

        if (data.favorites) {
            state.favorites = new Set(JSON.parse(data.favorites));
        }
        if (data.lockedChannels) {
            state.lockedChannels = new Set(JSON.parse(data.lockedChannels));
        }
        if (data.history) {
            state.history = JSON.parse(data.history);
        }
        if (data.playlists) {
            state.playlists = JSON.parse(data.playlists);
        }
        if (data.theme) {
            state.theme = data.theme;
        }
        if (data.kioskMode !== undefined) {
            state.kioskMode = data.kioskMode === true || data.kioskMode === 'true';
        }

        saveState();
        return true;
    } catch (e) {
        console.error('Sync pull error:', e);
        return false;
    }
}

function startAutoSync(intervalMs: number): void {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(syncNow, intervalMs || 60000);
}

function stopAutoSync(): void {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
}

function createFirebaseProvider(config: any): any {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded');
        return null;
    }

    try {
        if (!(firebase as any).apps.length) {
            (firebase as any).initializeApp(config);
        }
        var db = (firebase as any).database();
        var ref = db.ref('flux-sync');

        return {
            save: function (data: any): Promise<any> {
                return ref.set(data).then(function (): boolean { return true; });
            },
            load: function (): Promise<any> {
                return ref.once('value').then(function (snap: any): any { return snap.val(); });
            }
        };
    } catch (e) {
        console.error('Firebase init error:', e);
        return null;
    }
}

function createLocalStorageProvider(): any {
    return {
        save: function (data: any): Promise<any> {
            try {
                localStorage.setItem('flux_sync_backup', JSON.stringify(data));
                return Promise.resolve(true);
            } catch (e) {
                return Promise.reject(e);
            }
        },
        load: function (): Promise<any> {
            try {
                var raw = localStorage.getItem('flux_sync_backup');
                return Promise.resolve(raw ? JSON.parse(raw) : null);
            } catch (e) {
                return Promise.reject(e);
            }
        }
    };
}

export {
    setSyncProvider,
    syncNow,
    syncPull,
    startAutoSync,
    stopAutoSync,
    createFirebaseProvider,
    createLocalStorageProvider
};
