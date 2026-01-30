export interface Highlight {
  id: string;
  text: string;
  note?: string;
  translation?: string;
  color: 'yellow' | 'green' | 'blue' | 'red'; // e-ink simplified colors (gray scales in UI)
  createdAt: number;
  cfi?: string; // Placeholder for future complex location
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  content: string; // For this demo, we treat content as string. Real app would use ArrayBuffer/Url.
  progress: number; // 0 to 1
  totalWords: number;
  lastRead: number;
  highlights: Highlight[];
}

export enum ThemeMode {
  Day = 'day', // #F5F5F5
  Night = 'night', // #1A1A1A (Inverted)
  Sepia = 'sepia', // #F0EAD6
}

export type ViewMode = 'grid' | 'list';

export interface ReaderSettings {
  fontSize: number; // px
  lineHeight: number; // multiplier
  marginHorizontal: number; // px
  fontFamily: string;
  warmth: number; // 0 to 100 (Blue light filter)
  textAlign: 'justify' | 'left';
  theme: ThemeMode;
  highContrast: boolean;
  eInkMode: boolean; // Disables animations
  twoColumnMode: boolean; // Dual page view
  chineseConversion: boolean; // Simplified to Traditional
  readingSpeed: number;
  paragraphSpacing: number;
  bilingualMode: boolean;
  ttsEnabled: boolean; // Paragraph click-to-read
}

export interface ReadingStats {
  startTime: number;
  wordsRead: number;
  readingSpeed: number; // wpm
}