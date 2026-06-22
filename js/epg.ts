import { t, getLocale } from './i18n.ts';
import { state } from './state.ts';
import { elements, openModal } from './ui.ts';
import { getFallbackImage, escapeHtml } from './fallback-image.ts';

interface EpgProgramme {
    start: Date | null;
    stop: Date | null;
    title: string;
    description: string;
    category: string;
    icon: string;
}

function parseXmltvDate(xmltvDate: string): Date {
    var match = xmltvDate.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{2})(\d{2})?$/);
    if (!match) return new Date(xmltvDate);
    var year = parseInt(match[1], 10);
    var month = parseInt(match[2], 10) - 1;
    var day = parseInt(match[3], 10);
    var hour = parseInt(match[4], 10);
    var min = parseInt(match[5], 10);
    var sec = parseInt(match[6], 10);
    var tzSign = match[7][0] === '+' ? 1 : -1;
    var tzHour = parseInt(match[7].substring(1), 10);
    var tzMin = parseInt(match[8] || '0', 10);
    var date = new Date(Date.UTC(year, month, day, hour - tzSign * tzHour, min - tzSign * tzMin, sec));
    return date;
}

function parseXmltv(xmlText: string): Record<string, EpgProgramme[]> {
    var parser = new DOMParser();
    var doc = parser.parseFromString(xmlText, 'text/xml');
    var programmes = doc.querySelectorAll('programme');
    var epgMap: Record<string, EpgProgramme[]> = {};

    programmes.forEach(function (prog) {
        var channelId = prog.getAttribute('channel');
        if (!channelId) return;

        var titleEl = prog.querySelector('title');
        var descEl = prog.querySelector('desc');
        var catEl = prog.querySelector('category');
        var iconEl = prog.querySelector('icon');

        var start = prog.getAttribute('start');
        var stop = prog.getAttribute('stop');

        var item: EpgProgramme = {
            start: start ? parseXmltvDate(start) : null,
            stop: stop ? parseXmltvDate(stop) : null,
            title: titleEl ? titleEl.textContent || '' : t('epg.noTitle'),
            description: descEl ? descEl.textContent || '' : '',
            category: catEl ? catEl.textContent || '' : '',
            icon: iconEl ? iconEl.getAttribute('src') || '' : ''
        };

        if (!epgMap[channelId]) {
            epgMap[channelId] = [];
        }
        epgMap[channelId].push(item);
    });

    // Sort programmes by start time for each channel
    for (var id in epgMap) {
        epgMap[id].sort(function (a, b) {
            return (a.start as any) - (b.start as any);
        });
    }

    return epgMap;
}

function loadEpgFromUrl(url: string): Promise<any> {
    if (!url) return Promise.resolve(null);
    return fetch(url).then(function (response: Response) {
        if (!response.ok) throw new Error(t('epg.downloadError'));
        return response.text();
    }).then(function (text: string) {
        var data = parseXmltv(text);
        state.epgData = data;
        state.epgSource = url;
        return data;
    });
}

function getCurrentProgramme(programmes: EpgProgramme[]): EpgProgramme | null {
    if (!programmes || programmes.length === 0) return null;
    var now = new Date();
    for (var i = 0; i < programmes.length; i++) {
        var prog = programmes[i];
        if (prog.start && prog.stop && prog.start <= now && prog.stop > now) {
            return prog;
        }
    }
    return null;
}

function getNextProgrammes(programmes: EpgProgramme[], count?: number): EpgProgramme[] {
    if (!programmes || programmes.length === 0) return [];
    count = count || 6;
    var now = new Date();
    var result: EpgProgramme[] = [];
    for (var i = 0; i < programmes.length; i++) {
        var prog = programmes[i];
        if (prog.stop && prog.stop > now) {
            result.push(prog);
            if (result.length >= count) break;
        }
    }
    return result;
}

function showEpg(): void {
    if (state.currentChannelIndex < 0 || state.currentChannelIndex >= state.channels.length) {
        return;
    }

    var channel = state.channels[state.currentChannelIndex];
    var tvgId = channel.tvgId;

    document.getElementById('epgChannelInfo')!.innerHTML = [
        '<img class="epg-channel-logo" src="' + escapeHtml(channel.logo || getFallbackImage(64)) + '" alt="' + escapeHtml(channel.name) + '" decoding="async" referrerpolicy="no-referrer" onerror="handleImageError(this)">',
        '<div>',
        '<h3 style="font-size: 1.25rem; font-weight: 600;">' + escapeHtml(channel.name) + '</h3>',
        '<p style="color: var(--text-secondary); font-size: 0.875rem;">' + escapeHtml(channel.group) + '</p>',
        '<p style="color: var(--text-secondary); font-size: 0.75rem;">tvg-id: ' + escapeHtml(tvgId || '—') + '</p>',
        '</div>'
    ].join('');

    var epgList = document.getElementById('epgList')!;
    var programmes = state.epgData && tvgId ? (state.epgData as Record<string, EpgProgramme[]>)[tvgId] : null;

    if (!programmes || programmes.length === 0) {
        epgList.innerHTML = [
            '<div class="empty-state">',
            '<div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>',
            '<p>' + (tvgId ? t('epg.noPrograms') : t('epg.noTvgId')) + '</p>',
            '<p style="font-size: 0.75rem; margin-top: 0.5rem; color: var(--text-secondary);">' + (state.epgSource ? t('epg.loadedFrom') + ' ' + escapeHtml(state.epgSource) : t('epg.loadPrompt')) + '</p>',
            '</div>'
        ].join('');
    } else {
        var current = getCurrentProgramme(programmes);
        var next = getNextProgrammes(programmes, 10);
        var html = '';

        if (current) {
            var endTime = current.stop ? current.stop.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : '';
            html += [
                '<div class="epg-item epg-item-current">',
                '<div class="epg-item-label">' + t('epg.now') + '</div>',
                '<div class="epg-item-time">' + endTime + '</div>',
                '<div class="epg-item-title">' + escapeHtml(current.title) + '</div>',
                current.description ? '<div class="epg-item-desc">' + escapeHtml(current.description) + '</div>' : '',
                '</div>'
            ].join('');
        }

        next.forEach(function (prog) {
            var startTime = prog.start ? prog.start.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : '';
            var endTime = prog.stop ? prog.stop.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : '';
            html += [
                '<div class="epg-item">',
                '<div class="epg-item-time">' + startTime + ' - ' + endTime + '</div>',
                '<div class="epg-item-title">' + escapeHtml(prog.title) + '</div>',
                prog.description ? '<div class="epg-item-desc">' + escapeHtml(prog.description) + '</div>' : '',
                '</div>'
            ].join('');
        });

        epgList.innerHTML = html;
    }

    openModal(elements.epgModal);
}

export { showEpg, loadEpgFromUrl, parseXmltv };
