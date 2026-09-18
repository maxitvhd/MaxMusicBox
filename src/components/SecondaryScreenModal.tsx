import { useEffect, useState } from 'react';
import { X, Maximize2, Tv2, Disc, Music } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';
import { VuMeter } from './VuMeter';
import { audioEngine } from '../services/audioEngine';

export const SecondaryScreenModal = () => {
  const isSecondaryScreenOpen = useJukeboxStore((s) => s.isSecondaryScreenOpen);
  const setSecondaryScreenOpen = useJukeboxStore((s) => s.setSecondaryScreenOpen);
  const currentTrack = useJukeboxStore((s) => s.currentTrack);
  const isPlaying = useJukeboxStore((s) => s.isPlaying);
  const queue = useJukeboxStore((s) => s.queue);
  const theme = useJukeboxStore((s) => s.theme);

  const [spectrumData, setSpectrumData] = useState<Uint8Array>(new Uint8Array(16));

  const isVintage = theme === 'amp-vintage';

  useEffect(() => {
    if (!isSecondaryScreenOpen) return;

    let animId: number;
    const updateSpectrum = () => {
      if (isPlaying) {
        setSpectrumData(audioEngine.getSpectrumData());
      } else {
        setSpectrumData(new Uint8Array(16));
      }
      animId = requestAnimationFrame(updateSpectrum);
    };

    animId = requestAnimationFrame(updateSpectrum);
    return () => cancelAnimationFrame(animId);
  }, [isSecondaryScreenOpen, isPlaying]);

  if (!isSecondaryScreenOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-6 select-none overflow-hidden animate-fadeIn">
      {/* Top Bar for Window controls */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <Tv2 className="w-5 h-5 text-cyan-400 animate-pulse" />
          <div>
            <span className="font-tech text-sm font-bold uppercase tracking-wider text-white">
              MONITOR DE ÁUDIO 2 (TELÃO DO BAR / SALÃO)
            </span>
            <span className="text-[10px] text-zinc-400 font-mono ml-3">
              Tauri Multi-Window Output • 60 FPS DSP
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white"
            title="Alternar Tela Cheia"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSecondaryScreenOpen(false)}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white"
            title="Fechar Monitor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Central Screen: Giant VU Meters + Giant Album Artwork + Real-time Spectrum Analyzer */}
      <div className="flex-1 flex flex-col items-center justify-center my-6 gap-8">
        {/* Track Title Display */}
        <div className="text-center max-w-4xl px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 text-xs font-mono font-bold uppercase tracking-widest mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            TOCANDO NO BAR AGORA
          </div>

          <h1
            className={`text-4xl sm:text-6xl font-extrabold tracking-tight truncate ${
              isVintage
                ? 'font-tech text-amber-300'
                : 'font-modern text-white text-glow-cyan'
            }`}
          >
            {currentTrack ? currentTrack.title : 'Jukebox Pronta'}
          </h1>
          <p
            className={`text-xl sm:text-2xl font-bold mt-1 ${
              isVintage ? 'text-amber-500 font-mono' : 'text-pink-400 text-glow-magenta'
            }`}
          >
            {currentTrack ? currentTrack.artist : 'Selecione uma faixa no terminal'}
          </p>
        </div>

        {/* Giant Dual VU Meters */}
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14">
          <VuMeter channel="left" label="OUTPUT MASTER L" size="large" />
          <VuMeter channel="right" label="OUTPUT MASTER R" size="large" />
        </div>

        {/* 16-Band Graphic Spectrum Analyzer */}
        <div className="w-full max-w-2xl px-4 py-4 rounded-2xl bg-[#090c14] border border-cyan-900/40 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
          <div className="flex justify-between text-[10px] font-mono text-cyan-500/80 mb-2 uppercase">
            <span>63Hz</span>
            <span>125Hz</span>
            <span>250Hz</span>
            <span>500Hz</span>
            <span>1kHz</span>
            <span>2kHz</span>
            <span>4kHz</span>
            <span>8kHz</span>
            <span>16kHz</span>
          </div>

          <div className="flex items-end justify-between h-28 gap-1.5 sm:gap-2">
            {Array.from(spectrumData).map((val: number, idx: number) => {
              const heightPercent = Math.max(8, (Number(val) / 255) * 100);

              return (
                <div
                  key={idx}
                  className="flex-1 bg-zinc-900/90 rounded-t overflow-hidden flex flex-col justify-end h-full"
                >
                  <div
                    className={`w-full transition-all duration-75 rounded-t ${
                      isVintage
                        ? 'bg-gradient-to-t from-amber-600 via-amber-400 to-red-500'
                        : 'bg-gradient-to-t from-cyan-600 via-cyan-400 to-pink-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Bar: "A SEGUIR NA JUKEBOX" Marquee Banner */}
      <div className="w-full py-3 px-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 font-bold uppercase text-amber-400 shrink-0">
          <Music className="w-4 h-4 text-cyan-400" />
          <span>A Seguir:</span>
        </div>

        <div className="flex-1 overflow-hidden mx-4 text-zinc-300 truncate">
          {queue.length > 0 ? (
            queue.slice(0, 3).map((item, idx) => (
              <span key={item.id} className="mr-6">
                #{idx + 1} <strong>{item.track.title}</strong> ({item.track.artist}) •
              </span>
            ))
          ) : (
            <span className="opacity-50">Fila livre — O Auto-DJ tocará a seleção automática do dia!</span>
          )}
        </div>

        <span className="text-[10px] text-zinc-500 shrink-0">
          Peça sua música no terminal touch
        </span>
      </div>
    </div>
  );
};
