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
    <div className="w-full relative select-none">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <h3
            className={`font-bold text-sm tracking-wider uppercase ${
              isVintage ? 'font-tech text-amber-300' : 'text-slate-200'
            }`}
          >
            Categorias Musicais
          </h3>
          {autoDjConfig.categoryLocked && (
            <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-700">
              <Lock className="w-2.5 h-2.5" />
              CATEGORIA TRAVADA PELO ADMIN
            </span>
          )}
        </div>

        {/* Scroll Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll('left')}
            className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
              isVintage
                ? 'vintage-neumorphic-btn text-amber-400'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
              isVintage
                ? 'vintage-neumorphic-btn text-amber-400'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carousel list */}
      <div
        ref={scrollRef}
        className="flex items-center gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 px-1 no-scrollbar"
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
              className={`snap-start relative shrink-0 w-44 sm:w-52 h-24 sm:h-28 rounded-2xl overflow-hidden text-left p-3 flex flex-col justify-end transition-all duration-200 active:scale-95 group cursor-pointer border ${
                isSelected
                  ? isVintage
                    ? 'ring-2 ring-amber-500 border-amber-400 shadow-xl'
                    : 'neon-border-cyan neon-glow-cyan'
                  : isVintage
                  ? 'border-[#373c46] hover:border-amber-600/70 shadow-md'
                  : 'border-cyan-950/80 hover:border-cyan-500/60 shadow-lg'
              }`}
            >
              {/* Discreet Keypad Number Tag on top */}
              <div
                className={`absolute top-2 left-2 z-20 px-2 py-0.5 rounded font-mono font-extrabold text-[11px] tracking-wider border shadow-md ${
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
