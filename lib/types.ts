export interface ChannelEntry {
  id: string;
  username: string;
  title: string;
  avatarUrl?: string;
  inaccessible?: boolean;
}

export type MediaType = "photo" | "video" | "audio" | "voice" | "document";

export interface CachedMessage {
  id: number;
  channelId: string;
  channelUsername: string;
  channelTitle: string;
  text: string;
  date: number;
  thumbnail?: string;
  hasMedia: boolean;
  mediaType?: MediaType;
  audioDuration?: number;
  audioTitle?: string;
  audioPerformer?: string;
  audioWaveform?: number[];
  audioSrc?: string;
}

export interface ReadMarker {
  messageId: number;
  channelId: string;
  timestamp: number;
  savedAt: number;
}
