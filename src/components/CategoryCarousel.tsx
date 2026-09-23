import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';
import { Category } from '../types';

export const CategoryCarousel = () => {
  const theme = useJukeboxStore((s) => s.theme);
  const categories = useJukeboxStore((s) => s.categories);
  const selectedCategory = useJukeboxStore((s) => s.selectedCategory);
  const setSelectedCategory = useJukeboxStore((s) => s.setSelectedCategory);
  const openBrowser = useJukeboxStore((s) => s.openBrowser);
  const autoDjConfig = useJukeboxStore((s) => s.autoDjConfig);
  const tracks = useJukeboxStore((s) => s.tracks);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isVintage = theme === 'amp-vintage';

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = direction === 'left' ? -280 : 280;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // Check if locked category rule is active:
  const visibleCategories = autoDjConfig.categoryLocked
    ? categories.filter((c) => c.id === autoDjConfig.lockedCategoryId)
    : categories;

  return (
    <div className="w-full relative select-none group">
      {/* Scroll Buttons overlay */}
      <button
        onClick={() => scroll('left')}
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-30 p-1 rounded-r-lg border-y border-r transition-all active:scale-95 bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 ${
          isVintage ? 'border-amber-600/60 text-amber-300' : 'border-cyan-600/60 text-cyan-300'
        }`}
        title="Rolar para esquerda"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => scroll('right')}
        className={`absolute right-0 top-1/2 -translate-y-1/2 z-30 p-1 rounded-l-lg border-y border-l transition-all active:scale-95 bg-black/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 ${
          isVintage ? 'border-amber-600/60 text-amber-300' : 'border-cyan-600/60 text-cyan-300'
        }`}
        title="Rolar para direita"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {/* Carousel list */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto snap-x snap-mandatory scroll-smooth py-0.5 px-1 no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {visibleCategories.map((category, index) => {
          const isSelected = selectedCategory?.id === category.id;
          const count = tracks.filter((t) => t.category === category.id).length;
          const shortcutNum = category.code || String(index + 1);

          return (
            <button
              key={category.id}
              onClick={() =>
                isSelected && !useJukeboxStore.getState().browserOpen
                  ? setSelectedCategory(null)
                  : openBrowser(category.id)
              }
              className={`snap-start relative shrink-0 w-32 sm:w-36 h-12 sm:h-14 rounded-xl overflow-hidden text-left p-2 flex flex-col justify-end transition-all duration-200 active:scale-95 group/card cursor-pointer border ${
                isSelected
                  ? isVintage
                    ? 'ring-2 ring-amber-500 border-amber-400 shadow-lg'
                    : 'neon-border-cyan neon-glow-cyan'
                  : isVintage
                  ? 'border-[#373c46] hover:border-amber-600/70 shadow-sm'
                  : 'border-cyan-950/80 hover:border-cyan-500/60 shadow-sm'
              }`}
            >
              {/* Discreet Keypad Number Tag on top */}
              <div
                className={`absolute top-1 left-1 z-20 px-1.5 py-0.2 rounded font-mono font-extrabold text-[9px] tracking-wider border shadow-sm ${
                  isSelected
                    ? isVintage
                      ? 'bg-amber-500 text-black border-amber-400'
                      : 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                    : isVintage
                    ? 'bg-[#121418]/90 text-amber-300 border-amber-600/60'
                    : 'bg-slate-950/90 text-cyan-300 border-cyan-500/60'
                }`}
                title={`Aperte /${shortcutNum} no teclado numérico para escolher`}
              >
                /{shortcutNum}
              </div>

              {/* Background Image */}
              <img
                src={category.coverImage}
                alt={category.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                crossOrigin="anonymous"
              />

              {/* Gradient Overlay */}
              <div
                className={`absolute inset-0 transition-opacity ${
                  isVintage
                    ? 'bg-gradient-to-t from-black via-black/60 to-transparent'
                    : 'bg-gradient-to-t from-[#090d16] via-[#090d16]/70 to-transparent'
                }`}
              />

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <h4
                    className={`font-extrabold text-sm tracking-wide truncate ${
                      isVintage ? 'text-amber-200' : 'text-white'
                    }`}
                  >
                    {category.name}
                  </h4>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                      isVintage
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                        : 'bg-cyan-950/80 text-cyan-300 border border-cyan-600/50'
                    }`}
                  >
                    {count} faixas
                  </span>
                  <span className="text-[9px] opacity-70 uppercase tracking-wider text-white">
                    {isSelected ? '✓ Ativo' : `[ /${shortcutNum} ]`}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
