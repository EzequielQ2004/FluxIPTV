import type { Channel } from './types.ts';
import { parseM3U } from './parser.ts';

interface PendingParse {
    resolve: (channels: Channel[]) => void;
    reject: (err: Error) => void;
}

var m3uWorker: Worker | null = null;
var pendingParses = new Map<number, PendingParse>();
var nextParseId = 1;

function createM3UWorker(): Worker | null {
    try {
        return new Worker(new URL('./m3u.worker.ts', import.meta.url), { type: 'module' });
    } catch (err) {
        return null;
    }
}

function attachWorkerHandlers(w: Worker): void {
    w.addEventListener('message', function (event: MessageEvent) {
        var data = event.data as { type: string; id: number; channels?: Channel[]; error?: string };
        if (!data || data.type !== 'result') return;
        var pending = pendingParses.get(data.id);
        if (!pending) return;
        pendingParses.delete(data.id);
        if (data.error) {
            pending.reject(new Error(data.error));
        } else {
            pending.resolve(data.channels || []);
        }
    });
    w.addEventListener('error', function () {
        var err = new Error('M3U parser worker failed');
        pendingParses.forEach(function (pending) { pending.reject(err); });
        pendingParses.clear();
        m3uWorker = null;
    });
}

function parseM3UInWorker(content: string, baseUrl?: string): Promise<Channel[]> {
    var w = m3uWorker;
    if (w === null) {
        w = createM3UWorker();
        if (w === null) {
            return Promise.resolve(parseM3U(content, baseUrl));
        }
        attachWorkerHandlers(w);
        m3uWorker = w;
    }
    const worker = w as Worker;

    var id = nextParseId++;
    return new Promise<Channel[]>(function (resolve, reject) {
        try {
            worker.postMessage({ type: 'parse', id: id, content: content, baseUrl: baseUrl });
            pendingParses.set(id, {
                resolve: resolve,
                reject: function (err: Error) {
                    pendingParses.delete(id);
                    reject(err);
                }
            });
        } catch (err) {
            pendingParses.delete(id);
            worker.terminate();
            m3uWorker = null;
            try {
                resolve(parseM3U(content, baseUrl));
            } catch (parseErr) {
                reject(parseErr as any);
            }
        }
    });
}

export { parseM3UInWorker };