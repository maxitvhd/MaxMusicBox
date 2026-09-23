import { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, Disc, Volume2, Sparkles, Activity, Gauge } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';
import { SpectrumVisualizer } from './SpectrumVisualizer';
import { VuMeter } from './VuMeter';
import { AdBanner } from './AdBanner';

export const NowPlaying = () => {
  const theme = useJukeboxStore((s) => s.theme);
  const currentTrack = useJukeboxStore((s) => s.currentTrack);
  const isPlaying = useJukeboxStore((s) => s.isPlaying);
  const progressSeconds = useJukeboxStore((s) => s.progressSeconds);
  const setProgressSeconds = useJukeboxStore((s) => s.setProgressSeconds);
  const pauseTrack = useJukeboxStore((s) => s.pauseTrack);
  const resumeTrack = useJukeboxStore((s) => s.resumeTrack);
  const skipTrack = useJukeboxStore((s) => s.skipTrack);
  const ads = useJukeboxStore((s) => s.ads);

  // Busca anúncio ativo preferencial para o slot now_playing_card, todos ou fallback
  const activeNowPlayingAd =
    ads.find(
      (a) =>
        (!a.status || a.status === 'ativo') &&
        Boolean(a.url_midia || a.conteudo_html) &&
        (a.localizacao_slot === 'now_playing_card' ||
          a.posicao === 'now_playing_card' ||
          a.localizacao_slot === 'todos' ||
          a.posicao === 'todos' ||
          a.localizacao_slot === 'all' ||
          a.posicao === 'all')
    ) ||
    ads.find(
      (a) =>
        (!a.status || a.status === 'ativo') &&
        Boolean(a.url_midia || a.conteudo_html)
    );

  // Verifica se há anúncio ativo para o slot now_playing_card
  const hasNowPlayingAd = Boolean(activeNowPlayingAd);

  // Visualizer toggle between Spectrum EQ and VU Meters
  const [visualizerMode, setVisualizerMode] = useState<'spectrum' | 'vu'>('spectrum');

  // Playback timer progression
  useEffect(() => {
    let interval: number;
    if (isPlaying && currentTrack) {
      interval = window.setInterval(() => {
        setProgressSeconds(progressSeconds + 1);
        if (progressSeconds >= currentTrack.duration) {
          skipTrack();
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, progressSeconds, currentTrack]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isVintage = theme === 'amp-vintage';

  if (!currentTrack) {
    if (hasNowPlayingAd) {
      return (
        <div className="w-full h-full min-h-[120px] max-h-[155px] flex flex-col justify-center">
          <AdBanner slot="now_playing_card" />
        </div>
      );
    }

    return (
      <div
        className={`w-full h-full min-h-[120px] max-h-[155px] flex flex-col items-center justify-center p-3 rounded-2xl border transition-colors ${
          isVintage
            ? 'bg-[#181a1f] border-[#2e333d] text-amber-500'
            : 'bg-[#0f172a] border-cyan-900/60 text-cyan-400'
        }`}
      >
        <Disc className="w-10 h-10 opacity-30 animate-pulse mb-1.5" />
        <p className="font-mono text-xs uppercase tracking-wider">Aguardando seleção de faixa...</p>
      </div>
    );
  }

  const progressPercent = currentTrack.duration
    ? (progressSeconds / currentTrack.duration) * 100
    : 0;

  return (
    <div
      className={`relative w-full h-full rounded-2xl p-2.5 sm:px-3.5 sm:py-2.5 border transition-all duration-200 select-none overflow-hidden flex flex-col justify-between ${
        isVintage
          ? 'bg-[#1b1f26] border-[#313744] shadow-xl text-amber-100'
          : 'bg-[#0f172a]/95 border-cyan-800/60 shadow-[0_4px_20px_rgba(6,182,212,0.12)] text-slate-100'
      }`}
    >
      {/* Background ambient lighting */}
      <div
        className={`absolute -right-16 -top-16 w-36 h-36 rounded-full blur-3xl pointer-events-none opacity-20 ${
          isVintage ? 'bg-amber-600' : 'bg-cyan-500'
        }`}
      />

      <div className="flex flex-col lg:flex-row items-center gap-3 sm:gap-4 h-full">
        {/* Album Artwork & Vinyl Disc Simulation - Elegantly sized */}
        <div className="relative flex items-center justify-center shrink-0">
          {/* Spinning Vinyl Record behind the sleeve */}
          <div
            className={`w-22 h-22 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 ${
              isPlaying ? 'animate-spin-slow' : 'animate-spin-paused'
            } ${
              isVintage
                ? 'border-2 border-[#2b1f15] bg-[radial-gradient(circle,#18140f_20%,#0a0805_70%,#241a12_100%)] shadow-black/80'
                : 'border border-cyan-500/50 bg-[radial-gradient(circle,#090d16_25%,#04070f_65%,#081224_100%)] shadow-[0_0_15px_rgba(6,182,212,0.3)]'
            }`}
          >
            {/* Grooves on vinyl */}
            <div className="w-3/4 h-3/4 rounded-full border border-white/5 flex items-center justify-center">
              <div className="w-2/3 h-2/3 rounded-full border border-white/5 flex items-center justify-center">
                {/* Vinyl Label */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border overflow-hidden ${
                    isVintage
                      ? 'bg-amber-700 border-amber-400 text-amber-100'
                      : 'bg-cyan-900 border-cyan-400 text-cyan-200'
                  }`}
                >
                  <Disc className="w-3.5 h-3.5 opacity-70" />
                </div>
              </div>
            </div>
            {/* Center Spindle hole */}
            <div className="absolute w-2 h-2 bg-zinc-950 rounded-full border border-zinc-700" />
          </div>

          {/* Album Cover Sleeve in front */}
          <div
            className={`absolute -left-2 sm:-left-2.5 w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden border shadow-xl z-10 transition-transform ${
              isVintage
                ? 'border-amber-500/40 shadow-black/90'
                : 'border-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
            }`}
          >
            <img
              src={currentTrack.albumArt}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
            {/* Code Badge */}
            <div
              className={`absolute top-1 left-1 px-1.5 py-0.2 rounded font-mono font-bold text-[9px] tracking-wider border shadow-md ${
                isVintage
                  ? 'bg-amber-950/90 text-amber-300 border-amber-600/70'
                  : 'bg-cyan-950/90 text-cyan-300 border-cyan-400/80 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
              }`}
            >
              #{currentTrack.code}
            </div>
          </div>
        </div>

        {/* Track Info & Marquee */}
        <div className="flex-1 min-w-0 w-full flex flex-col justify-between py-0.5 h-full">
          {/* Header pill: Now Playing & Genre */}
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <span
              className={`text-[8.5px] uppercase font-mono font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1 ${
                isPlaying
                  ? isVintage
                    ? 'bg-amber-900/60 text-amber-300 border border-amber-600/50'
                    : 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'
                }`}
              />
              {isPlaying ? 'TOCANDO AGORA' : 'PAUSADO'}
            </span>

            <div className="flex items-center gap-1.5">
              <span
                className={`text-[8.5px] font-mono font-semibold uppercase px-1 py-0.2 rounded truncate max-w-[140px] sm:max-w-none ${
                  isVintage
                    ? 'bg-[#13151a] text-amber-400 border border-[#2d313b]'
                    : 'bg-slate-900/80 text-cyan-400 border border-cyan-900'
                }`}
              >
                Gênero: {currentTrack.category.toUpperCase()} • {currentTrack.bpm} BPM
              </span>
            </div>
          </div>

          {/* Marquee Track Title & Artist */}
          <div className="overflow-hidden relative py-0.5">
            <div className="whitespace-nowrap">
              <h2
                className={`text-sm sm:text-base font-extrabold tracking-wide truncate leading-tight ${
                  isVintage ? 'font-tech text-amber-200' : 'font-modern text-white'
                }`}
                title={currentTrack.title}
              >
                {currentTrack.title}
              </h2>
            </div>
            <p
              className={`text-xs font-semibold truncate leading-tight ${
                isVintage ? 'text-amber-500/90 font-mono' : 'text-pink-400 text-glow-magenta'
              }`}
            >
              {currentTrack.artist}
            </p>
          </div>

          {/* Progress Bar & Time */}
          <div className="w-full mt-0.5">
            <div
              className={`w-full h-1 rounded-full overflow-hidden relative ${
                isVintage ? 'bg-[#101216]' : 'bg-slate-800'
              }`}
            >
              <div
                className={`h-full transition-all duration-300 ${
                  isVintage
                    ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                    : 'bg-gradient-to-r from-cyan-500 to-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div
              className={`flex justify-between text-[9px] mt-0.5 font-mono ${
                isVintage ? 'text-amber-600' : 'text-slate-400'
              }`}
            >
              <span>{formatTime(progressSeconds)}</span>
              <span>{formatTime(currentTrack.duration)}</span>
            </div>
          </div>

          {/* Transport Controls (Play/Pause, Skip) & Visualizer */}
          <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              {isPlaying ? (
                <button
                  onClick={pauseTrack}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-95 ${
                    isVintage
                      ? 'vintage-neumorphic-btn text-amber-300 hover:text-white'
                      : 'bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 neon-glow-cyan'
                  }`}
                  title="Pausar Música"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={resumeTrack}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-95 ${
                    isVintage
                      ? 'vintage-neumorphic-btn text-amber-300 hover:text-white'
                      : 'bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 neon-glow-cyan'
                  }`}
                  title="Tocar Música"
                >
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </button>
              )}

              <button
                onClick={skipTrack}
                className={`py-0.5 px-2 rounded-lg border transition-all active:scale-95 flex items-center gap-1 text-[10px] font-bold uppercase ${
                  isVintage
                    ? 'vintage-neumorphic-btn text-amber-400 hover:text-amber-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-700'
                }`}
                title="Pular para a Próxima da Fila"
              >
                <SkipForward className="w-3 h-3" />
                <span>Pular</span>
              </button>
            </div>

            {/* Luminous LED Spectrum Equalizer or Classic VU Meters */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setVisualizerMode(m => m === 'spectrum' ? 'vu' : 'spectrum')}
                className={`flex items-center gap-1 text-[8.5px] font-mono px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                  visualizerMode === 'spectrum'
                    ? isVintage
                      ? 'bg-amber-950/80 text-amber-300 border-amber-600/60'
                      : 'bg-cyan-950/80 text-cyan-300 border-cyan-600/60 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-900/80 text-zinc-400 border-zinc-700'
                }`}
                title="Alternar entre Equalizador e VU Meters"
              >
                {visualizerMode === 'spectrum' ? (
                  <>
                    <Activity className={`w-2.5 h-2.5 ${isVintage ? 'text-amber-400' : 'text-cyan-400'} animate-pulse`} />
                    <span className="uppercase tracking-wider">EQ</span>
                  </>
                ) : (
                  <>
                    <Gauge className={`w-2.5 h-2.5 text-amber-400`} />
                    <span className="uppercase tracking-wider">VU</span>
                  </>
                )}
              </button>

              {visualizerMode === 'spectrum' ? (
                <SpectrumVisualizer bandsCount={10} className="h-6 sm:h-7 px-1.5 py-0.5" />
              ) : (
                <div className="flex items-center gap-1 h-6 sm:h-7 px-1 py-0.5 rounded-lg bg-black/40 border border-white/5">
                  <VuMeter channel="left" size="mini" label="L" />
                  <VuMeter channel="right" size="mini" label="R" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card do Anúncio Limpo com Imagem Real (Desktop / Totem) - Proporcional e Elegante */}
        {activeNowPlayingAd && activeNowPlayingAd.url_midia && (
          <div className="hidden xl:flex shrink-0 w-24 sm:w-28 h-24 sm:h-26 rounded-xl overflow-hidden border border-white/15 hover:border-amber-400/60 bg-black/40 shadow-md relative group select-none transition-all cursor-pointer">
            {activeNowPlayingAd.tipo === 'video' ? (
              <video
                src={activeNowPlayingAd.url_midia}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <img
                src={activeNowPlayingAd.url_midia}
                alt={activeNowPlayingAd.titulo}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            )}

            {/* Apenas ao passar o mouse por cima (hover): identificação discreta de Patrocínio */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
              <span className="px-1.5 py-0.5 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 text-[8px] font-mono font-medium text-white/90">
                Patrocínio
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Card Mobile Limpo com Imagem Real */}
      {activeNowPlayingAd && activeNowPlayingAd.url_midia && (
        <div className="xl:hidden w-full mt-1.5 rounded-xl overflow-hidden border border-white/15 relative group">
          <img
            src={activeNowPlayingAd.url_midia}
            alt={activeNowPlayingAd.titulo}
            className="w-full h-14 object-cover"
          />
        </div>
      )}
    </div>
  );
};
