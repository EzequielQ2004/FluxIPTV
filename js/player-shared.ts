let loadTimeout: ReturnType<typeof setTimeout> | undefined;
let hlsRetryCount = 0;
const MAX_HLS_RETRIES = 3;
let nonFatalErrorCount = 0;
let nonFatalErrorTimer: ReturnType<typeof setTimeout> | undefined;

let isYoutubeMode = false;
let isEmbedMode = false;

export function clearLoadTimeout() {
    if (loadTimeout != null) {
        clearTimeout(loadTimeout);
        loadTimeout = undefined;
    }
}
export function setLoadTimeout(t: ReturnType<typeof setTimeout> | null) { loadTimeout = t ?? undefined; }
export function resetHlsRetry() { hlsRetryCount = 0; }
export function incHlsRetry(): number { return ++hlsRetryCount; }
export function getHlsRetryCount(): number { return hlsRetryCount; }
export { MAX_HLS_RETRIES };
export function resetNonFatalErrors() { nonFatalErrorCount = 0; }
export function incNonFatalErrors(): number { return ++nonFatalErrorCount; }
export function getNonFatalErrorCount(): number { return nonFatalErrorCount; }
export function setNonFatalErrorTimer(t: ReturnType<typeof setTimeout>) { nonFatalErrorTimer = t; }
export function clearNonFatalErrorTimer() {
    if (nonFatalErrorTimer != null) {
        clearTimeout(nonFatalErrorTimer);
        nonFatalErrorTimer = undefined;
    }
}

export function getIsYoutubeMode(): boolean { return isYoutubeMode; }
export function setIsYoutubeMode(v: boolean) { isYoutubeMode = v; }
export function getIsEmbedMode(): boolean { return isEmbedMode; }
export function setIsEmbedMode(v: boolean) { isEmbedMode = v; }
