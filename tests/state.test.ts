import { describe, it, expect, beforeEach } from 'vitest';
import { state, addToHistory, verifyPin, isPinConfigured, setPin, changePin, removePin, loadState, saveState, onStateChange, offStateChange } from '../js/state.ts';

beforeEach(() => {
    const store: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: (k: string) => store[k] ?? null,
            setItem: (k: string, v: string) => { store[k] = String(v); },
            removeItem: (k: string) => { delete store[k]; },
            clear: () => { for (const k in store) delete store[k]; },
        },
        writable: true,
        configurable: true,
    });
    state.channels = [];
    state.currentChannelIndex = -1;
    state.favorites = new Set();
    state.lockedChannels = new Set();
    state.history = [];
    state.hls = null;
    state.dash = null;
    state.isPlaying = false;
    state.isMuted = false;
    state.volume = 1;
    state.currentFilter = 'all';
    state.theme = 'auto';
    state.pendingChannelIndex = null;
    state.epgData = null;
    state.epgSource = '';
    state.playlists = [];
    state.kioskMode = false;
    state.expandedGroups = new Set();
    removePin();
});

describe('PIN management', () => {
    it('setPin and verifyPin with correct PIN', async () => {
        await setPin('1234');
        expect(await verifyPin('1234')).toBe(true);
    });

    it('verifyPin rejects wrong PIN', async () => {
        await setPin('1234');
        expect(await verifyPin('5678')).toBe(false);
    });

    it('verifyPin returns false when no PIN is set', async () => {
        expect(await verifyPin('1234')).toBe(false);
    });

    it('changePin with correct old PIN succeeds', async () => {
        await setPin('1234');
        expect(await changePin('1234', '5678')).toBe(true);
        expect(await verifyPin('5678')).toBe(true);
        expect(await verifyPin('1234')).toBe(false);
    });

    it('changePin with wrong old PIN fails', async () => {
        await setPin('1234');
        expect(await changePin('wrong', '5678')).toBe(false);
        expect(await verifyPin('1234')).toBe(true);
    });

    it('removePin clears PIN', async () => {
        await setPin('1234');
        removePin();
        expect(await verifyPin('1234')).toBe(false);
        expect(isPinConfigured()).toBe(false);
    });

    it('isPinConfigured reflects PIN state', async () => {
        expect(isPinConfigured()).toBe(false);
        await setPin('1234');
        expect(isPinConfigured()).toBe(true);
        removePin();
        expect(isPinConfigured()).toBe(false);
    });
});

describe('addToHistory', () => {
    it('adds entry with correct structure', () => {
        addToHistory({ name: 'Test Channel', url: 'http://example.com/stream', logo: 'http://example.com/logo.png' } as any);
        expect(state.history).toHaveLength(1);
        expect(state.history[0].name).toBe('Test Channel');
        expect(state.history[0].url).toBe('http://example.com/stream');
        expect(state.history[0].logo).toBe('http://example.com/logo.png');
        expect(state.history[0].id).toBeTruthy();
    });

    it('deduplicates by url+name', () => {
        const ch = { name: 'Test', url: 'http://example.com/stream', logo: '' };
        addToHistory(ch as any);
        addToHistory(ch as any);
        expect(state.history).toHaveLength(1);
    });

    it('limits to 5 entries', () => {
        for (let i = 1; i <= 6; i++) {
            addToHistory({ name: 'Ch' + i, url: 'http://example.com/' + i, logo: '' } as any);
        }
        expect(state.history).toHaveLength(5);
    });

    it('maintains newest-first order', () => {
        addToHistory({ name: 'First', url: 'http://a.com', logo: '' } as any);
        addToHistory({ name: 'Second', url: 'http://b.com', logo: '' } as any);
        expect(state.history[0].name).toBe('Second');
        expect(state.history[1].name).toBe('First');
    });

    it('uses empty string for missing logo', () => {
        addToHistory({ name: 'Test', url: 'http://a.com' } as any);
        expect(state.history[0].logo).toBe('');
    });
});

describe('state Proxy', () => {
    it('stores and retrieves boolean values', () => {
        state.isPlaying = true;
        expect(state.isPlaying).toBe(true);
    });

    it('stores and retrieves string values', () => {
        state.currentFilter = 'favorites';
        expect(state.currentFilter).toBe('favorites');
    });

    it('stores and retrieves number values', () => {
        state.volume = 0.5;
        expect(state.volume).toBe(0.5);
    });

    it('setting same value does not trigger emission or save', () => {
        const cb = vi.fn();
        onStateChange('isPlaying', cb);
        state.isPlaying = false;
        state.isPlaying = false;
        expect(cb).not.toHaveBeenCalled();
    });
});

describe('onStateChange / offStateChange', () => {
    it('calls listener when property changes', () => {
        const cb = vi.fn();
        onStateChange('isPlaying', cb);
        state.isPlaying = true;
        expect(cb).toHaveBeenCalledWith(true, false);
    });

    it('listener receives new and old values', () => {
        state.volume = 0.5;
        const cb = vi.fn();
        onStateChange('volume', cb);
        state.volume = 0.8;
        expect(cb).toHaveBeenCalledWith(0.8, 0.5);
    });

    it('stops calling after unsubscribe', () => {
        const cb = vi.fn();
        const unsubscribe = onStateChange('isPlaying', cb);
        unsubscribe();
        state.isPlaying = true;
        expect(cb).not.toHaveBeenCalled();
    });

    it('offStateChange removes listener', () => {
        const cb = vi.fn();
        onStateChange('isPlaying', cb);
        offStateChange('isPlaying', cb);
        state.isPlaying = true;
        expect(cb).not.toHaveBeenCalled();
    });
});

describe('loadState / saveState', () => {
    it('persists and restores theme', () => {
        state.theme = 'dark';
        saveState();
        state.theme = 'auto';
        loadState();
        expect(state.theme).toBe('dark');
    });

    it('persists and restores history', () => {
        addToHistory({ name: 'Saved', url: 'http://a.com', logo: '' } as any);
        saveState();
        state.history = [];
        loadState();
        expect(state.history).toHaveLength(1);
        expect(state.history[0].name).toBe('Saved');
    });

    it('persists and restores favorites', () => {
        state.favorites.add('ch1');
        saveState();
        state.favorites = new Set();
        loadState();
        expect(state.favorites.has('ch1')).toBe(true);
    });

    it('persists and restores kioskMode', () => {
        state.kioskMode = true;
        saveState();
        state.kioskMode = false;
        loadState();
        expect(state.kioskMode).toBe(true);
    });

    it('persists and restores lockedChannels', () => {
        state.lockedChannels.add('http://example.com/ch1');
        state.lockedChannels.add('http://example.com/ch2');
        saveState();
        state.lockedChannels = new Set();
        loadState();
        expect(state.lockedChannels.has('http://example.com/ch1')).toBe(true);
        expect(state.lockedChannels.has('http://example.com/ch2')).toBe(true);
    });

    it('persists and restores playlists', () => {
        state.playlists = [{ url: 'http://example.com/list.m3u', name: 'Test', channelCount: 10, addedAt: '2025-01-01' }];
        saveState();
        state.playlists = [];
        loadState();
        expect(state.playlists).toHaveLength(1);
        expect(state.playlists[0].name).toBe('Test');
    });

    it('does not crash when localStorage.setItem throws', () => {
        Object.defineProperty(globalThis, 'localStorage', {
            value: {
                getItem: (k: string) => null,
                setItem: () => { throw new Error('QuotaExceeded'); },
                removeItem: () => {},
                clear: () => {},
            },
            writable: true,
            configurable: true,
        });
        expect(() => saveState()).not.toThrow();
    });

    it('loads default state when localStorage is unavailable', () => {
        Object.defineProperty(globalThis, 'localStorage', {
            value: {
                getItem: () => { throw new Error('not available'); },
                setItem: () => { throw new Error('not available'); },
                removeItem: () => { throw new Error('not available'); },
                clear: () => { throw new Error('not available'); },
            },
            writable: true,
            configurable: true,
        });
        loadState();
        expect(state.theme).toBe('auto');
        expect(state.favorites.size).toBe(0);
    });

    it('loads default state when history JSON is corrupted', () => {
        localStorage.setItem('history', '{bad json');
        loadState();
        expect(state.history).toEqual([]);
    });
});
