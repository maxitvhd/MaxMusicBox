import { useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useJukeboxStore, PAGE_SIZE } from '../store/useJukeboxStore';
import { Artist } from '../types';

export const ArtistGrid = () => {
  const theme = useJukeboxStore((s) => s.theme);
  const artists = useJukeboxStore((s) => s.artists);
  const selectedCategory = useJukeboxStore((s) => s.selectedCategory);
  const selectedArtist = useJukeboxStore((s) => s.selectedArtist);
  const setSelectedArtist = useJukeboxStore((s) => s.setSelectedArtist);
  const openBrowser = useJukeboxStore((s) => s.openBrowser);
  const tracks = useJukeboxStore((s) => s.tracks);
  const page = useJukeboxStore((s) => s.artistPage);
  const setPage = useJukeboxStore((s) => s.setArtistPage);

  const isVintage = theme === 'amp-vintage';

  // Filter artists by selected category if any
  const displayedArtists = selectedCategory
    ? artists.filter((a) => a.categoryId === selectedCategory.id)
    : artists;

  const totalPages = Math.max(1, Math.ceil(displayedArtists.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleArtists = displayedArtists.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // Garante que a página persistida não fique fora do intervalo ao trocar de filtro.
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage, setPage]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.9 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } }
  };

  return (
    <div className="w-full select-none">
      {/* Discreet pagination bar if multiple pages */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 pb-1 text-xs">
          <span className="text-[10px] font-mono opacity-60">
            Artistas {selectedCategory ? `(${selectedCategory.name})` : ''} • Pág {currentPage + 1}/{totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="px-1.5 py-0.5 rounded bg-white/5 disabled:opacity-25 hover:bg-white/10 text-[10px] font-mono flex items-center gap-0.5"
              title="Página anterior [-]"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>[-]</span>
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              className="px-1.5 py-0.5 rounded bg-white/5 disabled:opacity-25 hover:bg-white/10 text-[10px] font-mono flex items-center gap-0.5"
              title="Próxima página [+]"
            >
              <span>[+]</span>
              <ChevronRight className="w-3 h-3" />
            </button>
            {selectedArtist && (
              <button
                onClick={() => setSelectedArtist(null)}
                className="ml-2 text-[10px] text-cyan-400 hover:underline font-mono"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex items-center gap-2.5 overflow-x-auto py-0.5 px-1 no-scrollbar scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        {visibleArtists.map((artist: Artist, index: number) => {
          const isSelected = selectedArtist?.id === artist.id;
          const count = tracks.filter((t) => t.artistId === artist.id).length;
          const artistKeyNum = index + 1;

          return (
            <motion.button
              key={artist.id}
              variants={itemVariants}
              onClick={() =>
                isSelected && !useJukeboxStore.getState().browserOpen
                  ? setSelectedArtist(null)
                  : openBrowser(selectedCategory?.id ?? null, artist.id)
              }
              className={`flex items-center gap-2 shrink-0 px-2 py-1 rounded-xl border transition-all active:scale-95 group cursor-pointer ${
                isSelected
                  ? isVintage
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                    : 'bg-pink-950/40 border-pink-500 text-pink-200 ring-1 ring-pink-500'
                  : isVintage
                  ? 'bg-[#181a20] border-[#2f343f] hover:border-amber-600/60'
                  : 'bg-[#0f172a]/80 border-slate-800 hover:border-cyan-600/60'
              }`}
            >
              {/* Circular Avatar with Keypad Number Overlay */}
              <div
                className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden shrink-0 border ${
                  isSelected
                    ? isVintage
                      ? 'border-amber-400'
                      : 'border-pink-400'
                    : 'border-white/10'
                }`}
              >
                <img
                  src={artist.avatar}
                  alt={artist.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                  crossOrigin="anonymous"
                />
                <div
                  className={`absolute top-0 right-0 z-10 w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono font-extrabold text-[8px] border ${
                    isSelected
                      ? 'bg-pink-500 text-white border-pink-300'
                      : isVintage
                      ? 'bg-black/80 text-amber-300 border-amber-600/70'
                      : 'bg-black/80 text-cyan-300 border-cyan-500/70'
                  }`}
                  title={`Aperte ${artistKeyNum} no teclado numérico`}
                >
                  {artistKeyNum}
                </div>
              </div>

              {/* Artist Info */}
              <div className="text-left min-w-0 max-w-[85px] sm:max-w-[100px]">
                <p
                  className={`text-[11px] font-bold truncate leading-tight ${
                    isSelected
                      ? isVintage
                        ? 'text-amber-300'
                        : 'text-pink-300 font-extrabold'
                      : 'text-slate-200'
                  }`}
                >
                  {artist.name}
                </p>
                <span className="text-[9px] text-zinc-400 font-mono">
                  [{artistKeyNum}] • {count} fxs
                </span>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};
