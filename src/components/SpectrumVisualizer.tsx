import { useEffect, useRef, useState } from 'react';
import { useJukeboxStore } from '../store/useJukeboxStore';

interface SpectrumVisualizerProps {
  bandsCount?: number;
  className?: string;
}

export const SpectrumVisualizer = ({ bandsCount = 16, className = '' }: SpectrumVisualizerProps) => {
  const isPlaying = useJukeboxStore((s) => s.isPlaying);
  const theme = useJukeboxStore((s) => s.theme);
  const isVintage = theme === 'amp-vintage';

  const [bandLevels, setBandLevels] = useState<number[]>(() => new Array(bandsCount).fill(0.05));
  const audioRmsRef = useRef<number>(0);
  const spectrumRef = useRef<number[]>([]);

  // Telemetria vinda do DSP nativo (Rust) ou do motor WebAudio (fallback)
  const storeLevels = useJukeboxStore((s) => Math.max(s.audioLevels.left, s.audioLevels.right));
  const storeSpectrum = useJukeboxStore((s) => s.audioSpectrum);

  useEffect(() => {
    audioRmsRef.current = storeLevels;
  }, [storeLevels]);

  useEffect(() => {
    spectrumRef.current = storeSpectrum;
  }, [storeSpectrum]);

  useEffect(() => {
    let animId: number;
    let phase = 0;

    const loop = () => {
      phase += 0.08;
      const rms = Math.max(0.05, audioRmsRef.current);
      const spectrum = spectrumRef.current;
      // Se o DSP nativo está enviando bandas, usa SEMPRE o sinal real.
      // Ao pausar, o backend zera as bandas -> os LEDs caem.
      const hasRealSpectrum = Array.isArray(spectrum) && spectrum.length >= bandsCount;

      setBandLevels((prev) =>
        prev.map((_, i) => {
          const current = prev[i] ?? 0;

          // Espectro real (FFT do Rust)
          if (hasRealSpectrum) {
            return current + (Math.min(1, spectrum[i] ?? 0) - current) * 0.4;
          }

          // Fallback (navegador/dev): simulação animada enquanto toca.
          if (!isPlaying) {
            return Math.max(0.03, 0.05 + 0.03 * Math.sin(phase + i * 0.5));
          }
          const baseWeight = i < 4 ? 0.95 : i < 11 ? 0.75 : 0.6;
          const harmonic = Math.abs(Math.sin(phase * 1.6 + i * 0.85) * Math.cos(phase * 0.9 + i * 0.4));
          const target = Math.min(1, rms * baseWeight * 1.3 + harmonic * 0.45 * rms);
          return current + (target - current) * 0.35;
        })
      );

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, bandsCount]);

  // Color segment levels (7 segments per bar)
  const segments = 8;

  return (
    <div
      className={`flex items-end justify-center gap-1 sm:gap-1.5 p-2 rounded-xl border select-none ${
        isVintage
          ? 'bg-[#101216] border-[#292d37] shadow-inner'
          : 'bg-[#040813] border-cyan-950 shadow-[inset_0_0_12px_rgba(6,182,212,0.15)]'
      } ${className}`}
      title="Equalizador Luminoso Espectral de Áudio (DSP Quasar)"
    >
      {bandLevels.map((level, bIdx) => {
        const activeSegments = Math.round(level * segments);

        return (
          <div key={bIdx} className="flex flex-col gap-0.5 items-center w-2.5 sm:w-3">
            {Array.from({ length: segments })
              .map((_, sIdx) => segments - 1 - sIdx) // top to bottom
              .map((segIdx) => {
                const isLit = segIdx < activeSegments;
                // High segments (6, 7) = RED, mid (4, 5) = AMBER/ORANGE, low (0-3) = GREEN/CYAN
                let litColor = '';
                let dimColor = 'bg-white/5';

                if (isVintage) {
                  if (segIdx >= 6) {
                    litColor = 'bg-red-500 shadow-[0_0_6px_#ef4444]';
                  } else if (segIdx >= 4) {
                    litColor = 'bg-amber-400 shadow-[0_0_6px_#f59e0b]';
                  } else {
                    litColor = 'bg-emerald-400 shadow-[0_0_5px_#10b981]';
                  }
                } else {
                  if (segIdx >= 6) {
                    litColor = 'bg-pink-500 shadow-[0_0_8px_#ec4899]';
                  } else if (segIdx >= 4) {
                    litColor = 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]';
                  } else {
                    litColor = 'bg-teal-400 shadow-[0_0_6px_#2dd4bf]';
                  }
                }

                return (
                  <div
                    key={segIdx}
                    className={`w-full h-1 sm:h-1.5 rounded-[1px] transition-all duration-75 ${
                      isLit ? litColor : dimColor
                    }`}
                  />
                );
              })}
          </div>
        );
      })}
    </div>
  );
};
