import { useEffect, useState, useRef } from 'react';
import { Sparkles, Disc, Clock, Music } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';

export const Screensaver = () => {
  const screensaverConfig = useJukeboxStore((s) => s.screensaverConfig);
  const ads = useJukeboxStore((s) => s.ads);
  const currentTrack = useJukeboxStore((s) => s.currentTrack);
  const isPlaying = useJukeboxStore((s) => s.isPlaying);
  const theme = useJukeboxStore((s) => s.theme);
  const isVintage = theme === 'amp-vintage';

  const [isActive, setIsActive] = useState(false);
  const [clockStr, setClockStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  const timeoutMinutes = screensaverConfig?.tempo_inatividade_minutos || 3;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  const timerRef = useRef<number | null>(null);

  // Filtra anúncios do slot idle_screensaver, todos ou fallback geral
  const specificScreensaverAds = ads.filter(
    (a) =>
      (!a.status || a.status === 'ativo') &&
      Boolean(a.url_midia) &&
      (a.localizacao_slot === 'idle_screensaver' ||
        a.posicao === 'idle_screensaver' ||
        a.localizacao_slot === 'todos' ||
        a.posicao === 'todos' ||
        a.localizacao_slot === 'all' ||
        a.posicao === 'all')
  );

  const screensaverAds =
    specificScreensaverAds.length > 0
      ? specificScreensaverAds
      : ads.filter((a) => (!a.status || a.status === 'ativo') && Boolean(a.url_midia));

  // Reset do timer de inatividade em qualquer interação
  const resetTimer = () => {
    if (isActive) {
      setIsActive(false);
    }
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setIsActive(true);
    }, timeoutMs);
  };

  useEffect(() => {
    const handleUserActivity = () => {
      resetTimer();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('mousedown', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    resetTimer();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('mousedown', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
    };
  }, [isActive, timeoutMs]);

  // Atualização de relógio e data
  useEffect(() => {
    if (!isActive) return;
    const update = () => {
      const now = new Date();
      setClockStr(
        now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setDateStr(
        now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      );
    };
    update();
    const iv = window.setInterval(update, 1000);
    return () => window.clearInterval(iv);
  }, [isActive]);

  // Rotação de anúncios em tela cheia durante o screensaver
  useEffect(() => {
    if (!isActive || screensaverAds.length <= 1) return;
    const ad = screensaverAds[currentAdIndex];
    const duration = (ad?.tempo_exibicao_segundos || 10) * 1000;
    const t = window.setTimeout(() => {
      setCurrentAdIndex((prev) => (prev + 1) % screensaverAds.length);
    }, duration);
    return () => window.clearTimeout(t);
  }, [isActive, currentAdIndex, screensaverAds]);

  if (!isActive) return null;

  const currentAd = screensaverAds[currentAdIndex];

  return (
    <div
      onClick={() => setIsActive(false)}
      className="fixed inset-0 z-[9999] bg-black text-white flex flex-col justify-between p-8 select-none cursor-pointer overflow-hidden animate-fade-in"
    >
      {/* Background Media se houver anúncio */}
      {currentAd && currentAd.url_midia && (
        <div className="absolute inset-0 z-0">
          <img
            src={currentAd.url_midia}
            alt={currentAd.titulo}
            className="w-full h-full object-cover opacity-35 filter blur-sm scale-105 transition-all duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/80" />
        </div>
      )}

      {/* Top Header com Relógio e Logo Máximo */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Disc className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h1 className="font-tech text-2xl font-black tracking-widest text-amber-300">
              MAXMUSICBOX
            </h1>
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Jukebox Digital • Rede Máximo em Soluções
            </p>
          </div>
        </div>

        <div className="text-right font-mono">
          <div className="text-3xl sm:text-4xl font-black text-white tracking-widest">{clockStr}</div>
          <div className="text-xs text-amber-400 capitalize">{dateStr}</div>
        </div>
      </div>

      {/* Centro: Anúncio Comercial ou Visualizador Winamp */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-6">
        {currentAd ? (
          <div className="max-w-4xl w-full rounded-3xl overflow-hidden border-2 border-amber-500/40 bg-black/80 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col items-center p-6 text-center">
            <div className="mb-2 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest uppercase bg-amber-500/20 border border-amber-500/50 text-amber-300">
              PATROCÍNIO OFICIAL • ESPAÇO PUBLICITÁRIO
            </div>
            {currentAd.url_midia && (
              <img
                src={currentAd.url_midia}
                alt={currentAd.titulo}
                className="max-h-72 sm:max-h-96 rounded-2xl object-contain my-3 shadow-2xl"
              />
            )}
            <h2 className="font-tech text-3xl sm:text-4xl font-black text-white mt-2">
              {currentAd.titulo}
            </h2>
            {currentAd.descricao && (
              <p className="text-sm text-zinc-300 max-w-xl mt-1">{currentAd.descricao}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            {/* Visualizador estilo Winamp */}
            <div className="flex items-end gap-1.5 h-32 my-6">
              {Array.from({ length: 28 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 rounded-t-sm bg-gradient-to-t from-amber-600 via-amber-400 to-yellow-200 animate-pulse"
                  style={{
                    height: `${Math.max(15, ((Math.sin(i + Date.now() / 1000) + 1) / 2) * 100)}%`,
                    animationDuration: `${0.4 + (i % 5) * 0.15}s`
                  }}
                />
              ))}
            </div>
            <p className="font-tech text-2xl tracking-widest text-amber-400">DESCANSO DE TELA ATIVO</p>
          </div>
        )}
      </div>

      {/* Rodapé: Track atual (se houver) e mensagem para tocar */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4">
        {currentTrack ? (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/20">
              <img src={currentTrack.albumArt} alt={currentTrack.title} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-xs uppercase font-mono font-bold text-amber-400">
                {isPlaying ? 'TOCANDO AGORA' : 'PAUSADO'}
              </p>
              <h4 className="text-base font-bold text-white leading-tight">{currentTrack.title}</h4>
              <p className="text-xs text-zinc-400">{currentTrack.artist}</p>
            </div>
          </div>
        ) : (
          <div className="text-xs font-mono text-zinc-400">
            Nenhuma música na fila. Pressione qualquer tecla para escolher!
          </div>
        )}

        <div className="text-right">
          <span className="inline-block px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider animate-bounce">
            TOQUE NA TELA OU APERTE UMA TECLA PARA DESPERTAR
          </span>
        </div>
      </div>
    </div>
  );
};
