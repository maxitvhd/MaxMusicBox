import { useEffect } from 'react';
import { Play, Disc, Coins, ListPlus, CheckCircle, Trash2, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { useJukeboxStore, PAGE_SIZE } from '../store/useJukeboxStore';

export const TrackList = () => {
  const theme = useJukeboxStore((s) => s.theme);
  const tracks = useJukeboxStore((s) => s.tracks);
  const currentUser = useJukeboxStore((s) => s.currentUser);
  const credits = useJukeboxStore((s) => s.credits);
  const availableCredits = currentUser ? currentUser.credits : credits;
  const selectedCategory = useJukeboxStore((s) => s.selectedCategory);
  const selectedArtist = useJukeboxStore((s) => s.selectedArtist);
  const currentTrack = useJukeboxStore((s) => s.currentTrack);
  const playTrack = useJukeboxStore((s) => s.playTrack);
  const addToQueue = useJukeboxStore((s) => s.addToQueue);
  const ads = useJukeboxStore((s) => s.ads);

  const activeAd = ads.find(
    (a) => (!a.status || a.status === 'ativo') && Boolean(a.url_midia)
  );

  // User Playlist builder
  const userPlaylist = useJukeboxStore((s) => s.userPlaylist);
  const addToUserPlaylist = useJukeboxStore((s) => s.addToUserPlaylist);
  const removeFromUserPlaylist = useJukeboxStore((s) => s.removeFromUserPlaylist);
  const clearUserPlaylist = useJukeboxStore((s) => s.clearUserPlaylist);
  const commitUserPlaylist = useJukeboxStore((s) => s.commitUserPlaylist);
  const setPixModalOpen = useJukeboxStore((s) => s.setPixModalOpen);
  const openBrowser = useJukeboxStore((s) => s.openBrowser);
  const page = useJukeboxStore((s) => s.trackPage);
  const setPage = useJukeboxStore((s) => s.setTrackPage);

  const isVintage = theme === 'amp-vintage';

  // Filter tracks
  let filteredTracks = tracks;
  if (selectedArtist) {
    filteredTracks = filteredTracks.filter((t) => t.artistId === selectedArtist.id);
  } else if (selectedCategory) {
    filteredTracks = filteredTracks.filter((t) => t.category === selectedCategory.id);
  }

  // Paginação: 9 por página (teclado numérico seleciona 1-9)
  const totalPages = Math.max(1, Math.ceil(filteredTracks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleTracks = filteredTracks.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage, setPage]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const totalPlaylistCost = userPlaylist.reduce((acc, t) => acc + t.cost, 0);

  return (
    <div
      className={`w-full h-full flex flex-col rounded-2xl p-3 sm:p-4 border transition-colors select-none overflow-hidden ${
        isVintage
          ? 'bg-[#181b21] border-[#2e333e] text-amber-100'
          : 'bg-[#0b1222]/90 border-cyan-900/50 shadow-xl text-slate-200'
      }`}
    >
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-white/5">
        <div
          onClick={() => openBrowser(selectedCategory ? selectedCategory.id : 'tracks', selectedArtist ? selectedArtist.id : null)}
          className="flex items-center gap-2 cursor-pointer group"
          title="Clique para abrir em tela cheia"
        >
          <Disc className={`w-4 h-4 transition-transform group-hover:scale-110 ${isVintage ? 'text-amber-500' : 'text-cyan-400'}`} />
          <h3 className="font-bold text-sm uppercase tracking-wider group-hover:text-amber-400 transition-colors">
            Músicas Disponíveis
            {selectedArtist
              ? ` • ${selectedArtist.name}`
              : selectedCategory
              ? ` • ${selectedCategory.name}`
              : ' • Todas'}
          </h3>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-white/5 group-hover:bg-white/10 opacity-70 group-hover:opacity-100 transition-all">
            ⤢ Abrir Tela
          </span>
        </div>

        {/* Selo Patrocinador Limpo no Header de Músicas */}
        {activeAd && activeAd.url_midia && (
          <div className="hidden xl:flex items-center shrink-0">
            <div className="relative group rounded-xl overflow-hidden border border-white/15 h-8 w-20 shadow select-none">
              <img
                src={activeAd.url_midia}
                alt="Patrocínio"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                <span className="px-1.5 py-0.5 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 text-[8px] font-mono text-white/95">
                  Patrocínio
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="p-1 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10 flex items-center gap-0.5"
                title="Página anterior [-]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono">[-]</span>
              </button>
              <span className="text-[11px] font-mono px-1 opacity-70">
                {currentPage + 1}/{totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10 flex items-center gap-0.5"
                title="Próxima página [+]"
              >
                <span className="text-[10px] font-mono">[+]</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <span className="text-xs font-mono opacity-70">
            {filteredTracks.length} faixas
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
            <Coins className="w-3 h-3" />
            {availableCredits} crédito(s)
          </span>
        </div>
      </div>

      {/* Playlist Builder Banner when user has selected tracks */}
      {userPlaylist.length > 0 && (
        <div
          className={`shrink-0 mb-2 p-2.5 rounded-xl border flex items-center justify-between gap-2 animate-fadeIn ${
            isVintage
              ? 'bg-amber-950/70 border-amber-500/60 text-amber-100'
              : 'bg-cyan-950/70 border-cyan-500/60 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500 flex items-center justify-center shrink-0">
              <ListPlus className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span>Playlist Selecionada:</span>
                <span className="font-mono text-emerald-400">{userPlaylist.length} faixa(s)</span>
              </div>
              <div className="text-[11px] font-mono opacity-80 flex items-center gap-2">
                <span>Custo: <strong className="text-emerald-300">{totalPlaylistCost} créditos</strong></span>
                <span>•</span>
                <span>Saldo: <strong>{availableCredits} créditos</strong></span>
                {totalPlaylistCost > availableCredits && (
                  <span className="text-rose-400 font-bold">(Faltam {totalPlaylistCost - availableCredits} cr)</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={clearUserPlaylist}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
              title="Limpar seleção"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {availableCredits >= totalPlaylistCost ? (
              <button
                onClick={commitUserPlaylist}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all ${
                  isVintage
                    ? 'bg-amber-500 text-black font-extrabold hover:bg-amber-400'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-extrabold neon-glow-cyan'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Tocar Playlist [Enter]</span>
              </button>
            ) : (
              <button
                onClick={() => setPixModalOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-1.5 shadow-md animate-pulse"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Recarregar Pix [Enter]</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Touch-Friendly Track Table with internal scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr
              className={`border-b text-[10px] font-mono uppercase tracking-wider ${
                isVintage ? 'border-[#2d313c] text-amber-500/70' : 'border-cyan-950 text-cyan-500/80'
              }`}
            >
              <th className="py-1 px-2.5 w-16">Cód</th>
              <th className="py-1 px-2.5">Título & Artista</th>
              <th className="py-1 px-2 text-center hidden sm:table-cell">Gênero</th>
              <th className="py-1 px-2 text-center">Duração</th>
              <th className="py-1 px-2 text-center">Valor</th>
              <th className="py-1 px-2.5 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visibleTracks.map((track, rowIdx) => {
              const isCurrent = currentTrack?.id === track.id;
              const isInPlaylist = userPlaylist.some(t => t.id === track.id);
              const keyNum = rowIdx + 1;

              return (
                <tr
                  key={track.id}
                  className={`transition-colors duration-150 ${
                    isInPlaylist
                      ? isVintage
                        ? 'bg-amber-950/60 text-amber-200'
                        : 'bg-cyan-950/70 text-cyan-200'
                      : isCurrent
                      ? isVintage
                        ? 'bg-amber-950/40 text-amber-200 font-semibold'
                        : 'bg-cyan-950/50 text-cyan-200 font-semibold'
                      : 'hover:bg-white/[0.03]'
                  }`}
                >
                  {/* Code with * prefix */}
                  <td className="py-1 px-2">
                    <span
                      className={`inline-flex items-center justify-center w-3.5 h-3.5 mr-1 rounded-full font-mono font-extrabold text-[8px] border ${
                        isVintage
                          ? 'bg-[#121418] text-amber-300 border-amber-600/70'
                          : 'bg-slate-950 text-cyan-300 border-cyan-500/70'
                      }`}
                      title={`Aperte ${keyNum} no teclado numérico`}
                    >
                      {keyNum}
                    </span>
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded font-mono font-extrabold text-[10.5px] tracking-wider border shadow-sm ${
                        isInPlaylist
                          ? 'bg-emerald-500 text-black border-emerald-300'
                          : isCurrent
                          ? isVintage
                            ? 'bg-amber-600 text-zinc-950 border-amber-400'
                            : 'bg-cyan-400 text-slate-950 border-cyan-300'
                          : isVintage
                          ? 'bg-[#121418] text-amber-400 border border-[#2b2f38]'
                          : 'bg-slate-900 text-cyan-400 border border-cyan-900/60'
                      }`}
                      title={`Digite *${track.code} no teclado numérico para tocar`}
                    >
                      *{track.code}
                    </span>
                  </td>

                  {/* Title & Artist */}
                  <td className="py-1 px-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={track.albumArt}
                        alt={track.title}
                        className="w-6 h-6 rounded-md object-cover shrink-0"
                        crossOrigin="anonymous"
                      />
                      <div className="min-w-0">
                        <p className="font-bold truncate max-w-[170px] sm:max-w-xs flex items-center gap-1 leading-tight text-xs">
                          <span>{track.title}</span>
                          {isInPlaylist && (
                            <CheckCircle className="w-3 h-3 text-emerald-400 inline shrink-0" />
                          )}
                        </p>
                        <p className="text-[9.5px] opacity-70 truncate leading-tight">{track.artist}</p>
                      </div>
                    </div>
                  </td>

                  {/* Genre */}
                  <td className="py-1 px-1.5 text-center hidden sm:table-cell font-mono text-[9.5px] uppercase opacity-75">
                    {track.category}
                  </td>

                  {/* Duration */}
                  <td className="py-1 px-1.5 text-center font-mono text-[10px] opacity-80">
                    {formatDuration(track.duration)}
                  </td>

                  {/* Cost */}
                  <td className="py-1 px-1.5 text-center">
                    <span className="inline-flex items-center gap-0.5 text-[9.5px] font-mono font-bold text-emerald-400">
                      <Coins className="w-2.5 h-2.5" />
                      {track.cost} {track.cost === 1 ? 'cr' : 'crs'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-1 px-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      {/* Add to Multi-Select Playlist */}
                      <button
                        onClick={() => {
                          if (isInPlaylist) {
                            removeFromUserPlaylist(track.id);
                          } else {
                            addToUserPlaylist(track);
                          }
                        }}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all active:scale-95 flex items-center gap-1 ${
                          isInPlaylist
                            ? 'bg-emerald-600 text-white font-extrabold shadow'
                            : isVintage
                            ? 'bg-[#20242b] border border-amber-600/40 text-amber-300 hover:bg-amber-950/40'
                            : 'bg-slate-900 border border-cyan-800/80 text-cyan-300 hover:bg-cyan-950'
                        }`}
                        title={isInPlaylist ? "Remover da sua playlist" : "Adicionar à sua playlist"}
                      >
                        {isInPlaylist ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-white" />
                            <span className="hidden xl:inline">Salvo</span>
                          </>
                        ) : (
                          <>
                            <ListPlus className="w-3 h-3" />
                            <span className="hidden xl:inline">+Lista</span>
                          </>
                        )}
                      </button>

                      {/* Play Immediately */}
                      <button
                        onClick={() => {
                          if (availableCredits >= track.cost) {
                            playTrack(track);
                          } else {
                            setPixModalOpen(true);
                          }
                        }}
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-all active:scale-95 shadow ${
                          isVintage
                            ? 'bg-amber-500 text-black hover:bg-amber-400'
                            : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                        }`}
                        title="Tocar Agora"
                      >
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
