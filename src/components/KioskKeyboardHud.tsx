import { useEffect, useState } from 'react';
import { Hash, Volume2, Music, FolderOpen, Coins, CheckCircle, AlertTriangle } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';

export const KioskKeyboardHud = () => {
  const theme = useJukeboxStore((s) => s.theme);
  const kioskHud = useJukeboxStore((s) => s.kioskHud);
  const hideKioskHud = useJukeboxStore((s) => s.hideKioskHud);
  const dspSettings = useJukeboxStore((s) => s.dspSettings);

  const isVintage = theme === 'amp-vintage';

  if (!kioskHud.visible) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
      <div
        className={`px-5 py-3 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center gap-3.5 min-w-[280px] max-w-md ${
          kioskHud.type === 'success'
            ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
            : kioskHud.type === 'warning' || kioskHud.type === 'error'
            ? 'bg-rose-950/95 border-rose-500 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.4)]'
            : isVintage
            ? 'bg-[#181a20]/95 border-amber-600/70 text-amber-200 shadow-black/80'
            : 'bg-[#090e1c]/95 border-cyan-500/80 text-cyan-200 shadow-[0_0_25px_rgba(6,182,212,0.35)]'
        }`}
      >
        {/* Icon indicator */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
            kioskHud.type === 'success'
              ? 'bg-emerald-800 border-emerald-400 text-emerald-100'
              : kioskHud.type === 'warning' || kioskHud.type === 'error'
              ? 'bg-rose-800 border-rose-400 text-rose-100'
              : isVintage
              ? 'bg-amber-950 border-amber-500 text-amber-300'
              : 'bg-cyan-950 border-cyan-400 text-cyan-300'
          }`}
        >
          {kioskHud.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : kioskHud.type === 'warning' || kioskHud.type === 'error' ? (
            <AlertTriangle className="w-5 h-5" />
          ) : kioskHud.text.includes('Volume') ? (
            <Volume2 className="w-5 h-5" />
          ) : kioskHud.text.includes('Categoria') || kioskHud.text.startsWith('/') ? (
            <FolderOpen className="w-5 h-5" />
          ) : (
            <Music className="w-5 h-5" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm tracking-wide truncate">
            {kioskHud.text}
          </p>
          {kioskHud.subText && (
            <p className="text-xs opacity-75 font-mono truncate mt-0.5">
              {kioskHud.subText}
            </p>
          )}

          {/* Volume progress bar if showing volume */}
          {kioskHud.text.includes('Volume') && (
            <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden mt-1.5 border border-white/10">
              <div
                className={`h-full transition-all duration-100 ${
                  isVintage ? 'bg-amber-400' : 'bg-cyan-400'
                }`}
                style={{ width: `${Math.min(100, (dspSettings.masterGain / 1.5) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
