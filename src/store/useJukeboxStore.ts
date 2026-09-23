import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  ThemeMode, 
  Track, 
  Category, 
  Artist, 
  QueueItem, 
  DspSettings, 
  AutoDjConfig, 
  FinancialReport,
  KioskKeyboardConfig,
  AudioLevels,
  MpStatus,
  PixCharge,
  NativeSettings,
  JukeboxUser,
  DeductResult,
  Advertisement,
  ScreensaverConfig
} from '../types';
import { INITIAL_CATEGORIES, INITIAL_ARTISTS, INITIAL_TRACKS } from '../data/musicCatalog';
import { audioEngine } from '../services/audioEngine';
import { tauriBridge } from '../services/tauriBridge';
import { ensureArt } from '../utils/albumArt';

// No app nativo o catálogo/financeiro vêm do Rust: nada de dados demo.
const IS_NATIVE = tauriBridge.isNative;

// Itens por página nas listas (teclado numérico 1-9 seleciona; 0 = play/pause).
export const PAGE_SIZE = 9;

const emptyFinancialReport = (): FinancialReport => ({
  pricePerCredit: 2.5,
  totalCreditsInserted: 0,
  dailyRevenue: 0,
  dailyCredits: 0,
  monthlyRevenue: 0,
  monthlyCredits: 0,
  history: []
});

interface KioskHudState {
  text: string;
  subText?: string;
  visible: boolean;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface JukeboxState {
  // Theme & UI state
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // Music Catalog
  categories: Category[];
  artists: Artist[];
  tracks: Track[];
  selectedCategory: Category | null;
  selectedArtist: Artist | null;
  setSelectedCategory: (cat: Category | null) => void;
  setSelectedArtist: (art: Artist | null) => void;

  // Active Kiosk Section navigation
  activeSection: 'categories' | 'artists' | 'tracks' | 'top15';
  setActiveSection: (sec: 'categories' | 'artists' | 'tracks' | 'top15') => void;

  // Paginação das listas (9 por página; teclado numérico seleciona 1-9)
  artistPage: number;
  trackPage: number;
  setArtistPage: (page: number) => void;
  setTrackPage: (page: number) => void;

  // Tela dedicada de músicas (overlay full-screen)
  browserOpen: boolean;
  browserMode: 'category' | 'artist' | 'tracks' | 'top15';
  openBrowser: (modeOrCat?: 'category' | 'artist' | 'tracks' | 'top15' | string | null, artistId?: string | null) => void;
  closeBrowser: () => void;

  // Admin PIN
  adminPin: string;
  setAdminPin: (pin: string) => void;

  // User Pending Playlist (Credit Builder)
  userPlaylist: Track[];
  addToUserPlaylist: (track: Track) => boolean;
  removeFromUserPlaylist: (trackId: string) => void;
  clearUserPlaylist: () => void;
  commitUserPlaylist: () => boolean;

  // Playback & Queue
  currentTrack: Track | null;
  isPlaying: boolean;
  progressSeconds: number;
  queue: QueueItem[];
  playedHistory: string[]; // up to 20 IDs

  playTrack: (track: Track, requestedBy?: string) => Promise<void>;
  pauseTrack: () => void;
  resumeTrack: () => void;
  skipTrack: () => void;
  addToQueue: (track: Track, requestedBy?: string) => boolean;
  removeQueueItem: (queueId: string) => void;
  setProgressSeconds: (sec: number) => void;

  // Keypad
  keypadBuffer: string;
  keypadFeedback: 'idle' | 'success' | 'error';
  handleKeypadDigit: (digit: string) => void;
  handleKeypadCorrect: () => void;
  handleKeypadConfirm: () => void;

  // Kiosk Keyboard Navigation & HUD
  kioskKeyboardConfig: KioskKeyboardConfig;
  setKioskKeyboardConfig: (config: Partial<KioskKeyboardConfig>) => void;
  kioskHud: KioskHudState;
  showKioskHud: (text: string, subText?: string, type?: KioskHudState['type'], durationMs?: number) => void;
  hideKioskHud: () => void;
  increaseVolume: () => void;
  decreaseVolume: () => void;

  // Financial & Credits
  credits: number;
  financialReport: FinancialReport;
  addCredits: (creditsToAdd: number, amountPaid: number, method?: 'pix' | 'dinheiro') => void;
  deductCredit: () => boolean;

  // DSP State
  dspSettings: DspSettings;
  setEqBand: (bandIndex: number, gainDb: number) => void;
  setCompressor: (threshold: number, ratio: number, attack?: number, release?: number) => void;
  setAgc: (active: boolean, sensitivity?: number) => void;
  setLimiterCeiling: (ceilingDb: number) => void;
  setMasterGain: (gain: number) => void;

  // Auto-DJ & Scheduling
  autoDjConfig: AutoDjConfig;
  setCategoryLocked: (locked: boolean, categoryId?: string) => void;
  setWeeklySchedule: (dayOfWeek: number, categoryId: string) => void;
  setDateOverride: (dateString: string, categoryId: string) => void;
  removeDateOverride: (key: string) => void;
  triggerAutoDjNext: () => void;

  // Live audio telemetry (Rust DSP nativo ou motor WebAudio no navegador)
  audioLevels: AudioLevels;
  audioSpectrum: number[];
  setAudioLevels: (levels: Partial<AudioLevels>) => void;
  setAudioSpectrum: (bands: number[]) => void;

  // Catálogo real + configurações do backend nativo
  isCatalogLoaded: boolean;
  loadCatalog: () => Promise<void>;
  applyNativeSettings: (settings: NativeSettings) => void;
  handleTrackEnded: () => void;
  refreshFinancialReport: () => Promise<void>;

  // Mercado Pago (Pix marketplace)
  mpStatus: MpStatus;
  mpError: string | null;
  activeCharge: PixCharge | null;
  setMpStatus: (status: MpStatus) => void;
  setMpError: (error: string | null) => void;
  setActiveCharge: (charge: PixCharge | null) => void;
  refreshMpStatus: () => Promise<void>;
  handlePixPaid: (payload: {
    credits: number;
    amount: number;
    tx_id: string;
    payment_id?: string;
    userCode?: string;
    user?: JukeboxUser | null;
  }) => void;

  setPricePerCredit: (price: number) => void;

  // Modals & Navigation
  isPixModalOpen: boolean;
  isAdminModalOpen: boolean;
  isSecondaryScreenOpen: boolean;
  isAccessibilityKeypadOpen: boolean;
  setPixModalOpen: (open: boolean) => void;
  setAdminModalOpen: (open: boolean) => void;
  setSecondaryScreenOpen: (open: boolean) => void;
  setAccessibilityKeypadOpen: (open: boolean) => void;

  // User Accounts (nativo: senha única libera o saldo da conta)
  users: JukeboxUser[];
  currentUser: JukeboxUser | null;
  lastPurchasedPin: string | null;
  setLastPurchasedPin: (pin: string | null) => void;
  isUserLoginOpen: boolean;
  setUserLoginOpen: (open: boolean) => void;
  listUsers: () => Promise<void>;
  createUser: (name: string, password: string, credits: number) => Promise<{ ok: boolean; error?: string }>;
  updateUser: (id: string, name: string, password: string, credits: number) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<void>;
  authenticateUser: (password: string) => Promise<{ ok: boolean; error?: string }>;
  logoutUser: () => void;
  addUserCredits: (id: string, credits: number) => Promise<void>;

  // Publicidade & Anúncios da Nuvem Máximo
  ads: Advertisement[];
  setAds: (ads: Advertisement[]) => void;
  screensaverConfig: ScreensaverConfig;
  setScreensaverConfig: (cfg: ScreensaverConfig) => void;
}

export const useJukeboxStore = create<JukeboxState>()(
  persist(
    (set, get) => ({
      theme: 'neon-vinyl',
      setTheme: (theme) => {
        set({ theme });
        tauriBridge.invoke('set_theme', { theme });
        tauriBridge.emit('theme_changed', { theme });
      },

      audioLevels: { left: 0, right: 0, peakLeft: 0, peakRight: 0 },
      audioSpectrum: new Array(16).fill(0),
      setAudioLevels: (levels) =>
        set((s) => ({ audioLevels: { ...s.audioLevels, ...levels } })),
      setAudioSpectrum: (bands) => set({ audioSpectrum: bands }),

      isCatalogLoaded: false,
      mpStatus: { configured: false, connected: false, collectorId: null, expiresAt: null, splitPercent: 5 },
      mpError: null,
      activeCharge: null,
      setMpStatus: (status) => set({ mpStatus: status, mpError: null }),
      setMpError: (error) => set({ mpError: error }),
      setActiveCharge: (charge) => set({ activeCharge: charge }),

      ads: [],
      setAds: (ads) => set({ ads }),
      screensaverConfig: { tempo_inatividade_minutos: 3, estilo: 'winamp_media_visualizer' },
      setScreensaverConfig: (screensaverConfig) => set({ screensaverConfig }),
      refreshMpStatus: async () => {
        const status = await tauriBridge.invoke<MpStatus>('mp_oauth_status');
        if (status) set({ mpStatus: status });
      },
      refreshFinancialReport: async () => {
        const report = await tauriBridge.invoke<FinancialReport>('get_financial_report');
        if (report) set({ financialReport: report });
      },
      applyNativeSettings: (settings) => {
        const state = get();
        const next: Partial<JukeboxState> = {};
        if (settings.theme) next.theme = settings.theme;
        if (settings.autoDjConfig) next.autoDjConfig = { ...state.autoDjConfig, ...settings.autoDjConfig };
        if (settings.mp) next.mpStatus = settings.mp;
        if (settings.adminPin) next.adminPin = settings.adminPin;
        if (typeof settings.pricePerCredit === 'number') {
          next.financialReport = { ...state.financialReport, pricePerCredit: settings.pricePerCredit };
        }
        set(next as JukeboxState);
      },
      handleTrackEnded: () => {
        const state = get();
        if (state.queue.length > 0) {
          state.skipTrack();
        } else {
          state.triggerAutoDjNext();
        }
      },
      handlePixPaid: ({ credits, amount, tx_id, userCode, user }) => {
        const state = get();
        if (state.financialReport.history.some((h) => h.id === tx_id)) {
          set({ activeCharge: null, mpError: null });
          return;
        }
        const newTransaction = {
          id: tx_id,
          timestamp: Date.now(),
          amount,
          credits,
          paymentMethod: 'pix' as const
        };
        const report = state.financialReport;
        const pin = userCode || (user ? user.id.replace('temp-', '') : null);
        const activeUser = user || (pin ? { id: `temp-${pin}`, name: `Cliente #${pin}`, credits, createdAt: Date.now() } : state.currentUser);

        set({
          credits: state.credits + credits,
          activeCharge: null,
          mpError: null,
          lastPurchasedPin: pin,
          currentUser: activeUser,
          financialReport: {
            ...report,
            totalCreditsInserted: report.totalCreditsInserted + credits,
            dailyRevenue: report.dailyRevenue + amount,
            dailyCredits: report.dailyCredits + credits,
            monthlyRevenue: report.monthlyRevenue + amount,
            monthlyCredits: report.monthlyCredits + credits,
            history: [newTransaction, ...report.history]
          }
        });

        if (pin) {
          state.showKioskHud(
            `✓ Pix Confirmado! Código: ${pin}`,
            `+${credits} crédito(s) liberado(s) | Digite 0000 + ENTER para sair`,
            'success',
            8000
          );
        } else {
          state.showKioskHud(
            '✓ Pagamento Pix confirmado!',
            `+${credits} crédito(s) liberado(s)`,
            'success',
            4000
          );
        }

        if (get().userPlaylist.length > 0) {
          setTimeout(() => get().commitUserPlaylist(), 400);
        }
      },
      loadCatalog: async () => {
        let catalog: {
          categories: Category[];
          artists: Artist[];
          tracks: (Track & { path?: string })[];
        } | null = null;
        try {
          catalog = await tauriBridge.invokeStrict<{
            categories: Category[];
            artists: Artist[];
            tracks: (Track & { path?: string })[];
          }>('get_catalog');
        } catch (err: any) {
          tauriBridge.log(`loadCatalog: erro get_catalog: ${typeof err === 'string' ? err : err?.message}`);
          set({ isCatalogLoaded: true });
          return;
        }
        tauriBridge.log(
          `loadCatalog: tracks=${catalog?.tracks?.length ?? 0} categories=${catalog?.categories?.length ?? 0}`
        );
        if (!catalog || !Array.isArray(catalog.tracks) || catalog.tracks.length === 0) {
          set({ isCatalogLoaded: true });
          return;
        }
        const tracks: Track[] = catalog.tracks.map((t) => ({
          ...t,
          albumArt: ensureArt(t.albumArt, t.id, t.title),
          bpm: t.bpm || 100,
          cost: t.cost ?? 1
        }));
        const byId = new Map(tracks.map((t) => [t.id, t]));
        const categories: Category[] = (catalog.categories || []).map((c) => ({
          ...c,
          coverImage: ensureArt(c.coverImage, c.id, c.name),
          description: c.description || `${c.name}`
        }));
        const artists: Artist[] = (catalog.artists || []).map((a) => ({
          ...a,
          avatar: ensureArt(a.avatar, a.id, a.name)
        }));
        const state = get();
        const currentTrack = state.currentTrack
          ? byId.get(state.currentTrack.id) ?? tracks[0]
          : tracks[0];
        // Descarta itens demo/órfãos: a fila só mantém faixas do catálogo real.
        const queue = state.queue
          .filter((item) => byId.has(item.track.id))
          .map((item) => ({
            ...item,
            track: byId.get(item.track.id)!
          }));
        set({
          tracks,
          categories,
          artists,
          currentTrack,
          queue,
          playedHistory: currentTrack ? [currentTrack.id] : [],
          isCatalogLoaded: true
        });
      },

      categories: IS_NATIVE ? [] : INITIAL_CATEGORIES,
      artists: IS_NATIVE ? [] : INITIAL_ARTISTS,
      tracks: IS_NATIVE ? [] : INITIAL_TRACKS,
      selectedCategory: null,
      selectedArtist: null,
      setSelectedCategory: (cat) =>
        set({ selectedCategory: cat, selectedArtist: null, artistPage: 0, trackPage: 0 }),
      setSelectedArtist: (art) => set({ selectedArtist: art, trackPage: 0 }),

      // Active Kiosk Section
      activeSection: 'categories',
      setActiveSection: (sec) => set({ activeSection: sec }),

      // Paginação das listas
      artistPage: 0,
      trackPage: 0,
      setArtistPage: (page) => set({ artistPage: Math.max(0, page) }),
      setTrackPage: (page) => set({ trackPage: Math.max(0, page) }),

      // Tela dedicada
      browserOpen: false,
      browserMode: 'tracks',
      openBrowser: (modeOrCat = null, artistId = null) => {
        const state = get();
        let mode: 'category' | 'artist' | 'tracks' | 'top15' = 'tracks';
        let category = null;
        let artist = null;

        if (modeOrCat === 'top15') {
          mode = 'top15';
        } else if (modeOrCat === 'tracks') {
          mode = 'tracks';
        } else if (artistId) {
          mode = 'artist';
          artist = state.artists.find((a) => a.id === artistId) ?? state.selectedArtist;
          if (modeOrCat && modeOrCat !== 'artist') {
            category = state.categories.find((c) => c.id === modeOrCat) ?? null;
          }
        } else if (modeOrCat === 'category') {
          mode = 'category';
          category = state.selectedCategory;
        } else if (modeOrCat) {
          const foundCat = state.categories.find((c) => c.id === modeOrCat);
          if (foundCat) {
            category = foundCat;
            mode = 'category';
          }
        }

        set({
          browserOpen: true,
          browserMode: mode,
          selectedCategory: category,
          selectedArtist: artist,
          trackPage: 0,
          activeSection: 'tracks'
        });
      },
      closeBrowser: () => set({ browserOpen: false, activeSection: 'categories' }),

      // Admin PIN
      adminPin: '1234',
      setAdminPin: (pin) => set({ adminPin: pin }),

      // User Pending Playlist
      userPlaylist: [],
      addToUserPlaylist: (track: Track) => {
        const state = get();
        const currentTotalCost = state.userPlaylist.reduce((acc, t) => acc + t.cost, 0);
        const newTotalCost = currentTotalCost + track.cost;
        const availableCredits = state.currentUser ? state.currentUser.credits : state.credits;
        const creditHolder = state.currentUser ? state.currentUser.name : 'terminal';

        // If total cost exceeds current credits and credits are > 0, prompt or block
        if (availableCredits < newTotalCost) {
          state.showKioskHud(
            `Créditos insuficientes! Custo: ${newTotalCost} cr`,
            `Saldo da conta (${creditHolder}): ${availableCredits} cr. Pressione ENTER para recarregar via PIX`,
            'warning',
            4000
          );
          set({ isPixModalOpen: true });
          return false;
        }

        const nextPlaylist = [...state.userPlaylist, track];
        set({ userPlaylist: nextPlaylist });
        state.showKioskHud(
          `+ Faixa na Playlist: ${track.title}`,
          `Total playlist: ${nextPlaylist.length} música(s) | Custo: ${newTotalCost} de ${availableCredits} cr (${creditHolder})`,
          'success',
          2500
        );
        return true;
      },
      removeFromUserPlaylist: (trackId: string) => {
        const state = get();
        const nextPlaylist = state.userPlaylist.filter(t => t.id !== trackId);
        set({ userPlaylist: nextPlaylist });
      },
      clearUserPlaylist: () => set({ userPlaylist: [] }),
      commitUserPlaylist: () => {
        const state = get();
        if (state.userPlaylist.length === 0) return false;

        const totalCost = state.userPlaylist.reduce((acc, t) => acc + t.cost, 0);
        const availableCredits = state.currentUser ? state.currentUser.credits : state.credits;
        if (availableCredits < totalCost) {
          set({ isPixModalOpen: true });
          state.showKioskHud(
            `Crédito insuficiente para iniciar playlist!`,
            `Custo total: ${totalCost} cr | Saldo disponível: ${availableCredits} cr`,
            'warning',
            4000
          );
          return false;
        }

        // Deduct total credits once (da conta do usuário logado ou do terminal)
        if (state.currentUser) {
          const currentUserId = state.currentUser.id;
          const creds = Math.max(0, state.currentUser.credits - totalCost);
          set({ currentUser: { ...state.currentUser, credits: creds } });
          tauriBridge.invoke<DeductResult>('deduct_user_credit', {
            id: currentUserId,
            credits: totalCost
          }).then((res) => {
            if (res?.expired) {
              set((s) => ({
                currentUser: null,
                lastPurchasedPin: null,
                users: s.users.filter((u) => u.id !== currentUserId)
              }));
              get().showKioskHud('Créditos esgotados!', 'Sessão temporária finalizada.', 'warning', 4000);
            } else if (res && typeof res.remaining === 'number') {
              set((s) => ({
                currentUser: s.currentUser?.id === currentUserId ? ({ ...s.currentUser, credits: res.remaining }) : s.currentUser,
                credits: res.remaining
              }));
            }
          });
        } else {
          set({ credits: state.credits - totalCost });
        }

        const tracksToQueue = [...state.userPlaylist];
        const firstTrack = tracksToQueue[0];
        const otherTracks = tracksToQueue.slice(1);

        // Queue all items
        const newQueueItems: QueueItem[] = otherTracks.map((trk, idx) => ({
          id: `queue-pl-${Date.now()}-${idx}`,
          track: trk,
          queuedAt: Date.now() + (idx * 10),
          requestedBy: 'Playlist Cliente'
        }));

        const updatedQueue = [...state.queue, ...newQueueItems];
        set({ queue: updatedQueue, userPlaylist: [] });

        // If not playing, play first track immediately
        if (!state.isPlaying && !state.currentTrack) {
          state.playTrack(firstTrack, 'Playlist Cliente');
        } else {
          // Put first track into queue as well
          const firstItem: QueueItem = {
            id: `queue-pl-${Date.now()}-first`,
            track: firstTrack,
            queuedAt: Date.now(),
            requestedBy: 'Playlist Cliente'
          };
          set({ queue: [firstItem, ...updatedQueue] });
        }

        state.showKioskHud(
          `✓ Playlist Iniciada com Sucesso!`,
          `${tracksToQueue.length} faixas adicionadas | Debitado ${totalCost} crédito(s)`,
          'success',
          4000
        );
        tauriBridge.emit('queue_updated', { queue: get().queue });
        return true;
      },

      currentTrack: IS_NATIVE ? null : INITIAL_TRACKS[0],
      isPlaying: false,
      progressSeconds: 0,
      queue: IS_NATIVE
        ? []
        : [
            {
              id: 'q-initial-1',
              track: INITIAL_TRACKS[2],
              queuedAt: Date.now(),
              requestedBy: 'Auto-DJ'
            },
            {
              id: 'q-initial-2',
              track: INITIAL_TRACKS[10],
              queuedAt: Date.now() + 1000,
              requestedBy: 'Cliente (Mesa 03)'
            },
            {
              id: 'q-initial-3',
              track: INITIAL_TRACKS[20],
              queuedAt: Date.now() + 2000,
              requestedBy: 'Auto-DJ'
            }
          ],
      playedHistory: IS_NATIVE ? [] : [INITIAL_TRACKS[0].id],

      playTrack: async (track, requestedBy = 'Cliente (Touch)') => {
        const state = get();

        if (tauriBridge.isNative) {
          try {
            await tauriBridge.invokeStrict('play_track', { id: track.id });
          } catch (err: any) {
            state.showKioskHud(
              'Não foi possível tocar a faixa',
              typeof err === 'string' ? err : err?.message ?? 'Erro desconhecido',
              'error',
              4000
            );
            return;
          }
        } else {
          await audioEngine.playTrack(track);
        }

        // Add to history (max 20)
        const updatedHistory = [track.id, ...state.playedHistory.filter(id => id !== track.id)].slice(0, 20);

        set({
          currentTrack: track,
          isPlaying: true,
          progressSeconds: 0,
          playedHistory: updatedHistory
        });

        tauriBridge.emit('track_changed', { track_id: track.id, title: track.title, artist: track.artist });
        tauriBridge.emit('queue_updated', { queue: get().queue });
      },

      pauseTrack: () => {
        if (!tauriBridge.isNative) {
          audioEngine.pause();
        }
        set({ isPlaying: false });
        tauriBridge.invoke('pause_track');
      },

      resumeTrack: () => {
        const state = get();
        if (tauriBridge.isNative) {
          tauriBridge.invoke('resume_track');
        } else if (state.currentTrack) {
          audioEngine.playTrack(state.currentTrack);
        } else {
          audioEngine.resume();
        }
        set({ isPlaying: true });
      },

      skipTrack: () => {
        const state = get();
        tauriBridge.invoke('skip_track');
        if (state.queue.length > 0) {
          const nextItem = state.queue[0];
          const remainingQueue = state.queue.slice(1);
          set({ queue: remainingQueue });
          state.playTrack(nextItem.track, nextItem.requestedBy);
        } else {
          // Empty queue -> Trigger Auto-DJ
          state.triggerAutoDjNext();
        }
      },

      addToQueue: (track, requestedBy = 'Cliente (Touch)') => {
        const state = get();

        // Trava de Categoria Ativa: impede tocar de outras categorias
        if (state.autoDjConfig.categoryLocked && state.autoDjConfig.lockedCategoryId) {
          if (track.category !== state.autoDjConfig.lockedCategoryId) {
            state.showKioskHud(
              'Categoria Bloqueada',
              'O aparelho está travado para reproduzir somente a categoria selecionada.',
              'warning',
              3500
            );
            return false;
          }
        }

        // Check if user has credits or if requested by Auto-DJ
        if (requestedBy.startsWith('Cliente')) {
          const cost = track.cost;
          const availableCredits = state.currentUser ? state.currentUser.credits : state.credits;
          if (availableCredits < cost) {
            set({ isPixModalOpen: true });
            return false;
          }
          if (state.currentUser) {
            const currentUserId = state.currentUser.id;
            const creds = Math.max(0, state.currentUser.credits - cost);
            set({ currentUser: { ...state.currentUser, credits: creds } });
            tauriBridge.invoke<DeductResult>('deduct_user_credit', {
              id: currentUserId,
              credits: cost
            }).then((res) => {
              if (res?.expired) {
                set((s) => ({
                  currentUser: null,
                  lastPurchasedPin: null,
                  users: s.users.filter((u) => u.id !== currentUserId)
                }));
                get().showKioskHud('Créditos esgotados!', 'Sessão temporária finalizada.', 'warning', 4000);
              } else if (res && typeof res.remaining === 'number') {
                set((s) => ({
                  currentUser: s.currentUser?.id === currentUserId ? ({ ...s.currentUser, credits: res.remaining }) : s.currentUser,
                  credits: res.remaining
                }));
              }
            });
          } else {
            set({ credits: state.credits - cost });
          }
        }

        const newItem: QueueItem = {
          id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          track,
          queuedAt: Date.now(),
          requestedBy
        };

        const updatedQueue = [...state.queue, newItem];
        set({ queue: updatedQueue });

        // If nothing is playing, play immediately
        if (!state.isPlaying && !state.currentTrack) {
          state.playTrack(track, requestedBy);
        }

        tauriBridge.emit('queue_updated', { queue: updatedQueue });
        return true;
      },

      removeQueueItem: (queueId) => {
        const state = get();
        const updated = state.queue.filter(item => item.id !== queueId);
        set({ queue: updated });
        tauriBridge.emit('queue_updated', { queue: updated });
      },

      setProgressSeconds: (sec) => set({ progressSeconds: sec }),

      // Keypad Actions
      keypadBuffer: '',
      keypadFeedback: 'idle',
      handleKeypadDigit: (digit) => {
        const state = get();
        if (state.keypadBuffer.length >= 4) return;
        set({ keypadBuffer: state.keypadBuffer + digit, keypadFeedback: 'idle' });
      },
      handleKeypadCorrect: () => {
        const state = get();
        if (state.keypadBuffer.length > 0) {
          set({ keypadBuffer: state.keypadBuffer.slice(0, -1), keypadFeedback: 'idle' });
        }
      },
      handleKeypadConfirm: () => {
        const state = get();
        const code = state.keypadBuffer.trim();
        if (!code) return;

        // Search track by code
        const matchedTrack = state.tracks.find(
          t => t.code.toLowerCase() === code.toLowerCase() || t.code === code.padStart(2, '0')
        );

        if (matchedTrack) {
          const success = state.addToQueue(matchedTrack, 'Cliente (Keypad)');
          if (success) {
            set({ keypadFeedback: 'success', keypadBuffer: '' });
          } else {
            set({ keypadFeedback: 'error' });
          }
        } else {
          set({ keypadFeedback: 'error' });
        }

        setTimeout(() => {
          set({ keypadFeedback: 'idle' });
        }, 2200);
      },

      // Credits & Financials
      credits: IS_NATIVE ? 0 : 6,
      financialReport: IS_NATIVE ? emptyFinancialReport() : {
        pricePerCredit: 2.50,
        totalCreditsInserted: 48,
        dailyRevenue: 85.00,
        dailyCredits: 34,
        monthlyRevenue: 1420.00,
        monthlyCredits: 568,
        history: [
          {
            id: 'tx-01',
            timestamp: Date.now() - 3600000 * 3,
            amount: 10.00,
            credits: 4,
            paymentMethod: 'pix'
          },
          {
            id: 'tx-02',
            timestamp: Date.now() - 3600000 * 1.5,
            amount: 25.00,
            credits: 11,
            paymentMethod: 'pix'
          },
          {
            id: 'tx-03',
            timestamp: Date.now() - 3600000 * 0.4,
            amount: 50.00,
            credits: 24,
            paymentMethod: 'pix'
          }
        ]
      },

      addCredits: (creditsToAdd, amountPaid, method = 'pix') => {
        const state = get();
        const newTransaction = {
          id: `tx-${Date.now()}`,
          timestamp: Date.now(),
          amount: amountPaid,
          credits: creditsToAdd,
          paymentMethod: method
        };

        const updatedReport: FinancialReport = {
          ...state.financialReport,
          totalCreditsInserted: state.financialReport.totalCreditsInserted + creditsToAdd,
          dailyRevenue: state.financialReport.dailyRevenue + amountPaid,
          dailyCredits: state.financialReport.dailyCredits + creditsToAdd,
          monthlyRevenue: state.financialReport.monthlyRevenue + amountPaid,
          monthlyCredits: state.financialReport.monthlyCredits + creditsToAdd,
          history: [newTransaction, ...state.financialReport.history]
        };

        set({
          credits: state.credits + creditsToAdd,
          financialReport: updatedReport
        });

        // Som + persistência: nativo usa o backend Rust; navegador usa síntese WebAudio.
        if (tauriBridge.isNative) {
          tauriBridge.invoke('add_credits', {
            amount: amountPaid,
            credits: creditsToAdd,
            method
          });
          tauriBridge.invoke('play_sfx');
        } else {
          audioEngine.playCashRegisterSound();
          tauriBridge.emit('pix_pago', {
            credits: creditsToAdd,
            tx_id: newTransaction.id,
            amount: amountPaid
          });
        }
      },

      deductCredit: () => {
        const state = get();
        if (state.credits <= 0) return false;
        set({ credits: state.credits - 1 });
        return true;
      },

      // DSP State & Handlers
      dspSettings: {
        eq: {
          band0_80Hz: 2,
          band1_350Hz: -1,
          band2_1kHz: 1,
          band3_4kHz: 3,
          band4_12kHz: 2
        },
        agcActive: true,
        agcSensitivity: 60,
        compressor: {
          threshold: -20,
          ratio: 4,
          attack: 0.02,
          release: 0.25
        },
        limiterCeiling: -1,
        masterGain: 0.85
      },

      setEqBand: (bandIndex, gainDb) => {
        audioEngine.setEqBand(bandIndex, gainDb);
        const state = get();
        const keys: (keyof DspSettings['eq'])[] = [
          'band0_80Hz',
          'band1_350Hz',
          'band2_1kHz',
          'band3_4kHz',
          'band4_12kHz'
        ];
        const newEq = { ...state.dspSettings.eq, [keys[bandIndex]]: gainDb };
        set({ dspSettings: { ...state.dspSettings, eq: newEq } });
        tauriBridge.invoke('set_eq_band', { band: bandIndex, gain: gainDb });
      },

      setCompressor: (threshold, ratio, attack, release) => {
        audioEngine.setCompressor(threshold, ratio, attack, release);
        const state = get();
        const newComp = {
          ...state.dspSettings.compressor,
          threshold,
          ratio,
          ...(attack !== undefined ? { attack } : {}),
          ...(release !== undefined ? { release } : {})
        };
        set({ dspSettings: { ...state.dspSettings, compressor: newComp } });
        tauriBridge.invoke('set_compressor', { threshold, ratio });
      },

      setAgc: (active, sensitivity) => {
        audioEngine.setAgc(active, sensitivity);
        const state = get();
        set({
          dspSettings: {
            ...state.dspSettings,
            agcActive: active,
            ...(sensitivity !== undefined ? { agcSensitivity: sensitivity } : {})
          }
        });
        tauriBridge.invoke('set_agc', { active });
      },

      setLimiterCeiling: (ceilingDb) => {
        audioEngine.setLimiterCeiling(ceilingDb);
        const state = get();
        set({ dspSettings: { ...state.dspSettings, limiterCeiling: ceilingDb } });
        tauriBridge.invoke('set_limiter_ceiling', { ceiling: ceilingDb });
      },

      setMasterGain: (gain) => {
        audioEngine.setMasterGain(gain);
        const state = get();
        set({ dspSettings: { ...state.dspSettings, masterGain: gain } });
        tauriBridge.invoke('set_master_gain', { vol: gain });
      },

      // Auto-DJ Rules
      autoDjConfig: {
        categoryLocked: false,
        lockedCategoryId: 'rock',
        weeklySchedule: {
          0: 'samba',     // Domingo: Samba & Pagode
          1: 'mpb',       // Segunda: MPB
          2: 'flashback', // Terça: Flashback
          3: 'forro',     // Quarta: Forró
          4: 'sertanejo', // Quinta: Sertanejo
          5: 'rock',      // Sexta: Rock
          6: 'rock'       // Sábado: Rock
        },
        dateOverrides: {
          '2026-10-12': 'samba',
          '2026-12-31': 'flashback'
        },
        historyLimit: 20
      },

      setCategoryLocked: (locked, categoryId) => {
        const state = get();
        set({
          autoDjConfig: {
            ...state.autoDjConfig,
            categoryLocked: locked,
            ...(categoryId ? { lockedCategoryId: categoryId } : {})
          }
        });
        tauriBridge.invoke('set_autodj_config', { config: get().autoDjConfig });
      },

      setWeeklySchedule: (dayOfWeek, categoryId) => {
        const state = get();
        set({
          autoDjConfig: {
            ...state.autoDjConfig,
            weeklySchedule: {
              ...state.autoDjConfig.weeklySchedule,
              [dayOfWeek]: categoryId
            }
          }
        });
        tauriBridge.invoke('set_autodj_config', { config: get().autoDjConfig });
      },

      setDateOverride: (dateString, categoryId) => {
        const state = get();
        set({
          autoDjConfig: {
            ...state.autoDjConfig,
            dateOverrides: {
              ...state.autoDjConfig.dateOverrides,
              [dateString]: categoryId
            }
          }
        });
        tauriBridge.invoke('set_autodj_config', { config: get().autoDjConfig });
      },

      removeDateOverride: (key) => {
        const state = get();
        const updated = { ...state.autoDjConfig.dateOverrides };
        delete updated[key];
        set({
          autoDjConfig: {
            ...state.autoDjConfig,
            dateOverrides: updated
          }
        });
        tauriBridge.invoke('set_autodj_config', { config: get().autoDjConfig });
      },

      // 8. Lógica de Banco de Dados e Fila (SQLite no Rust / Auto-DJ)
      triggerAutoDjNext: async () => {
        const state = get();

        // Nativo: a seleção (trava, agenda semanal, overrides, histórico 20) roda no Rust/SQLite.
        if (tauriBridge.isNative) {
          const track = await tauriBridge.invoke<Track>('auto_dj_next');
          if (track) {
            const withArt: Track = {
              ...track,
              albumArt: ensureArt(track.albumArt, track.id, track.title)
            };
            const updatedHistory = [track.id, ...state.playedHistory.filter(id => id !== track.id)].slice(0, 20);
            set({
              currentTrack: withArt,
              isPlaying: true,
              progressSeconds: 0,
              playedHistory: updatedHistory
            });
          }
          return;
        }

        let targetCategory = 'rock';

        const now = new Date();
        const todayDate = now.toISOString().split('T')[0];
        const currentHour = now.getHours().toString().padStart(2, '0');
        const hourKey = `${todayDate}@${currentHour}`;
        const dayOfWeek = now.getDay();

        if (state.autoDjConfig.categoryLocked) {
          // Trava de categoria ativada
          targetCategory = state.autoDjConfig.lockedCategoryId || 'rock';
        } else if (state.autoDjConfig.dateOverrides[hourKey]) {
          // Agenda com horário específico (ex: 2026-10-12@14)
          targetCategory = state.autoDjConfig.dateOverrides[hourKey];
        } else if (state.autoDjConfig.dateOverrides[todayDate]) {
          // Agenda do dia todo
          targetCategory = state.autoDjConfig.dateOverrides[todayDate];
        } else if (state.currentTrack) {
          // Mesma categoria da última música que tocou
          targetCategory = state.currentTrack.category;
        } else {
          // Mapeamento semanal
          targetCategory = state.autoDjConfig.weeklySchedule[dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6] || 'rock';
        }

        // Filtra músicas da categoria que não estejam no histórico recente (últimas 20)
        let eligibleTracks = state.tracks.filter(
          t => t.category === targetCategory && !state.playedHistory.includes(t.id)
        );

        // Se todas da categoria já foram tocadas, relaxa o filtro do histórico
        if (eligibleTracks.length === 0) {
          eligibleTracks = state.tracks.filter(t => t.category === targetCategory);
        }
        if (eligibleTracks.length === 0) {
          if (state.autoDjConfig.categoryLocked) {
            return; // se travado, não sai da categoria travada
          }
          eligibleTracks = state.tracks;
        }

        if (eligibleTracks.length === 0) return;

        const randomTrack = eligibleTracks[Math.floor(Math.random() * eligibleTracks.length)];
        state.playTrack(randomTrack, 'Auto-DJ');
      },

      // Kiosk Keyboard Navigation & HUD
      kioskKeyboardConfig: {
        prefixCategory: '/',
        prefixTrack: '*',
        volumeStep: 0.05,
        openPixOnEnter: true,
        soundFeedback: true
      },
      setKioskKeyboardConfig: (config) => {
        set((s) => ({ kioskKeyboardConfig: { ...s.kioskKeyboardConfig, ...config } }));
      },
      kioskHud: {
        text: '',
        visible: false,
        type: 'info'
      },
      showKioskHud: (text, subText, type = 'info', durationMs = 2800) => {
        set({ kioskHud: { text, subText, visible: true, type } });
        if (durationMs > 0) {
          setTimeout(() => {
            const current = get().kioskHud;
            if (current.text === text) {
              set({ kioskHud: { ...current, visible: false } });
            }
          }, durationMs);
        }
      },
      hideKioskHud: () => {
        set((s) => ({ kioskHud: { ...s.kioskHud, visible: false } }));
      },
      increaseVolume: () => {
        const state = get();
        const current = state.dspSettings.masterGain;
        const next = Math.min(1.5, Math.round((current + state.kioskKeyboardConfig.volumeStep) * 100) / 100);
        state.setMasterGain(next);
        state.showKioskHud(`Volume: ${Math.round(next * 100)}%`, '[ + ] Aumentar Volume', 'info', 1500);
      },
      decreaseVolume: () => {
        const state = get();
        const current = state.dspSettings.masterGain;
        const next = Math.max(0, Math.round((current - state.kioskKeyboardConfig.volumeStep) * 100) / 100);
        state.setMasterGain(next);
        state.showKioskHud(`Volume: ${Math.round(next * 100)}%`, '[ - ] Diminuir Volume', 'info', 1500);
      },

      setPricePerCredit: (price) => {
        const state = get();
        set({ financialReport: { ...state.financialReport, pricePerCredit: price } });
        tauriBridge.invoke('set_setting_value', { key: 'price_per_credit', value: String(price) });
      },

      // Modal States
      isPixModalOpen: false,
      isAdminModalOpen: false,
      isSecondaryScreenOpen: false,
      isAccessibilityKeypadOpen: false,
      setPixModalOpen: (open) => set({ isPixModalOpen: open }),
      setAdminModalOpen: (open) => set({ isAdminModalOpen: open }),
      setSecondaryScreenOpen: (open) => set({ isSecondaryScreenOpen: open }),
      setAccessibilityKeypadOpen: (open) => set({ isAccessibilityKeypadOpen: open }),

      // User Accounts (nativo)
      users: [],
      currentUser: null,
      lastPurchasedPin: null,
      setLastPurchasedPin: (pin) => set({ lastPurchasedPin: pin }),
      isUserLoginOpen: false,
      setUserLoginOpen: (open) => set({ isUserLoginOpen: open }),
      listUsers: async () => {
        if (!tauriBridge.isNative) return;
        const users = await tauriBridge.invoke<JukeboxUser[]>('list_users');
        if (users) set({ users });
      },
      createUser: async (name, password, credits) => {
        if (!tauriBridge.isNative) return { ok: false, error: 'Disponível apenas no aplicativo nativo.' };
        const user = await tauriBridge
          .invokeStrict<JukeboxUser>('create_user', { name, password, credits })
          .catch((e: any) => null);
        if (user) {
          set((s) => ({ users: [...s.users, user] }));
          return { ok: true };
        }
        return { ok: false, error: 'Não foi possível cadastrar. Verifique nome/senha em uso.' };
      },
      updateUser: async (id, name, password, credits) => {
        if (!tauriBridge.isNative) return { ok: false, error: 'Disponível apenas no aplicativo nativo.' };
        const user = await tauriBridge
          .invokeStrict<JukeboxUser>('update_user', { id, name, password, credits })
          .catch((e: any) => null);
        if (user) {
          set((s) => ({
            users: s.users.map((u) => (u.id === user.id ? user : u)),
            currentUser: s.currentUser?.id === user.id ? user : s.currentUser
          }));
          return { ok: true };
        }
        return { ok: false, error: 'Não foi possível atualizar o usuário.' };
      },
      deleteUser: async (id) => {
        if (!tauriBridge.isNative) return;
        await tauriBridge.invoke('delete_user', { id });
        set((s) => ({
          users: s.users.filter((u) => u.id !== id),
          currentUser: s.currentUser?.id === id ? null : s.currentUser
        }));
      },
      authenticateUser: async (password) => {
        if (!tauriBridge.isNative) return { ok: false, error: 'Disponível apenas no aplicativo nativo.' };
        const user = await tauriBridge.invoke<JukeboxUser | null>('authenticate_user', { password });
        if (user) {
          set({ currentUser: user, isUserLoginOpen: false });
          get().showKioskHud(`✓ Bem-vindo(a), ${user.name}!`, `Saldo: ${user.credits} crédito(s)`, 'success', 3000);
          return { ok: true };
        }
        return { ok: false, error: 'Senha não encontrada.' };
      },
      logoutUser: () => {
        set({ currentUser: null, lastPurchasedPin: null, credits: 0 });
        get().showKioskHud('Sessão encerrada', 'Você saiu da conta (0000)', 'info', 3000);
      },
      addUserCredits: async (id, credits) => {
        if (!tauriBridge.isNative) return;
        const user = await tauriBridge.invoke<JukeboxUser>('add_user_credits', { id, credits });
        if (user) {
          set((s) => ({
            users: s.users.map((u) => (u.id === user.id ? user : u)),
            currentUser: s.currentUser?.id === user.id ? user : s.currentUser
          }));
        }
      }
    }),
    {
      name: 'jukebox-pro-storage',
      version: 2,
      // No nativo, créditos e financeiro são do backend Rust — não persistir demo.
      partialize: (state) => {
        const base = {
          theme: state.theme,
          dspSettings: state.dspSettings,
          autoDjConfig: state.autoDjConfig,
          kioskKeyboardConfig: state.kioskKeyboardConfig
        };
        if (IS_NATIVE) return base;
        return {
          ...base,
          credits: state.credits,
          financialReport: state.financialReport
        };
      },
      migrate: (persisted: any) => {
        if (IS_NATIVE && persisted) {
          delete persisted.credits;
          delete persisted.financialReport;
        }
        return persisted;
      }
    }
  )
);
