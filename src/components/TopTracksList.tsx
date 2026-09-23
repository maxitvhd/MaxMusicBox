import { Flame, Play, Plus, Coins, Trophy } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';
import { Track } from '../types';

interface TopTracksListProps {
  limit?: number;
}

export const TopTracksList = ({ limit = 15 }: TopTracksListProps) => {
  const theme = useJukeboxStore((s) => s.theme);
  const tracks = useJukeboxStore((s) => s.tracks);
  const currentTrack = useJukeboxStore((s) => s.currentTrack);
  const playTrack = useJukeboxStore((s) => s.playTrack);
  const addToQueue = useJukeboxStore((s) => s.addToQueue);
  const openBrowser = useJukeboxStore((s) => s.openBrowser);

  const isVintage = theme === 'amp-vintage';

  // Order top tracks by popularity / simulated plays
  const topTracks: (Track & { plays: number; rank: number })[] = tracks
    .slice(0, limit)
    .map((track, idx) => ({
      ...track,
      rank: idx + 1,
      // Simulated realistic jukebox plays
      plays: Math.max(14, Math.floor(180 - idx * 9.5 + ((idx * 7) % 11)))
    }));

  return (
    <div
      className={`w-full h-full flex flex-col rounded-2xl p-3 sm:p-4 border transition-colors select-none ${
        isVintage
          ? 'bg-[#181a20] border-[#2f343f] text-amber-100 shadow-xl'
          : 'bg-[#0a0f1d]/90 border-cyan-900/50 text-slate-200 shadow-[0_4px_25px_rgba(6,182,212,0.08)]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 shrink-0">
        <div
          onClick={() => openBrowser('top15')}
          className="flex items-center gap-2 cursor-pointer group"
          title="Clique para abrir a tela cheia de Sucessos"
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${
              isVintage
                ? 'bg-amber-950/80 border border-amber-600/50 text-amber-400'
                : 'bg-rose-950/80 border border-rose-500/50 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
            }`}
          >
            <Flame className="w-4 h-4 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-xs sm:text-sm uppercase tracking-wider font-modern group-hover:text-amber-400 transition-colors">
                Top Sucessos Jukebox
              </h3>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                  isVintage
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                }`}
              >
                HOT
              </span>
            </div>
            <p className="text-[10px] opacity-60 font-mono">
              Digite <span className="font-bold text-amber-400">*código</span> ou toque para abrir
            </p>
          </div>
        </div>

        <button
          onClick={() => openBrowser('top15')}
          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono opacity-80 hover:opacity-100 flex items-center gap-1 transition-all"
          title="Abrir tela cheia de sucessos"
        >
          <span>Ver Todos</span>
          <span className="text-amber-400 font-bold">⤢</span>
        </button>
      </div>

      {/* Scrollable list of Top 15 Tracks */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
        {topTracks.map((track) => {
          const isCurrent = currentTrack?.id === track.id;
          const isPodium = track.rank <= 3;

          return (
            <div
              key={track.id}
              className={`flex items-center justify-between p-1.5 rounded-lg transition-all duration-150 border ${
                isCurrent
                  ? isVintage
                    ? 'bg-amber-950/50 border-amber-600 text-amber-200 shadow-md'
                    : 'bg-cyan-950/60 border-cyan-500/80 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : isVintage
                  ? 'bg-[#121419]/70 hover:bg-[#1f232c] border-[#252932]'
                  : 'bg-slate-900/50 hover:bg-slate-800/80 border-slate-800/80'
              }`}
            >
              {/* Left: Rank & Track details */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Rank Badge */}
                <div
                  className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center font-mono font-extrabold text-[10px] ${
                    track.rank === 1
                      ? 'bg-amber-400 text-black shadow-[0_0_8px_#f59e0b]'
                      : track.rank === 2
                      ? 'bg-slate-300 text-black shadow-[0_0_8px_#cbd5e1]'
                      : track.rank === 3
                      ? 'bg-amber-700 text-amber-100'
                      : 'bg-white/5 text-zinc-400 font-normal'
                  }`}
                >
                  {track.rank}
                </div>

                {/* Direct Keypad Code Badge */}
                <span
                  className={`px-1.5 py-0.2 rounded font-mono font-extrabold text-[10px] tracking-wider shrink-0 border ${
                    isCurrent
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                      : isVintage
                      ? 'bg-[#0d0e12] text-amber-400 border-amber-800/60'
                      : 'bg-cyan-950/90 text-cyan-300 border-cyan-700/60'
                  }`}
                  title={`Digite *${track.code} no teclado numérico para tocar`}
                >
                  *{track.code}
                </span>

                {/* Album Cover */}
                <img
                  src={track.albumArt}
                  alt={track.title}
                  className="w-6 h-6 rounded-md object-cover shrink-0"
                  crossOrigin="anonymous"
                />

                {/* Title & Artist */}
                <div className="min-w-0 flex-1 pr-1.5">
                  <p className="font-bold text-xs truncate leading-tight">
                    {track.title}
                  </p>
                  <p className="text-[9.5px] opacity-70 truncate font-mono">
                    {track.artist}
                  </p>
                </div>
              </div>

              {/* Right: Plays & Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="hidden sm:inline text-[9.5px] font-mono opacity-50 mr-0.5">
                  {track.plays}x
                </span>

                <button
                  onClick={() => addToQueue(track, 'Cliente (Top 15)')}
                  className={`p-1 rounded-md border text-xs transition-all active:scale-95 ${
                    isVintage
                      ? 'vintage-neumorphic-btn text-amber-400 hover:text-white'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:text-cyan-300'
                  }`}
                  title="Adicionar à fila"
                >
                  <Plus className="w-3 h-3" />
                </button>

                <button
                  onClick={() => playTrack(track, 'Cliente (Top 15)')}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all active:scale-95 ${
                    isVintage
                      ? 'bg-amber-600 hover:bg-amber-500 text-black font-extrabold'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold neon-glow-cyan'
                  }`}
                  title="Tocar Agora"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span className="text-[11px]">Tocar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
