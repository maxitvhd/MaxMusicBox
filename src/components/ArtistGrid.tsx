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
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <Users className={`w-4 h-4 ${isVintage ? 'text-amber-500' : 'text-pink-400'}`} />
          <h3
            className={`font-bold text-sm tracking-wider uppercase ${
              isVintage ? 'font-tech text-amber-300' : 'text-slate-200'
            }`}
          >
            Artistas {selectedCategory ? `• ${selectedCategory.name}` : ''}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="p-1 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10 text-xs font-mono flex items-center gap-0.5"
                title="Página anterior [-]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="text-[10px]">[-]</span>
              </button>
              <span className="text-[11px] font-mono px-1 opacity-70">
                {currentPage + 1}/{totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10 text-xs font-mono flex items-center gap-0.5"
                title="Próxima página [+]"
              >
                <span className="text-[10px]">[+]</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {selectedArtist && (
            <button
              onClick={() => setSelectedArtist(null)}
              className="text-xs text-cyan-400 hover:underline font-mono"
            >
              Ver todos
            </button>
          )}
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex items-center gap-4 overflow-x-auto pb-2 px-1 scroll-smooth"
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
              className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer active:scale-95 transition-transform"
            >
              {/* Circular Avatar with Discreet Keypad Number */}
              <div
                className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden p-1 transition-all duration-200 border-2 ${
                  isSelected
                    ? isVintage
                      ? 'border-amber-400 ring-4 ring-amber-500/30'
                      : 'neon-border-magenta shadow-[0_0_15px_rgba(236,72,153,0.5)]'
                    : isVintage
                    ? 'border-[#373c46] group-hover:border-amber-500/60'
                    : 'border-slate-800 group-hover:border-cyan-500/60'
                }`}
              >
                {/* Number Badge */}
                <div
                  className={`absolute top-0 right-0 z-20 w-5 h-5 rounded-full flex items-center justify-center font-mono font-extrabold text-[10px] border shadow ${
                    isSelected
                      ? 'bg-pink-500 text-white border-pink-300'
                      : isVintage
                      ? 'bg-[#121418] text-amber-300 border-amber-600/70'
                      : 'bg-slate-950 text-cyan-300 border-cyan-500/70'
                  }`}
                  title={`Aperte ${artistKeyNum} no teclado numérico`}
                >
                  {artistKeyNum}
                </div>

                <img
                  src={artist.avatar}
                  alt={artist.name}
                  className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform"
                  crossOrigin="anonymous"
                />
              </div>

              {/* Artist Name & Count */}
              <div className="text-center max-w-[100px]">
                <p
                  className={`text-xs font-bold truncate ${
                    isSelected
                      ? isVintage
                        ? 'text-amber-300'
                        : 'text-pink-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  {artist.name}
                </p>
                <span className="text-[9px] text-zinc-400 font-mono">
                  [tecla {artistKeyNum}] • {count} fxs
                </span>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
};
