import type Hls from 'hls.js';
import type { MediaPlayerClass } from 'dashjs';

export interface Channel {
    name: string;
    logo: string;
    group: string;
    url: string;
    userAgent: string;
    referrer: string;
    tvgId: string;
    index: number;
}

export interface HistoryEntry {
    id: string;
    name: string;
    url: string;
    logo: string;
}

export interface Playlist {
    url: string;
    name: string;
    channelCount: number;
    addedAt: string;
}

export interface EpgProgramme {
    start: Date | null;
    stop: Date | null;
    title: string;
    description: string;
    category: string;
    icon: string;
}

export interface AppState {
    channels: Channel[];
    currentChannelIndex: number;
    favorites: Set<string>;
    lockedChannels: Set<string>;
    history: HistoryEntry[];
    hls: Hls | null;
    dash: MediaPlayerClass | null;
    isPlaying: boolean;
    isMuted: boolean;
    volume: number;
    currentFilter: string;
    theme: string;
    pendingChannelIndex: number | null;
    epgData: Record<string, EpgProgramme[]> | null;
    epgSource: string;
    playlists: Playlist[];
    kioskMode: boolean;
    expandedGroups: Set<string>;
}
