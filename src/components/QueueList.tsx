import { useState } from 'react';
import { ListMusic, User, Bot, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';

export const QueueList = () => {
  const theme = useJukeboxStore((s) => s.theme);
  const queue = useJukeboxStore((s) => s.queue);
  const removeQueueItem = useJukeboxStore((s) => s.removeQueueItem);
  const ads = useJukeboxStore((s) => s.ads);

  const activeAd =
    ads.find(
      (a) =>
        (!a.status || a.status === 'ativo') &&
        Boolean(a.url_midia) &&
        (a.localizacao_slot === 'now_playing_card' ||
          a.posicao === 'now_playing_card' ||
          a.localizacao_slot === 'todos' ||
          a.posicao === 'todos' ||
          a.localizacao_slot === 'all' ||
          a.posicao === 'all')
    ) ||
    ads.find(
      (a) => (!a.status || a.status === 'ativo') && Boolean(a.url_midia)
    );

  const [page, setPage] = useState(0);
  // Se passar de 2 músicas, divide a fila em dois blocos (2 colunas) com exatamente 3 linhas por coluna (6 músicas por tela)
  const isTwoBlocks = queue.length > 2;
  const pageSize = isTwoBlocks ? 6 : 3;
  const totalPages = Math.max(1, Math.ceil(queue.length / pageSize));

  // Garante que a página não fique fora dos limites se itens forem removidos
  const currentPage = Math.min(page, totalPages - 1);
  const displayQueue = queue.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const isVintage = theme === 'amp-vintage';

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`w-full h-full rounded-2xl p-2 sm:p-2.5 border transition-colors select-none flex flex-col justify-between overflow-hidden ${
        isVintage
          ? 'bg-[#181b21] border-[#2e333e] text-amber-100'
          : 'bg-[#0b1222]/90 border-cyan-900/50 shadow-lg text-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-1 pb-1 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-1.5">
          <ListMusic className={`w-3.5 h-3.5 ${isVintage ? 'text-amber-500' : 'text-cyan-400'}`} />
          <h3 className="font-bold text-xs uppercase tracking-wider">Próximas da Fila</h3>
          {isTwoBlocks && (
            <span className="hidden sm:inline-block text-[8px] font-mono px-1 py-0.2 rounded bg-white/5 opacity-60">
              2 blocos
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {queue.length > pageSize && (
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="p-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-xs"
                title="Página Anterior"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-[10px] font-mono opacity-80 px-1">
                {currentPage + 1}/{totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="p-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-xs"
                title="Próxima Página"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
          <span
            className={`text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded ${
              isVintage ? 'bg-[#121418] text-amber-400' : 'bg-slate-900 text-cyan-300'
            }`}
          >
            {queue.length} {queue.length === 1 ? 'música' : 'músicas'}
          </span>
        </div>
      </div>

      {displayQueue.length === 0 ? (
        activeAd && activeAd.url_midia ? (
          <div className="my-auto py-0.5 flex flex-col items-center select-none w-full">
            <div className="w-full h-14 sm:h-16 rounded-xl overflow-hidden border border-white/10 relative shadow-md group">
              <img
                src={activeAd.url_midia}
                alt="Patrocínio"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                <span className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 text-[9px] font-mono font-medium text-white/95">
                  Patrocínio
                </span>
              </div>
            </div>
            <p className="text-[9px] font-mono text-zinc-400 mt-1 opacity-70">
              Fila livre • Próxima faixa via Auto-DJ
            </p>
          </div>
        ) : (
          <div className="py-4 text-center text-xs opacity-50 font-mono">
            A fila está vazia. O Auto-DJ tocará a seguir!
          </div>
        )
      ) : (
        <div
          className={`flex-1 min-h-0 overflow-hidden ${
            isTwoBlocks
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-1.5 content-start'
              : 'space-y-1'
          }`}
        >
          {displayQueue.map((item, localIdx) => {
            const index = currentPage * pageSize + localIdx;
            const isAutoDj = item.requestedBy.includes('Auto-DJ');
            return (
              <div
                key={item.id}
                className={`py-1 px-1.5 rounded-lg flex items-center justify-between gap-1.5 border transition-all ${
                  isVintage
                    ? 'bg-[#121418]/90 border-[#2b303b] hover:border-amber-600/50'
                    : 'bg-[#0f172a] border-cyan-950 hover:border-cyan-700/50'
                }`}
              >
                {/* Index badge */}
                <div
                  className={`w-4 h-4 rounded-md flex items-center justify-center font-mono font-bold text-[9px] shrink-0 ${
                    index === 0
                      ? isVintage
                        ? 'bg-amber-600 text-zinc-950'
                        : 'bg-cyan-400 text-slate-950 font-bold'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {index + 1}
                </div>

                {/* Thumb */}
                <img
                  src={item.track.albumArt}
                  alt={item.track.title}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-md object-cover shrink-0"
                  crossOrigin="anonymous"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-[10.5px] font-bold truncate leading-tight">
                    {item.track.title}
                  </p>
                  <div className="flex items-center gap-1 text-[8.5px] opacity-75 leading-tight truncate">
                    <span className="truncate">{item.track.artist}</span>
                    <span>•</span>
                    <span className="font-mono shrink-0">{formatDuration(item.track.duration)}</span>
                  </div>
                </div>

                {/* Tag & Delete */}
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className={`hidden xl:inline-flex items-center gap-0.5 font-mono font-semibold px-1 py-0.2 rounded text-[7.5px] ${
                      isAutoDj
                        ? 'bg-purple-950/70 text-purple-300 border border-purple-800/40'
                        : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40'
                    }`}
                  >
                    {isAutoDj ? <Bot className="w-2 h-2" /> : <User className="w-2 h-2" />}
                    <span className="max-w-[45px] truncate">{item.requestedBy}</span>
                  </span>

                  <button
                    onClick={() => removeQueueItem(item.id)}
                    className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                    title="Remover da fila"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-DJ footer note (somente se fila vazia) */}
      {queue.length === 0 && (
        <div className="mt-1 pt-0.5 border-t border-white/5 flex items-center justify-between text-[8.5px] font-mono opacity-50">
          <span>Fila vazia? Auto-DJ assume</span>
          <span>Sem repetição</span>
        </div>
      )}
    </div>
  );
};
