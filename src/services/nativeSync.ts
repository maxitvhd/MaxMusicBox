import confetti from 'canvas-confetti';
import { tauriBridge } from './tauriBridge';
import { useJukeboxStore } from '../store/useJukeboxStore';
import { NativeSettings, MpStatus, PixCharge } from '../types';

let started = false;

/**
 * Conecta o estado do kiosk ao backend nativo (Rust) quando disponível:
 * carrega configurações + catálogo real, aplica-os e assina os eventos IPC.
 */
export async function bootstrapNative(): Promise<void> {
  if (started) return;
  started = true;

  const store = useJukeboxStore.getState();

  tauriBridge.log(`bootstrap: isNative=${tauriBridge.isNative}`);

  // 1. Configurações persistidas no SQLite (tema, preço, split, admin, Auto-DJ, MP)
  const settings = await tauriBridge.invoke<NativeSettings>('get_settings');
  tauriBridge.log(
    `bootstrap: settings=${settings ? 'ok' : 'null'} mp(configured=${settings?.mp?.configured} connected=${settings?.mp?.connected} split=${settings?.mp?.splitPercent})`
  );
  if (settings) {
    store.applyNativeSettings(settings);
  }

  // 2. Repassa as preferências atuais do frontend para o backend nativo
  if (tauriBridge.isNative) {
    const s = useJukeboxStore.getState();
    tauriBridge.invoke('set_theme', { theme: s.theme });
    tauriBridge.invoke('set_autodj_config', { config: s.autoDjConfig });
    tauriBridge.invoke('set_master_gain', { vol: s.dspSettings.masterGain });
    tauriBridge.invoke('set_limiter_ceiling', { ceiling: s.dspSettings.limiterCeiling });
    tauriBridge.invoke('set_agc', { active: s.dspSettings.agcActive, sensitivity: s.dspSettings.agcSensitivity });
    Object.entries(s.dspSettings.eq).forEach(([key, gain], idx) => {
      const bandIndex = ['band0_80Hz', 'band1_350Hz', 'band2_1kHz', 'band3_4kHz', 'band4_12kHz'].indexOf(key);
      if (bandIndex >= 0) tauriBridge.invoke('set_eq_band', { band: bandIndex, gain });
      void idx;
    });
  }

  // 3. Catálogo real escaneado pelo Rust
  await useJukeboxStore.getState().loadCatalog();
  tauriBridge.log(`bootstrap: tracks=${useJukeboxStore.getState().tracks.length}`);

  // 4. Auto-DJ: começa a tocar em background se nada estiver ativo.
  const after = useJukeboxStore.getState();
  if (after.tracks.length > 0 && !after.isPlaying) {
    await after.triggerAutoDjNext();
    tauriBridge.log(`bootstrap: autodj=${useJukeboxStore.getState().currentTrack?.title ?? 'vazio'}`);
  }

  // 5. Assinatura dos eventos IPC
  let levelTicks = 0;
  tauriBridge.listen<{ left: number; right: number; peakLeft: number; peakRight: number }>(
    'audio_levels',
    (e) => {
      useJukeboxStore.getState().setAudioLevels(e.payload);
      if (++levelTicks % 120 === 0) {
        tauriBridge.log(
          `levels front l=${e.payload?.left?.toFixed?.(3)} r=${e.payload?.right?.toFixed?.(3)}`
        );
      }
    }
  );
  tauriBridge.listen<number[]>('audio_spectrum', (e) => {
    const bands = Array.isArray(e.payload) ? e.payload : [];
    if (bands.length) useJukeboxStore.getState().setAudioSpectrum(bands);
  });
  tauriBridge.listen<{ position_ms: number; duration_ms: number; playing: boolean }>(
    'playback_progress',
    (e) => useJukeboxStore.getState().setProgressSeconds((e.payload?.position_ms || 0) / 1000)
  );
  tauriBridge.listen('track_ended', () => useJukeboxStore.getState().handleTrackEnded());
  tauriBridge.listen<{ credits: number; amount: number; tx_id: string }>('pix_pago', (e) => {
    confetti({
      particleCount: 90,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#fef08a', '#10b981'],
      shapes: ['circle', 'square']
    });
    useJukeboxStore.getState().handlePixPaid(e.payload);
  });
  tauriBridge.listen<PixCharge>('pix_created', (e) => useJukeboxStore.getState().setActiveCharge(e.payload));
  tauriBridge.listen('pix_expired', () => {
    useJukeboxStore.getState().setActiveCharge(null);
    useJukeboxStore.getState().showKioskHud(
      'QR Code Pix expirado',
      'Gere uma nova cobrança para continuar',
      'warning',
      3500
    );
  });
  tauriBridge.listen<{ status: string }>('pix_failed', (e) =>
    useJukeboxStore.getState().setMpError(`Pix ${e.payload?.status || 'recusado'}`)
  );
  tauriBridge.listen<MpStatus>('mp_connected', (e) => useJukeboxStore.getState().setMpStatus(e.payload));
  tauriBridge.listen<string>('mp_error', (e) => {
    const msg = typeof e.payload === 'string' ? e.payload : 'Erro na integração Mercado Pago';
    useJukeboxStore.getState().setMpError(msg);
    useJukeboxStore.getState().showKioskHud('Mercado Pago', msg, 'error', 5000);
  });
  tauriBridge.listen<{ count: number }>('library_scanned', (e) => {
    void useJukeboxStore.getState().loadCatalog();
    useJukeboxStore.getState().showKioskHud(
      'Biblioteca atualizada',
      `${e.payload?.count || 0} faixa(s) indexada(s)`,
      'info',
      3000
    );
  });

  // 6. Relatório financeiro atual (SQLite)
  await useJukeboxStore.getState().refreshFinancialReport();
}
