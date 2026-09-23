import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Play,
  Pause,
  Coins,
  ListPlus,
  CheckCircle,
  Trash2,
  Zap,
  ChevronLeft,
  ChevronRight,
  Disc3,
  Flame,
  Layers,
  Users,
  Compass
} from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';
import { Track } from '../types';

export const MusicBrowserModal = () => {
  const browserOpen = useJukeboxStore((s) => s.browserOpen);
  const browserMode = useJukeboxStore((s) => s.browserMode);
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
  const showKioskHud = useJukeboxStore((s) => s.showKioskHud);
  const ads = useJukeboxStore((s) => s.ads);

  const activeAd = ads.find(
    (a) => (!a.status || a.status === 'ativo') && Boolean(a.url_midia)
  );

  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [commaMode, setCommaMode] = useState<'select' | 'playpause'>('select');

  const isVintage = theme === 'amp-vintage';

  // Define lista conforme o modo de exibição
  let filtered: (Track & { rank?: number; plays?: number })[] = [];
  let title = 'Todas as Músicas';
  let subtitle = 'Catálogo Completo';
  let icon = <Disc3 className="w-5 h-5" />;

  if (browserMode === 'top15') {
    title = 'Top Sucessos da Jukebox';
    subtitle = 'Músicas Mais Tocadas (Ranking Geral)';
    icon = <Flame className="w-5 h-5 text-rose-400" />;
    filtered = tracks.map((t, idx) => ({
      ...t,
      rank: idx + 1,
      plays: Math.max(14, Math.floor(180 - idx * 7.5 + ((idx * 5) % 11)))
    }));
  } else if (browserMode === 'artist' && selectedArtist) {
    title = selectedArtist.name;
    subtitle = `Todas as faixas de ${selectedArtist.name}`;
    icon = <Users className="w-5 h-5 text-pink-400" />;
    filtered = tracks.filter((t) => t.artistId === selectedArtist.id);
  } else if (browserMode === 'category' && selectedCategory) {
    title = selectedCategory.name;
    subtitle = `Gênero Musical • ${selectedCategory.description || selectedCategory.name}`;
    icon = <Layers className="w-5 h-5 text-amber-400" />;
    filtered = tracks.filter((t) => t.category === selectedCategory.id);
  } else {
    title = 'Catálogo Geral de Músicas';
    subtitle = `${tracks.length} faixas disponíveis`;
    icon = <Compass className="w-5 h-5 text-cyan-400" />;
    filtered = tracks;
  }

  // Quantidade que preenche a tela confortavelmente em grid (18 faixas: 3 colunas x 6 linhas)
  const DYNAMIC_PAGE_SIZE = 18;
  const totalPages = Math.max(1, Math.ceil(filtered.length / DYNAMIC_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(
    currentPage * DYNAMIC_PAGE_SIZE,
    (currentPage + 1) * DYNAMIC_PAGE_SIZE
  );

  const playlistCost = userPlaylist.reduce((acc, t) => acc + t.cost, 0);
  const availableCredits = currentUser ? currentUser.credits : credits;
  const balanceLabel = currentUser ? `Saldo (${currentUser.name})` : 'Saldo';

  // Reseta foco ao mudar de página
  useEffect(() => {
    setFocusedIndex(0);
  }, [currentPage, browserMode]);

  // NAVEGAÇÃO 100% VIA TECLADO NUMÉRICO DE 17 TECLAS (Com suporte a Touch/Mouse)
  useEffect(() => {
    if (!browserOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Se PixModal estiver aberto ou evento cancelado, não processa
      if (e.defaultPrevented || useJukeboxStore.getState().isPixModalOpen) return;

      const key = e.key;

      // 1. ESC / BACKSPACE
      if (key === 'Escape') {
        e.preventDefault();
        closeBrowser();
        return;
      }

      // 2. TECLA '-' (Menos): Volta página ou atua como Esc/Voltar se na página 1
      if (key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        if (currentPage > 0) {
          setPage(currentPage - 1);
          showKioskHud(`Página ${currentPage}/${totalPages}`, '[+] / [-] para paginar', 'info', 1500);
        } else {
          closeBrowser();
          showKioskHud('Voltar ao Totem', '[-]/Esc pressionado', 'info', 1500);
        }
        return;
      }

      // 3. TECLA '+' (Mais): Avança próxima página
      if (key === '+' || e.code === 'NumpadAdd') {
        e.preventDefault();
        if (currentPage < totalPages - 1) {
          setPage(currentPage + 1);
          showKioskHud(`Página ${currentPage + 2}/${totalPages}`, '[+] / [-] para paginar', 'info', 1500);
        }
        return;
      }

      // 4. VÍRGULA / PONTO (, / .): Alterna modo de Enter (Seleção vs Play/Pause)
      if (key === ',' || key === '.' || e.code === 'NumpadDecimal') {
        e.preventDefault();
        const nextMode = commaMode === 'select' ? 'playpause' : 'select';
        setCommaMode(nextMode);
        showKioskHud(
          nextMode === 'playpause' ? 'Modo [,] Play/Pause' : 'Modo [,] Seleção',
          nextMode === 'playpause' ? 'Aperte ENTER para Play/Pause' : 'Aperte ENTER para selecionar música',
          'info',
          2500
        );
        return;
      }

      // 5. TECLA '0': Play / Pause direto da música tocando
      if (key === '0') {
        e.preventDefault();
        if (isPlaying) {
          pauseTrack();
          showKioskHud('Pausado', '[0] Play/Pause', 'info', 1500);
        } else {
          resumeTrack();
          showKioskHud('Tocando', '[0] Play/Pause', 'success', 1500);
        }
        return;
      }

      // 6. NAVEGAÇÃO DIRECIONAL (Cursor tipo mouse no teclado numérico):
      // 8 = Cima (▲), 2 = Baixo (▼), 4 = Esquerda (◄), 6 = Direita (►)
      const cols = window.innerWidth >= 1280 ? 3 : window.innerWidth >= 640 ? 2 : 1;

      if (key === '8') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(0, prev - cols));
        return;
      }

      if (key === '2') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(visible.length - 1, prev + cols));
        return;
      }

      if (key === '4') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      if (key === '6') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(visible.length - 1, prev + 1));
        return;
      }

      // 7. CONFIRMAÇÃO: ENTER ou tecla 5 (centro do direcional)
      if (key === 'Enter' || e.code === 'NumpadEnter' || key === '5') {
        e.preventDefault();

        // Se vírgula ativou modo Play/Pause e foi Enter
        if (key !== '5' && commaMode === 'playpause') {
          if (isPlaying) pauseTrack();
          else resumeTrack();
          return;
        }

        const focusedTrack = visible[focusedIndex];
        if (focusedTrack) {
          const inPlaylist = userPlaylist.some((t) => t.id === focusedTrack.id);
          if (inPlaylist) {
            removeFromUserPlaylist(focusedTrack.id);
            showKioskHud(`Removida: ${focusedTrack.title}`, 'Fora da playlist', 'info', 1800);
          } else {
            addToUserPlaylist(focusedTrack);
            showKioskHud(
              `Selecionada: ${focusedTrack.title}`,
              `${focusedTrack.artist} • *${focusedTrack.code}`,
              'success',
              2200
            );
          }
        }
        return;
      }

      // 8. TECLAS 1, 3, 7, 9 no Modo Cursor:
      // 1 = Desativar Telão, 3 = Ativar Telão, 7 = Página Anterior, 9 = Próxima Página
      if (key === '1') {
        e.preventDefault();
        useJukeboxStore.getState().setSecondaryScreenOpen(false);
        showKioskHud('Telão do Bar (TV 2)', 'Telão Desativado [Tecla 1]', 'info', 2000);
        return;
      }

      if (key === '3') {
        e.preventDefault();
        useJukeboxStore.getState().setSecondaryScreenOpen(true);
        showKioskHud('Telão do Bar (TV 2)', 'Telão Ativado [Tecla 3]', 'success', 2000);
        return;
      }

      if (key === '7') {
        e.preventDefault();
        if (currentPage > 0) {
          setPage(currentPage - 1);
          showKioskHud(`Página ${currentPage}/${totalPages}`, '[7] Página Anterior', 'info', 1500);
        }
        return;
      }

      if (key === '9') {
        e.preventDefault();
        if (currentPage < totalPages - 1) {
          setPage(currentPage + 1);
          showKioskHud(`Página ${currentPage + 2}/${totalPages}`, '[9] Próxima Página', 'info', 1500);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    browserOpen,
    visible,
    focusedIndex,
    commaMode,
    isPlaying,
    currentPage,
    totalPages,
    userPlaylist,
    closeBrowser,
    setPage,
    addToUserPlaylist,
    removeFromUserPlaylist,
    pauseTrack,
    resumeTrack,
    showKioskHud
  ]);

  if (!browserOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className={`fixed inset-0 z-50 flex flex-col ${
          isVintage ? 'bg-[#0e1014] text-amber-100' : 'bg-[#04060d] text-slate-100'
        } select-none`}
      >
        {/* Top Header */}
        <div
          className={`shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b ${
            isVintage ? 'border-[#2d323e]' : 'border-cyan-900/60'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow ${
                isVintage
                  ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                  : 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              }`}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-base sm:text-xl uppercase tracking-wide truncate">
                {title}
              </h2>
              <p className="text-[11px] font-mono opacity-70 truncate">
                {subtitle} • {filtered.length} faixa(s) disponível(is)
              </p>
            </div>
          </div>

          {/* Sponsor Header Limpo com Imagem Real no Topo */}
          {activeAd && activeAd.url_midia && (
            <div className="hidden md:flex items-center shrink-0">
              <div className="relative group rounded-xl overflow-hidden border border-white/15 h-9 w-24 shadow select-none">
                <img
                  src={activeAd.url_midia}
                  alt="Patrocínio"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                  <span className="px-1.5 py-0.5 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 text-[9px] font-mono text-white/95">
                    Patrocínio
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {/* Controles de Paginação (+ e -) */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/5 border border-white/10">
                <button
                  onClick={() => setPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="p-1 rounded-lg bg-white/10 disabled:opacity-30 hover:bg-white/20 active:scale-95 transition-all text-xs font-mono font-bold flex items-center gap-1"
                  title="Página anterior [-]"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">[-]</span>
                </button>
                <span className="text-xs font-mono px-1 font-bold">
                  {currentPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1 rounded-lg bg-white/10 disabled:opacity-30 hover:bg-white/20 active:scale-95 transition-all text-xs font-mono font-bold flex items-center gap-1"
                  title="Próxima página [+]"
                >
                  <span className="hidden sm:inline">[+]</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={closeBrowser}
              className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-mono text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
              title="Voltar / Fechar [Esc] ou [-]"
            >
              <X className="w-4 h-4" />
              <span>Voltar [-]</span>
            </button>
          </div>
        </div>

        {/* Barra de Ajuda do Teclado Numérico de 17 Teclas */}
        <div
          className={`shrink-0 px-4 py-1.5 border-b flex flex-wrap items-center justify-between text-[11px] font-mono gap-1 ${
            isVintage ? 'bg-[#14171d] border-[#292e3a]' : 'bg-[#090e1c] border-cyan-950/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-amber-400 font-bold">Teclado 17 Teclas:</span>
            <span className="opacity-80">
              <strong className="text-cyan-300">[8 ▲] [2 ▼] [4 ◄] [6 ►]</strong> Navega
            </span>
            <span className="opacity-80">
              <strong className="text-emerald-300">[5 / Enter]</strong> Escolhe/Toca
            </span>
            <span className="opacity-80">
              <strong className="text-amber-300">[+] [-]</strong> Pág/Voltar
            </span>
            <span className="opacity-80">
              <strong className="text-pink-300">[,]</strong> Alterna Modo ({commaMode === 'select' ? 'Seleção' : 'Play/Pause'})
            </span>
            <span className="opacity-80">
              <strong className="text-white">[0]</strong> Play/Pause
            </span>
          </div>
          <span className="opacity-60 hidden md:inline">Toque na tela ou clique com mouse também funciona</span>
        </div>

        {/* Grid de Faixas (Ocupa a tela inteira e preenche dinamicamente) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {visible.map((track, idx) => {
              const keyNum = idx + 1;
              const inPlaylist = userPlaylist.some((t) => t.id === track.id);
              const isCurrent = currentTrack?.id === track.id;
              const isFocused = idx === focusedIndex;

              return (
                <button
                  key={track.id}
                  onClick={() => {
                    setFocusedIndex(idx);
                    if (inPlaylist) removeFromUserPlaylist(track.id);
                    else addToUserPlaylist(track);
                  }}
                  className={`text-left flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.99] relative ${
                    isFocused
                      ? isVintage
                        ? 'bg-amber-950/80 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-2 ring-amber-400'
                        : 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)] ring-2 ring-cyan-400'
                      : inPlaylist
                      ? isVintage
                        ? 'bg-amber-950/50 border-amber-500/70'
                        : 'bg-cyan-950/50 border-cyan-400/70'
                      : isCurrent
                      ? isVintage
                        ? 'bg-amber-950/30 border-amber-700/60'
                        : 'bg-cyan-950/30 border-cyan-700/60'
                      : isVintage
                      ? 'bg-[#15181f] border-[#2c313c] hover:border-amber-600/60'
                      : 'bg-[#080d1a] border-cyan-950 hover:border-cyan-600/60'
                  }`}
                >
                  {/* Demarcação Numérica Clara para Teclado e Foco */}
                  <span
                    className={`shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-mono font-extrabold text-sm sm:text-base border ${
                      isFocused
                        ? 'bg-white text-black border-white ring-2 ring-cyan-400 font-black'
                        : inPlaylist
                        ? 'bg-emerald-500 text-black border-emerald-300'
                        : isVintage
                        ? 'bg-[#121418] text-amber-300 border-amber-600/70'
                        : 'bg-slate-950 text-cyan-300 border-cyan-500/70'
                    }`}
                  >
                    {keyNum <= 9 ? `[${keyNum}]` : keyNum}
                  </span>

                  {/* Capa */}
                  <img
                    src={track.albumArt}
                    alt={track.title}
                    className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover shadow"
                    crossOrigin="anonymous"
                  />

                  {/* Dados da Faixa */}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs sm:text-sm truncate flex items-center gap-1.5">
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
                      {track.rank && (
                        <span className="inline-flex items-center gap-0.5 text-rose-400 font-bold">
                          <Flame className="w-3 h-3 fill-current" />
                          #{track.rank} ({track.plays}x)
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 p-2 rounded-xl ${
                      inPlaylist
                        ? 'bg-emerald-600 text-white'
                        : isFocused
                        ? isVintage
                          ? 'bg-amber-500 text-black'
                          : 'bg-cyan-400 text-slate-950'
                        : isVintage
                        ? 'bg-[#1f2229] text-amber-300'
                        : 'bg-slate-900 text-cyan-300'
                    }`}
                  >
                    <ListPlus className="w-4 h-4" />
                  </span>
                </button>
              );
            })}

            {/* Card Limpo de Patrocínio no Grid de Músicas / Categorias */}
            {activeAd && activeAd.url_midia && (
              <div
                className={`col-span-full h-20 sm:h-24 rounded-2xl border overflow-hidden relative group select-none shadow-md ${
                  isVintage ? 'border-amber-500/30' : 'border-cyan-500/30'
                }`}
              >
                <img
                  src={activeAd.url_midia}
                  alt="Patrocínio"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                  <span className="px-3 py-1 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 text-xs font-mono font-medium text-white/95">
                    Patrocínio
                  </span>
                </div>
              </div>
            )}
          </div>

          {visible.length === 0 && (
            <div className="text-center opacity-60 font-mono text-sm py-16">
              Nenhuma música encontrada nesta seleção.
            </div>
          )}
        </div>

        {/* Footer: Resumo da Seleção / Playlist + Playback */}
        <div
          className={`shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t ${
            isVintage ? 'border-[#2d323e]' : 'border-cyan-900/60'
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
                  Custo: <strong className="text-emerald-400">{playlistCost} créd</strong> •{' '}
                  {balanceLabel}: <strong>{availableCredits} créd</strong>
                  {playlistCost > availableCredits && (
                    <span className="text-rose-400 font-bold">
                      {' '}
                      (faltam {playlistCost - availableCredits})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {userPlaylist.length > 0 && (
              <button
                onClick={clearUserPlaylist}
                className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                title="Limpar seleção"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => (isPlaying ? pauseTrack() : resumeTrack())}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all active:scale-95 flex items-center gap-1.5 ${
                isVintage
                  ? 'bg-[#20242b] border-amber-600/50 text-amber-300'
                  : 'bg-slate-900 border-cyan-800/80 text-cyan-300'
              }`}
              title="Play / Pause [0]"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlaying ? 'Pausar [0]' : 'Tocar [0]'}</span>
            </button>

            {userPlaylist.length > 0 && availableCredits >= playlistCost ? (
              <button
                onClick={commitUserPlaylist}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md active:scale-95 transition-all ${
                  isVintage
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950'
                }`}
                title="Tocar playlist [Enter]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Tocar Playlist [Enter]</span>
              </button>
            ) : userPlaylist.length > 0 ? (
              <button
                onClick={() => setPixModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-2 shadow-md animate-pulse active:scale-95 transition-all"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Recarregar Pix [Enter]</span>
              </button>
            ) : (
              <span className="text-xs font-mono opacity-60 px-2 hidden sm:inline">
                Navegue com [8 2 4 6] e aperte [Enter]
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
