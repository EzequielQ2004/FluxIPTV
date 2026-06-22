function getFallbackImage(size?: number): string {
    size = size || 48;
    var offset = Math.round((size - 24) / 2);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '">' +
        '<rect fill="#0f172a" width="' + size + '" height="' + size + '"/>' +
        '<g stroke="#94a3b8" stroke-width="2" fill="none" transform="translate(' + offset + ',' + offset + ')">' +
        '<rect x="2" y="3" width="20" height="14" rx="2"/>' +
        '<line x1="8" y1="21" x2="16" y2="21"/>' +
        '<line x1="12" y1="17" x2="12" y2="21"/>' +
        '</g></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function escapeHtml(str?: string): string {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function handleImageError(img: HTMLImageElement): void {
    if (img.dataset.fallback) return;
    img.dataset.fallback = '1';
    var w = img.offsetWidth || img.width || parseInt(img.getAttribute('width') || '48', 10);
    img.src = getFallbackImage(w);
}

var logoWarmSet = new Set<string>();

function getCachedLogoUrl(url: string): string {
    return url;
}

function prefetchLogo(url: string): void {
    if (!url || url.startsWith('data:') || logoWarmSet.has(url)) return;
    logoWarmSet.add(url);
    var img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = url;
}

function prefetchChannelLogos(channels?: { logo: string }[]): void {
    if (!channels) return;
    for (var i = 0; i < channels.length; i++) {
        var logo = channels[i].logo;
        if (logo && !logo.startsWith('data:')) {
            prefetchLogo(logo);
        }
    }
}

(window as any).handleImageError = handleImageError;

export { getFallbackImage, handleImageError, escapeHtml, getCachedLogoUrl, prefetchLogo, prefetchChannelLogos };
