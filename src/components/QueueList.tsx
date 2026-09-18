import { ListMusic, User, Bot, Trash2, Clock } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';

export const QueueList = () => {
  const theme = useJukeboxStore((s) => s.theme);
  const queue = useJukeboxStore((s) => s.queue);
  const removeQueueItem = useJukeboxStore((s) => s.removeQueueItem);

  const isVintage = theme === 'amp-vintage';
  const displayQueue = queue.slice(0, 3);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`w-full rounded-2xl p-4 border transition-colors select-none flex flex-col justify-between ${
        isVintage
          ? 'bg-[#181b21] border-[#2e333e] text-amber-100'
          : 'bg-[#0b1222]/90 border-cyan-900/50 shadow-lg text-slate-200'
      }`}
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <ListMusic className={`w-4 h-4 ${isVintage ? 'text-amber-500' : 'text-cyan-400'}`} />
          <h3 className="font-bold text-sm uppercase tracking-wider">Próximas da Fila</h3>
        </div>
        <span
          className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
            isVintage ? 'bg-[#121418] text-amber-400' : 'bg-slate-900 text-cyan-300'
          }`}
        >
          {queue.length} {queue.length === 1 ? 'música' : 'músicas'}
        </span>
      </div>

      {displayQueue.length === 0 ? (
        <div className="py-6 text-center text-xs opacity-50 font-mono">
          A fila está vazia. O Auto-DJ tocará a seguir!
        </div>
      ) : (
        <div className="space-y-2">
          {displayQueue.map((item, index) => {
            const isAutoDj = item.requestedBy.includes('Auto-DJ');
            return (
              <div
                key={item.id}
                className={`p-2 rounded-xl flex items-center justify-between gap-2 border transition-all ${
                  isVintage
                    ? 'bg-[#121418]/90 border-[#2b303b] hover:border-amber-600/50'
                    : 'bg-[#0f172a] border-cyan-950 hover:border-cyan-700/50'
                }`}
              >
                {/* Index badge */}
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
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
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                  crossOrigin="anonymous"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{item.track.title}</p>
                  <p className="text-[11px] opacity-70 truncate">{item.track.artist}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-semibold px-1.5 py-0.2 rounded text-[9px] ${
                        isAutoDj
                          ? 'bg-purple-950/70 text-purple-300 border border-purple-800/40'
                          : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40'
                      }`}
                    >
                      {isAutoDj ? <Bot className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                      {item.requestedBy}
                    </span>
                    <span className="opacity-50 font-mono">
                      {formatDuration(item.track.duration)}
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => removeQueueItem(item.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                  title="Remover da fila"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-DJ footer note */}
      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono opacity-60">
        <span>Fila vazia? Auto-DJ assume</span>
        <span>Sem repetição (últimas 20)</span>
      </div>
    </div>
  );
};
