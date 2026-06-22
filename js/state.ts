import { Channel, HistoryEntry, Playlist, AppState } from './types.ts';

type StateChangeCallback = (...args: any[]) => void;

let pinHash: string | null = null;
let pinContext: string | null = null;
let pendingChangePinCallback: ((success: boolean) => void) | null = null;

async function hashPin(pin: string): Promise<string> {
    var encoder = new TextEncoder();
    var data = encoder.encode(pin);
    var hashBuffer = await crypto.subtle.digest('SHA-256', data);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function (b: number) { return b.toString(16).padStart(2, '0'); }).join('');
}

const INITIAL_STATE: AppState = {
    channels: [],
    currentChannelIndex: -1,
    favorites: new Set<number>(),
    lockedChannels: new Set<number>(),
    history: [],
    hls: null,
    dash: null,
    isPlaying: false,
    isMuted: false,
    volume: 1,
    currentFilter: 'all',
    theme: 'auto',
    pendingChannelIndex: null,
    epgData: null,
    epgSource: '',
    playlists: [],
    kioskMode: false,
    expandedGroups: new Set<string>()
};

const PERSIST_KEYS = new Set<string>(['theme', 'favorites', 'lockedChannels', 'history', 'playlists', 'kioskMode']);
const listeners = new Map<string, Set<StateChangeCallback>>();
var saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
        saveTimer = null;
        saveState();
    }, 0);
}

function saveState() {
    localStorage.setItem('theme', state.theme);
    localStorage.setItem('favorites', JSON.stringify([...state.favorites]));
    localStorage.setItem('lockedChannels', JSON.stringify([...state.lockedChannels]));
    localStorage.setItem('history', JSON.stringify(state.history));
    localStorage.setItem('playlists', JSON.stringify(state.playlists));
    localStorage.setItem('kioskMode', String(state.kioskMode));
}

function loadState() {
    state.theme = localStorage.getItem('theme') || 'auto';

    try {
        var favorites = localStorage.getItem('favorites');
        if (favorites) {
            state.favorites = new Set(JSON.parse(favorites) as number[]);
        }
    } catch (e) {}

    try {
        var locked = localStorage.getItem('lockedChannels');
        if (locked) {
            state.lockedChannels = new Set(JSON.parse(locked) as number[]);
        }
    } catch (e) {}

    try {
        var history = localStorage.getItem('history');
        if (history) {
            state.history = JSON.parse(history) as HistoryEntry[];
        }
    } catch (e) {}

    var storedHash = localStorage.getItem('parentalPinHash');
    var storedPlain = localStorage.getItem('parentalPin');
    if (storedHash) {
        if (localStorage.getItem('pinConfigured') === 'true') {
            pinHash = storedHash;
        } else {
            localStorage.removeItem('parentalPinHash');
        }
    } else if (storedPlain) {
        localStorage.removeItem('parentalPin');
    }

    try {
        var playlists = localStorage.getItem('playlists');
        if (playlists) {
            state.playlists = JSON.parse(playlists) as Playlist[];
        }
    } catch (e) {}

    var kiosk = localStorage.getItem('kioskMode');
    if (kiosk !== null) {
        state.kioskMode = kiosk === 'true';
    }
}

function historyId(channel: Channel): string {
    var s = channel.url + '|' + channel.name;
    var hash = 5381;
    for (var i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash) + s.charCodeAt(i);
        hash |= 0;
    }
    return 'h' + Math.abs(hash).toString(36);
}

function addToHistory(channel: Channel) {
    var id = historyId(channel);
    state.history = state.history.filter(function (h: HistoryEntry) { return h.id !== id; });
    state.history.unshift({
        id: id,
        name: channel.name,
        url: channel.url,
        logo: channel.logo || ''
    });
    if (state.history.length > 5) {
        state.history = state.history.slice(0, 5);
    }
}

function isPinConfigured(): boolean {
    return localStorage.getItem('pinConfigured') === 'true';
}

async function setPin(newPin: string) {
    pinHash = await hashPin(newPin);
    localStorage.setItem('parentalPinHash', pinHash);
    localStorage.setItem('pinConfigured', 'true');
}

function setPinContext(ctx: string | null) {
    pinContext = ctx;
}

function getPinContext(): string | null {
    return pinContext;
}

async function verifyPin(inputPin: string): Promise<boolean> {
    if (!pinHash) return false;
    var inputHash = await hashPin(inputPin);
    return inputHash === pinHash;
}

async function changePin(oldPin: string, newPin: string): Promise<boolean> {
    if (!pinHash) return false;
    var oldHash = await hashPin(oldPin);
    if (oldHash !== pinHash) return false;
    await setPin(newPin);
    return true;
}

function removePin() {
    localStorage.removeItem('parentalPinHash');
    localStorage.removeItem('pinConfigured');
    pinHash = null;
}

function setPendingChangePinCallback(fn: ((success: boolean) => void) | null) {
    pendingChangePinCallback = fn;
}

function getPendingChangePinCallback(): ((success: boolean) => void) | null {
    return pendingChangePinCallback;
}

function emit(key: string, value: any, oldValue: any) {
    var set = listeners.get(key);
    if (set) {
        for (var cb of set) {
            try { cb(value, oldValue); } catch (e) { console.error('State listener error:', e); }
        }
    }
    var wild = listeners.get('*');
    if (wild) {
        for (var cb of wild) {
            try { cb(key, value, oldValue); } catch (e) { console.error('State listener error:', e); }
        }
    }
}

const state: AppState = new Proxy<AppState>(Object.assign({}, INITIAL_STATE), {
    set(target: AppState, key: string, value: any): boolean {
        if (!(key in target)) {
            console.warn('State: key "' + key + '" no es una propiedad de estado conocida');
        }
        var old = (target as any)[key];
        if (old === value) return true;
        (target as any)[key] = value;
        emit(key, value, old);
        if (PERSIST_KEYS.has(key)) {
            scheduleSave();
        }
        return true;
    }
});

function onStateChange(key: string, callback: StateChangeCallback): () => void {
    if (!listeners.has(key)) listeners.set(key, new Set<StateChangeCallback>());
    listeners.get(key)!.add(callback);
    return function () {
        var s = listeners.get(key);
        if (s) s.delete(callback);
    };
}

function offStateChange(key: string, callback: StateChangeCallback) {
    var s = listeners.get(key);
    if (s) s.delete(callback);
}

export {
    state,
    loadState,
    saveState,
    addToHistory,
    verifyPin,
    isPinConfigured,
    setPin,
    setPinContext,
    getPinContext,
    changePin,
    removePin,
    setPendingChangePinCallback,
    getPendingChangePinCallback,
    onStateChange,
    offStateChange
};
