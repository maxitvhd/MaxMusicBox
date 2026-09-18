export type ThemeMode = 'neon-vinyl' | 'amp-vintage';

export interface Track {
  id: string;
  code: string; // e.g. "01", "12", "101"
  title: string;
  artist: string;
  artistId: string;
  category: string; // e.g. "rock", "samba", "mpb", "sertanejo"
  duration: number; // in seconds
  cost: number; // credits (default 1)
  albumArt: string;
  genre: string;
  bpm: number;
}

export interface Category {
  id: string;
  code?: string; // e.g. "01", "10"
  name: string;
  iconName: string;
  coverImage: string;
  color: string;
  description: string;
}

export interface Artist {
  id: string;
  code?: string;
  name: string;
  categoryId: string;
  avatar: string;
  bio?: string;
}

export interface QueueItem {
  id: string;
  track: Track;
  queuedAt: number;
  requestedBy: string; // "Cliente (Touch)", "Auto-DJ", "Admin"
}

export interface DspSettings {
  eq: {
    band0_80Hz: number; // dB (-12 to +12)
    band1_350Hz: number;
    band2_1kHz: number;
    band3_4kHz: number;
    band4_12kHz: number;
  };
  agcActive: boolean;
  agcSensitivity: number; // 0 to 100%
  compressor: {
    threshold: number; // -60 to 0 dB
    ratio: number; // 1 to 20
    attack: number; // 0.001 to 0.5 s
    release: number; // 0.05 to 1.0 s
  };
  limiterCeiling: number; // -12 to 0 dB
  masterGain: number; // 0.0 to 1.5 (slider)
}

export interface AudioLevels {
  left: number; // 0 to 1 (RMS)
  right: number; // 0 to 1 (RMS)
  peakLeft: number;
  peakRight: number;
}

export interface AutoDjConfig {
  categoryLocked: boolean;
  lockedCategoryId: string;
  weeklySchedule: {
    0: string; // Domingo
    1: string; // Segunda
    2: string; // Terça
    3: string; // Quarta
    4: string; // Quinta
    5: string; // Sexta
    6: string; // Sábado
  };
  dateOverrides: Record<string, string>; // "YYYY-MM-DD": "categoryId"
  historyLimit: number;
}

export interface FinancialTransaction {
  id: string;
  timestamp: number;
  amount: number; // R$
  credits: number;
  paymentMethod: 'pix' | 'dinheiro';
}

export interface FinancialReport {
  pricePerCredit: number; // default 2.50
  totalCreditsInserted: number;
  dailyRevenue: number;
  dailyCredits: number;
  monthlyRevenue: number;
  monthlyCredits: number;
  history: FinancialTransaction[];
}

export interface TauriAudioLevelsPayload {
  left: number;
  right: number;
}

export type KioskSection = 'top' | 'categories' | 'artists' | 'tracks' | 'top15';

export interface MpStatus {
  configured: boolean;
  connected: boolean;
  collectorId: string | null;
  expiresAt: number | null;
  splitPercent: number;
}

export interface PixCharge {
  txId: string;
  paymentId: string;
  qrBase64: string;
  copyPaste: string;
  expiresAt: number;
  amount: number;
  credits: number;
}

export interface NativeSettings {
  theme: ThemeMode;
  pricePerCredit: number;
  splitPercent: number;
  adminPin: string;
  libraryPath: string;
  autoDjConfig: AutoDjConfig;
  mp: MpStatus;
}

export interface KioskKeyboardConfig {
  prefixCategory: string; // default '/'
  prefixTrack: string; // default '*'
  volumeStep: number; // default 0.05
  openPixOnEnter: boolean; // default true
  soundFeedback: boolean; // default true
}

export interface JukeboxUser {
  id: string;
  name: string;
  credits: number;
  createdAt: number;
}

