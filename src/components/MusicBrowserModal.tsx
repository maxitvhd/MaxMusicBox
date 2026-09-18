import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Play,
  Coins,
  ListPlus,
  CheckCircle,
  Trash2,
  Zap,
  ChevronLeft,
  ChevronRight,
  Disc3
} from 'lucide-react';
import { useJukeboxStore, PAGE_SIZE } from '../store/useJukeboxStore';

export const MusicBrowserModal = () => {
  const browserOpen = useJukeboxStore((s) => s.browserOpen);
  const closeBrowser = useJukeboxStore((s) => s.closeBrowser);
  const theme = useJukeboxStore((s) => s.theme);
  const tracks = useJukeboxStore((s) => s.tracks);
  const selectedCategory = useJukeboxStore((s) => s.selectedCategory);
  const selectedArtist = useJukeboxStore((s) => s.selectedArtist);
  const page = useJukeboxStore((s) => s.trackPage);
  const setPage = useJukeboxStore((s) => s.setTrackPage);
  const currentTrack = useJukeboxStore((s) => s.currentTrack);
  const credits = useJukeboxStore((s) => s.credits);
  const currentUser = useJukeboxStore((s) => s.currentUser);
  const isPlaying = useJukeboxStore((s) => s.isPlaying);
  const userPlaylist = useJukeboxStore((s) => s.userPlaylist);
  const addToUserPlaylist = useJukeboxStore((s) => s.addToUserPlaylist);
  const removeFromUserPlaylist = useJukeboxStore((s) => s.removeFromUserPlaylist);
  const clearUserPlaylist = useJukeboxStore((s) => s.clearUserPlaylist);
  const commitUserPlaylist = useJukeboxStore((s) => s.commitUserPlaylist);
  const setPixModalOpen = useJukeboxStore((s) => s.setPixModalOpen);
  const pauseTrack = useJukeboxStore((s) => s.pauseTrack);
  const resumeTrack = useJukeboxStore((s) => s.resumeTrack);

  const isVintage = theme === 'amp-vintage';

  let filtered = tracks;
  if (selectedArtist) {
    filtered = filtered.filter((t) => t.artistId === selectedArtist.id);
  } else if (selectedCategory) {
    filtered = filtered.filter((t) => t.category === selectedCategory.id);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const playlistCost = userPlaylist.reduce((acc, t) => acc + t.cost, 0);
  const availableCredits = currentUser ? currentUser.credits : credits;
  const balanceLabel = currentUser ? `Saldo (${currentUser.name})` : 'Saldo';

  // Esc fecha a tela dedicada (o hook de teclado também trata).
  useEffect(() => {
    if (!browserOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || useJukeboxStore.getState().isPixModalOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeBrowser();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [browserOpen, closeBrowser]);

  const title = selectedArtist
    ? selectedArtist.name
    : selectedCategory
    ? selectedCategory.name
    : 'Todas as Músicas';

  return (
    <AnimatePresence>
      {browserOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={`fixed inset-0 z-50 flex flex-col ${
            isVintage ? 'bg-[#0f1115] text-amber-100' : 'bg-[#05070f] text-slate-100'
          }`}
        >
          {/* Header */}
          <div
            className={`shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b ${
              isVintage ? 'border-[#2e333e]' : 'border-cyan-900/50'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  isVintage
                    ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                    : 'bg-cyan-950/60 border-cyan-700/60 text-cyan-300'
                }`}
              >
                <Disc3 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-extrabold text-lg sm:text-xl uppercase tracking-wide truncate">
                  {title}
                </h2>
                <p className="text-[11px] font-mono opacity-70">
                  {filtered.length} faixas • teclas [1-9] selecionam • [0] play/pause • [+] / [-] página
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                    className="p-1.5 rounded-lg bg-white/5 disabled:opacity-30 hover:bg-white/10"
                    title="Página anterior [-]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono px-1 opacity-80">
                    {currentPage + 1}/{totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
                    disabled={currentPage >= totalPages - 1}
                    className="p-1.5 rounded-lg bg-white/5 disabled:opacity-30 hover:bg-white/10"
                    title="Próxima página [+]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                onClick={closeBrowser}
                className="p-2 rounded-lg bg-white/5 hover:bg-rose-950/60 hover:text-rose-300 transition-colors"
                title="Fechar [Esc]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Grid de faixas (9 por página) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {visible.map((track, idx) => {
                const keyNum = idx + 1;
                const inPlaylist = userPlaylist.some((t) => t.id === track.id);
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <button
                    key={track.id}
                    onClick={() =>
                      inPlaylist ? removeFromUserPlaylist(track.id) : addToUserPlaylist(track)
                    }
                    className={`text-left flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.99] ${
                      inPlaylist
                        ? isVintage
                          ? 'bg-amber-950/70 border-amber-500/70'
                          : 'bg-cyan-950/70 border-cyan-400/70 shadow-[0_0_14px_rgba(6,182,212,0.25)]'
                        : isCurrent
                        ? isVintage
                          ? 'bg-amber-950/40 border-amber-700/60'
                          : 'bg-cyan-950/40 border-cyan-700/60'
                        : isVintage
                        ? 'bg-[#161920] border-[#2e333e] hover:border-amber-600/60'
                        : 'bg-[#0b1222]/80 border-cyan-950 hover:border-cyan-600/60'
                    }`}
                  >
                    <span
                      className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-mono font-extrabold text-lg border ${
                        inPlaylist
                          ? 'bg-emerald-500 text-black border-emerald-300'
                          : isVintage
                          ? 'bg-[#121418] text-amber-300 border-amber-600/70'
                          : 'bg-slate-950 text-cyan-300 border-cyan-500/70'
                      }`}
                    >
                      {keyNum}
                    </span>

                    <img
                      src={track.albumArt}
                      alt={track.title}
                      className="shrink-0 w-12 h-12 rounded-xl object-cover"
                      crossOrigin="anonymous"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate flex items-center gap-1.5">
                        <span className="truncate">{track.title}</span>
                        {inPlaylist && (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                      </p>
                      <p className="text-xs opacity-70 truncate">{track.artist}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono">
                        <span
                          className={`px-1.5 py-0.2 rounded border ${
                            isVintage
                              ? 'bg-[#121418] text-amber-400 border-[#2b2f38]'
                              : 'bg-slate-900 text-cyan-400 border-cyan-900/60'
                          }`}
                        >
                          *{track.code}
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                          <Coins className="w-3 h-3" />
                          {track.cost} créd
                        </span>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 p-2 rounded-lg ${
                        inPlaylist
                          ? 'bg-emerald-600 text-white'
                          : isVintage
                          ? 'bg-[#20242b] text-amber-300'
                          : 'bg-slate-900 text-cyan-300'
                      }`}
                    >
                      <ListPlus className="w-4 h-4" />
                    </span>
                  </button>
                );
              })}
            </div>

            {visible.length === 0 && (
              <p className="text-center opacity-60 font-mono text-sm py-10">
                Nenhuma faixa nesta seleção.
              </p>
            )}
          </div>

          {/* Footer: resumo da playlist + transporte */}
          <div
            className={`shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t ${
              isVintage ? 'border-[#2e333e]' : 'border-cyan-900/50'
            }`}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <ListPlus className="w-5 h-5 shrink-0 opacity-80" />
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {userPlaylist.length} faixa(s) selecionada(s)
                  </p>
                  <p className="text-[11px] font-mono opacity-80">
                    Custo: <strong className="text-emerald-400">{playlistCost} créd</strong> •
                    {balanceLabel}: <strong>{availableCredits} créd</strong>
                    {playlistCost > availableCredits && (
                      <span className="text-rose-400 font-bold"> (faltam {playlistCost - availableCredits})</span>
                    )}
                  </p>
                </div>
              </div>

              {userPlaylist.length > 0 && (
                <button
                  onClick={clearUserPlaylist}
                  className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                  title="Limpar seleção"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => (isPlaying ? pauseTrack() : resumeTrack())}
                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                  isVintage
                    ? 'bg-[#20242b] border-amber-600/50 text-amber-300'
                    : 'bg-slate-900 border-cyan-800/80 text-cyan-300'
                }`}
                title="Play / Pause [0]"
              >
                {isPlaying ? 'Pausar [0]' : 'Tocar [0]'}
              </button>

              {userPlaylist.length > 0 && availableCredits >= playlistCost ? (
                <button
                  onClick={commitUserPlaylist}
                  className={`px-4 py-2 rounded-xl text-sm font-extrabold flex items-center gap-2 shadow-md active:scale-95 transition-all ${
                    isVintage
                      ? 'bg-amber-500 text-black hover:bg-amber-400'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950'
                  }`}
                  title="Tocar playlist [Enter]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Tocar Playlist [Enter]
                </button>
              ) : userPlaylist.length > 0 ? (
                <button
                  onClick={() => setPixModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-sm font-extrabold bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-2 shadow-md animate-pulse"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  Recarregar Pix [Enter]
                </button>
              ) : (
                <span className="text-xs font-mono opacity-60 px-2">
                  Selecione com [1-9] e confirme com [Enter]
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
