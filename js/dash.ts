import * as dashjs from 'dashjs';
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

function setupDash(video: HTMLVideoElement, channel: Channel): void {
    if (typeof dashjs === 'undefined') {
        console.warn('dashjs not loaded, falling back to native');
        fallbackToNative(channel.url);
        return;
    }
    state.dash = dashjs.MediaPlayer().create();
    state.dash.initialize(video, channel.url, true);
    state.dash.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, dashManifestLoaded);
    state.dash.on(dashjs.MediaPlayer.events.ERROR, dashError);
}

export { setupDash, dashManifestLoaded, dashError };
