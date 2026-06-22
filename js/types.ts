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

export interface AppState {
    channels: Channel[];
    currentChannelIndex: number;
    favorites: Set<number>;
    lockedChannels: Set<number>;
    history: HistoryEntry[];
    hls: any;
    dash: any;
    isPlaying: boolean;
    isMuted: boolean;
    volume: number;
    currentFilter: string;
    theme: string;
    pendingChannelIndex: number | null;
    epgData: any;
    epgSource: string;
    playlists: Playlist[];
    kioskMode: boolean;
    expandedGroups: Set<string>;
}
