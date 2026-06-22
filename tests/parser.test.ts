import { describe, it, expect } from 'vitest';
import { parseM3U } from '../js/parser.ts';

function m3u(lines) {
    return lines.join('\n');
}

describe('parseM3U', () => {
    it('returns empty array for empty string', () => {
        expect(parseM3U('', '')).toEqual([]);
    });

    it('returns empty array for content without #EXTM3U header', () => {
        expect(parseM3U('#EXTINF:-1,Test\nhttp://x.com', '')).toEqual([]);
    });

    it('returns empty array for just the header', () => {
        expect(parseM3U('#EXTM3U', '')).toEqual([]);
    });

    it('parses a single channel', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1,Channel One',
            'http://example.com/stream1'
        ]), '');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Channel One');
        expect(result[0].url).toBe('http://example.com/stream1');
        expect(result[0].group).toBe('General');
        expect(result[0].logo).toBe('');
        expect(result[0].index).toBe(0);
    });

    it('parses tvg-logo attribute', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1 tvg-logo="http://logo.com/img.png",Ch',
            'http://example.com/stream'
        ]), '');
        expect(result[0].logo).toBe('http://logo.com/img.png');
    });

    it('resolves relative logo URL against baseUrl', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1 tvg-logo="/logos/ch1.png",Ch',
            'http://example.com/stream'
        ]), 'http://example.com');
        expect(result[0].logo).toBe('http://example.com/logos/ch1.png');
    });

    it('parses group-title attribute', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1 group-title="Sports",Ch',
            'http://example.com/stream'
        ]), '');
        expect(result[0].group).toBe('Sports');
    });

    it('comma name takes priority over tvg-name', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1 tvg-name="Real Name",Alt Name',
            'http://example.com/stream'
        ]), '');
        expect(result[0].name).toBe('Alt Name');
    });

    it('uses tvg-name when comma name is empty', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1 tvg-name="Only Name",',
            'http://example.com/stream'
        ]), '');
        expect(result[0].name).toBe('Only Name');
    });

    it('parses tvg-id attribute', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1 tvg-id="abc123",Ch',
            'http://example.com/stream'
        ]), '');
        expect(result[0].tvgId).toBe('abc123');
    });

    it('parses http-referrer attribute', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1 http-referrer="https://ref.com",Ch',
            'http://example.com/stream'
        ]), '');
        expect(result[0].referrer).toBe('https://ref.com');
    });

    it('parses http-user-agent attribute', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1 http-user-agent="Mozilla/5.0",Ch',
            'http://example.com/stream'
        ]), '');
        expect(result[0].userAgent).toBe('Mozilla/5.0');
    });

    it('handles #EXTVLCOPT:http-referrer override', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1 http-referrer="https://old.com",Ch',
            '#EXTVLCOPT:http-referrer=https://new.com',
            'http://example.com/stream'
        ]), '');
        expect(result[0].referrer).toBe('https://new.com');
    });

    it('handles #EXTVLCOPT:http-user-agent override', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1 http-user-agent="OldAgent",Ch',
            '#EXTVLCOPT:http-user-agent=NewAgent',
            'http://example.com/stream'
        ]), '');
        expect(result[0].userAgent).toBe('NewAgent');
    });

    it('falls back to default name when none provided', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1,',
            'http://example.com/stream'
        ]), '');
        expect(result[0].name).toBe('Canal sin nombre');
    });

    it('assigns correct indices to multiple channels', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1,Ch A',
            'http://a.com',
            '#EXTINF:-1,Ch B',
            'http://b.com',
            '#EXTINF:-1,Ch C',
            'http://c.com'
        ]), '');
        expect(result).toHaveLength(3);
        expect(result[0].index).toBe(0);
        expect(result[0].name).toBe('Ch A');
        expect(result[1].index).toBe(1);
        expect(result[1].name).toBe('Ch B');
        expect(result[2].index).toBe(2);
        expect(result[2].name).toBe('Ch C');
    });

    it('skips channels without a URL line', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '#EXTINF:-1,Ch A',
            'http://a.com',
            '#EXTINF:-1,Ch B'
        ]), '');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Ch A');
    });

    it('handles blank lines between entries', () => {
        var result = parseM3U(m3u([
            '#EXTM3U',
            '',
            '#EXTINF:-1,Ch A',
            '',
            'http://a.com'
        ]), '');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Ch A');
    });
});
