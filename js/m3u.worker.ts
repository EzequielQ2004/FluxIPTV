import { parseM3U } from './parser.ts';
import type { Channel } from './types.ts';

interface ParseRequest {
    type: 'parse';
    id: number;
    content: string;
    baseUrl?: string;
}

interface ParseResult {
    type: 'result';
    id: number;
    channels?: Channel[];
    error?: string;
}

const ctx = self as unknown as Worker;

ctx.addEventListener('message', (event: MessageEvent) => {
    const request = event.data as ParseRequest;
    if (!request || request.type !== 'parse') return;

    let result: ParseResult;
    try {
        result = { type: 'result', id: request.id, channels: parseM3U(request.content, request.baseUrl) };
    } catch (err: any) {
        result = { type: 'result', id: request.id, error: err && err.message ? String(err.message) : 'M3U parse error' };
    }
    ctx.postMessage(result);
});