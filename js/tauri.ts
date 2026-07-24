import { togglePlayPause } from './player-core.ts';
import { nextChannel, prevChannel } from './player-core.ts';

let isTauri = false;

function initTauri() {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
        isTauri = true;
        if ('core' in window.__TAURI__) {
            const core = (window as any).__TAURI__.core;

            core.listen('media:play_pause', () => {
                togglePlayPause();
            });

            core.listen('media:next', () => {
                nextChannel();
            });

            core.listen('media:prev', () => {
                prevChannel();
            });
        }
    }
}

export function getIsTauri(): boolean {
    return isTauri;
}

export { initTauri };
