export interface ChannelEntry {
  id: string;
  username: string;
  title: string;
  avatarUrl?: string;
  inaccessible?: boolean;
}

export interface CachedMessage {
  id: number;
  channelId: string;
  channelUsername: string;
  channelTitle: string;
  text: string;
  date: number;
  thumbnail?: string;
  hasMedia: boolean;
}

export interface ReadMarker {
  messageId: number;
  channelId: string;
  timestamp: number;
}
