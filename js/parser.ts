import { Channel } from './types.ts';

const DEFAULT_CHANNEL_NAME = 'Canal sin nombre';

function parseM3U(content: string, baseUrl?: string): Channel[] {
    if (!content || !content.trim().startsWith('#EXTM3U')) {
        return [];
    }

    const lines = content.split('\n');
    const channels: Channel[] = [];
    let currentChannel: Channel | null = null;
    let index = 0;

    for (let line of lines) {
        line = line.trim();

        if (line.startsWith('#EXTINF:')) {
            currentChannel = {
                name: DEFAULT_CHANNEL_NAME,
                logo: '',
                group: 'General',
                url: '',
                userAgent: '',
                referrer: '',
                tvgId: ''
            } as Channel;

            const commaIndex = line.lastIndexOf(',');
            if (commaIndex !== -1) {
                const nameAfterComma = line.substring(commaIndex + 1).trim();
                if (nameAfterComma) {
                    currentChannel.name = nameAfterComma;
                }
            }

            if (currentChannel.name === DEFAULT_CHANNEL_NAME) {
                const nameMatch = line.match(/tvg-name="([^"]*)"/);
                if (nameMatch && nameMatch[1]) {
                    currentChannel.name = nameMatch[1];
                }
            }

            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
            if (logoMatch) {
                currentChannel.logo = logoMatch[1];
                if (baseUrl && currentChannel.logo && !currentChannel.logo.startsWith('http')) {
                    try {
                        currentChannel.logo = new URL(currentChannel.logo, baseUrl).href;
                    } catch (e) {}
                }
            }

            const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
            if (tvgIdMatch) {
                currentChannel.tvgId = tvgIdMatch[1];
            }

            const groupMatch = line.match(/group-title="([^"]*)"/);
            if (groupMatch) {
                currentChannel.group = groupMatch[1];
            }

            const refMatch = line.match(/http-referrer="([^"]*)"/);
            if (refMatch) {
                currentChannel.referrer = refMatch[1];
            }

            const uaMatch = line.match(/http-user-agent="([^"]*)"/);
            if (uaMatch) {
                currentChannel.userAgent = uaMatch[1];
            }

        } else if (line.startsWith('#EXTVLCOPT:') && currentChannel) {
            const refOpt = line.match(/^#EXTVLCOPT:http-referrer=(.*)/);
            if (refOpt) currentChannel.referrer = refOpt[1];
            const uaOpt = line.match(/^#EXTVLCOPT:http-user-agent=(.*)/);
            if (uaOpt) currentChannel.userAgent = uaOpt[1];

        } else if (line && !line.startsWith('#') && currentChannel) {
            currentChannel.url = line;
            currentChannel.index = index++;
            channels.push(currentChannel);
            currentChannel = null;
        }
    }

    return channels;
}

export { parseM3U, DEFAULT_CHANNEL_NAME };
