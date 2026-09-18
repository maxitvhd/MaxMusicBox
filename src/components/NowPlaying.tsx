import { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, Disc, Volume2, Sparkles, Activity, Gauge } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';
import { SpectrumVisualizer } from './SpectrumVisualizer';
import { VuMeter } from './VuMeter';

export const NowPlaying = () => {
  const theme = useJukeboxStore((s) => s.theme);
  const currentTrack = useJukeboxStore((s) => s.currentTrack);
  const isPlaying = useJukeboxStore((s) => s.isPlaying);
  const progressSeconds = useJukeboxStore((s) => s.progressSeconds);
  const setProgressSeconds = useJukeboxStore((s) => s.setProgressSeconds);
  const pauseTrack = useJukeboxStore((s) => s.pauseTrack);
  const resumeTrack = useJukeboxStore((s) => s.resumeTrack);
  const skipTrack = useJukeboxStore((s) => s.skipTrack);

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
    return (
      <div
        className={`w-full h-full min-h-[260px] flex flex-col items-center justify-center p-6 rounded-2xl border transition-colors ${
          isVintage
            ? 'bg-[#181a1f] border-[#2e333d] text-amber-500'
            : 'bg-[#0f172a] border-cyan-900/60 text-cyan-400'
        }`}
      >
        <Disc className="w-16 h-16 opacity-30 animate-pulse mb-3" />
        <p className="font-mono text-sm uppercase tracking-wider">Aguardando seleção de faixa...</p>
      </div>
    );
  }

  const progressPercent = Math.min(100, (progressSeconds / currentTrack.duration) * 100);

  return (
    <div
      className={`relative w-full rounded-2xl p-5 border transition-all duration-200 select-none overflow-hidden ${
        isVintage
          ? 'bg-[#1b1f26] border-[#313744] shadow-2xl text-amber-100'
          : 'bg-[#0f172a]/95 border-cyan-800/60 shadow-[0_8px_30px_rgba(6,182,212,0.12)] text-slate-100'
      }`}
    >
      {/* Background ambient lighting */}
      <div
        className={`absolute -right-16 -top-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-20 ${
          isVintage ? 'bg-amber-600' : 'bg-cyan-500'
        }`}
      />

      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Album Artwork & Vinyl Disc Simulation */}
        <div className="relative flex items-center justify-center">
          {/* Spinning Vinyl Record behind the sleeve */}
          <div
            className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-300 ${
              isPlaying ? 'animate-spin-slow' : 'animate-spin-paused'
            } ${
              isVintage
                ? 'border-4 border-[#2b1f15] bg-[radial-gradient(circle,#18140f_20%,#0a0805_70%,#241a12_100%)] shadow-black/80'
                : 'border-2 border-cyan-500/50 bg-[radial-gradient(circle,#090d16_25%,#04070f_65%,#081224_100%)] shadow-[0_0_20px_rgba(6,182,212,0.3)]'
            }`}
          >
            {/* Grooves on vinyl */}
            <div className="w-3/4 h-3/4 rounded-full border border-white/5 flex items-center justify-center">
              <div className="w-2/3 h-2/3 rounded-full border border-white/5 flex items-center justify-center">
                {/* Vinyl Label */}
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center border-2 overflow-hidden ${
                    isVintage
                      ? 'bg-amber-700 border-amber-400 text-amber-100'
                      : 'bg-cyan-900 border-cyan-400 text-cyan-200'
                  }`}
                >
                  <Disc className="w-6 h-6 opacity-70" />
                </div>
              </div>
            </div>
            {/* Center Spindle hole */}
            <div className="absolute w-3 h-3 bg-zinc-950 rounded-full border border-zinc-700" />
          </div>

          {/* Album Cover Sleeve in front */}
          <div
            className={`absolute -left-3 sm:-left-4 w-32 h-32 sm:w-36 sm:h-36 rounded-xl overflow-hidden border-2 shadow-2xl z-10 transition-transform ${
              isVintage
                ? 'border-amber-500/40 shadow-black/90'
                : 'border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
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
              className={`absolute top-2 left-2 px-2 py-0.5 rounded font-mono font-bold text-xs tracking-wider border shadow-md ${
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
        <div className="flex-1 min-w-0 w-full flex flex-col justify-between">
          {/* Header pill: Now Playing & Genre */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className={`text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                isPlaying
                  ? isVintage
                    ? 'bg-amber-900/60 text-amber-300 border border-amber-600/50'
                    : 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isPlaying ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'
                }`}
              />
              {isPlaying ? 'TOCANDO AGORA' : 'PAUSADO'}
            </span>

            <span
              className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded ${
                isVintage
                  ? 'bg-[#13151a] text-amber-400 border border-[#2d313b]'
                  : 'bg-slate-900/80 text-cyan-400 border border-cyan-900'
              }`}
            >
              Gênero: {currentTrack.category.toUpperCase()} • {currentTrack.bpm} BPM
            </span>
          </div>

          {/* Marquee Track Title & Artist */}
          <div className="overflow-hidden relative py-1 mb-1">
            <div className="whitespace-nowrap">
              <h2
                className={`text-2xl sm:text-3xl font-extrabold tracking-wide truncate ${
                  isVintage ? 'font-tech text-amber-200' : 'font-modern text-white'
                }`}
                title={currentTrack.title}
              >
                {currentTrack.title}
              </h2>
            </div>
            <p
              className={`text-base font-semibold truncate ${
                isVintage ? 'text-amber-500/90 font-mono' : 'text-pink-400 text-glow-magenta'
              }`}
            >
              {currentTrack.artist}
            </p>
          </div>

          {/* Progress Bar & Time */}
          <div className="w-full mt-2">
            <div
              className={`w-full h-2 rounded-full overflow-hidden relative ${
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
              className={`flex justify-between text-xs mt-1 font-mono ${
                isVintage ? 'text-amber-600' : 'text-slate-400'
              }`}
            >
              <span>{formatTime(progressSeconds)}</span>
              <span>{formatTime(currentTrack.duration)}</span>
            </div>
          </div>

          {/* Transport Controls (Play/Pause, Skip) */}
          <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-white/5">
            <div className="flex items-center gap-3">
              {isPlaying ? (
                <button
                  onClick={pauseTrack}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 ${
                    isVintage
                      ? 'vintage-neumorphic-btn text-amber-300 hover:text-white'
                      : 'bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 neon-glow-cyan'
                  }`}
                  title="Pausar Música"
                >
                  <Pause className="w-6 h-6 fill-current" />
                </button>
              ) : (
                <button
                  onClick={resumeTrack}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 ${
                    isVintage
                      ? 'vintage-neumorphic-btn text-amber-300 hover:text-white'
                      : 'bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 neon-glow-cyan'
                  }`}
                  title="Tocar Música"
                >
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                </button>
              )}

              <button
                onClick={skipTrack}
                className={`p-3 rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold uppercase ${
                  isVintage
                    ? 'vintage-neumorphic-btn text-amber-400 hover:text-amber-200'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-700'
                }`}
                title="Pular para a Próxima da Fila"
              >
                <SkipForward className="w-4 h-4" />
                <span>Pular Faixa</span>
              </button>
            </div>

            {/* Luminous LED Spectrum Equalizer or Classic VU Meters */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVisualizerMode(m => m === 'spectrum' ? 'vu' : 'spectrum')}
                  className={`flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                    visualizerMode === 'spectrum'
                      ? isVintage
                        ? 'bg-amber-950/80 text-amber-300 border-amber-600/60'
                        : 'bg-cyan-950/80 text-cyan-300 border-cyan-600/60 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                      : 'bg-slate-900/80 text-zinc-400 border-zinc-700'
                  }`}
                  title="Alternar entre Equalizador Espectro Luminoso e VU Meters"
                >
                  {visualizerMode === 'spectrum' ? (
                    <>
                      <Activity className={`w-3 h-3 ${isVintage ? 'text-amber-400' : 'text-cyan-400'} animate-pulse`} />
                      <span className="uppercase tracking-wider">EQ Espectro</span>
                    </>
                  ) : (
                    <>
                      <Gauge className={`w-3 h-3 text-amber-400`} />
                      <span className="uppercase tracking-wider">VU Analógico</span>
                    </>
                  )}
                  <span className="opacity-60 text-[9px]">⮂</span>
                </button>
              </div>

              {visualizerMode === 'spectrum' ? (
                <SpectrumVisualizer bandsCount={14} className="h-10 px-2.5 py-1" />
              ) : (
                <div className="flex items-center gap-1.5 h-10 px-1 py-0.5 rounded-lg bg-black/40 border border-white/5">
                  <VuMeter channel="left" size="mini" label="L" />
                  <VuMeter channel="right" size="mini" label="R" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
