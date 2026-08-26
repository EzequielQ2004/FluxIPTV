import type dashjs from 'dashjs';
import { state } from './state.ts';
import { clearLoadTimeout } from './player-shared.ts';
import { fallbackToNative } from './player-ui-helpers.ts';
import { Channel } from './types.ts';

function dashManifestLoaded(): void {
    clearLoadTimeout();
}

function dashError(event: any): void {
    console.error('DASH error:', event);
}

async function setupDash(video: HTMLVideoElement, channel: Channel): Promise<void> {
    var dashjs = await import('dashjs');
    state.dash = dashjs.MediaPlayer().create();
    state.dash.initialize(video, channel.url, true);
    state.dash.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, dashManifestLoaded);
    state.dash.on(dashjs.MediaPlayer.events.ERROR, dashError);
}

function destroyDash(): void {
    if (!state.dash) return;
    try {
        state.dash.off('MANIFEST_LOADED' as any, dashManifestLoaded);
        state.dash.off('ERROR' as any, dashError);
    } catch (e) {}
    state.dash.reset();
    state.dash = null;
}

export { setupDash, destroyDash, dashManifestLoaded, dashError };
