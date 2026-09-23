import { useEffect, useState } from 'react';

import { useJukeboxStore } from '../store/useJukeboxStore';
import { Advertisement } from '../types';

interface AdBannerProps {
  slot: 'now_playing_card' | 'catalog_banner' | 'top_bar' | 'idle_screensaver';
  className?: string;
  onAdClick?: (ad: Advertisement) => void;
}

export const AdBanner = ({ slot, className = '', onAdClick }: AdBannerProps) => {
  const ads = useJukeboxStore((s) => s.ads);
  const theme = useJukeboxStore((s) => s.theme);
  const isVintage = theme === 'amp-vintage';

  // 1. Filtra anúncios com a tag exata do slot, 'todos', 'all' ou sem restrição
  let slotAds = ads.filter((ad) => {
    const slotTarget = (ad.localizacao_slot || ad.posicao || '').toLowerCase().trim();
    const matchesSlot =
      slotTarget === slot.toLowerCase() ||
      slotTarget === 'todos' ||
      slotTarget === 'todas' ||
      slotTarget === 'all' ||
      slotTarget === '';
    const isAvailable = !ad.status || ad.status === 'ativo';
    const hasContent = Boolean(ad.url_midia || ad.conteudo_html);
    return matchesSlot && isAvailable && hasContent;
  });

  // 2. Se não houver anúncio especificamente vinculado a este slot,
  // faz fallback para qualquer anúncio ativo com imagem/mídia cadastrado na nuvem
  if (slotAds.length === 0) {
    slotAds = ads.filter((ad) => {
      const isAvailable = !ad.status || ad.status === 'ativo';
      const hasContent = Boolean(ad.url_midia || ad.conteudo_html);
      return isAvailable && hasContent;
    });
  }

  const [currentIndex, setCurrentIndex] = useState(0);

  // Rotação automática baseada no tempo de exibição do anúncio (padrão 10s)
  useEffect(() => {
    if (slotAds.length <= 1) return;
    const currentAd = slotAds[currentIndex];
    const duration =
      (currentAd?.tempo_exibicao_segundos || currentAd?.duracao_segundos || 10) * 1000;

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % slotAds.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [currentIndex, slotAds]);

  if (slotAds.length === 0) {
    return null;
  }

  const activeAd = slotAds[currentIndex] || slotAds[0];

  // Renderização específica para cada slot
  if (slot === 'now_playing_card') {
    return (
      <div
        className={`relative w-full rounded-2xl overflow-hidden border transition-all duration-300 shadow-xl flex flex-col items-center justify-center select-none group cursor-pointer ${
          isVintage
            ? 'bg-[#14161a] border-amber-500/30 hover:border-amber-400/60 shadow-amber-950/20'
            : 'bg-[#0a0f1d] border-cyan-500/30 hover:border-cyan-400/60 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
        } ${className}`}
        style={{ minHeight: '120px', maxHeight: '155px', height: '100%' }}
      >
        {/* Ad Media (Imagem, GIF ou Vídeo 100% Limpo) */}
        {activeAd.tipo === 'video' ? (
          <video
            src={activeAd.url_midia}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : activeAd.url_midia ? (
          <img
            src={activeAd.url_midia}
            alt={activeAd.titulo}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : activeAd.conteudo_html ? (
          <div
            className="absolute inset-0 w-full h-full overflow-hidden p-4"
            dangerouslySetInnerHTML={{ __html: activeAd.conteudo_html }}
          />
        ) : null}

        {/* Indicador sutil de Rotação (caso haja múltiplos anúncios) */}
        {slotAds.length > 1 && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full border border-white/10 text-[9px] font-mono text-zinc-300">
            <span>{currentIndex + 1}</span>
            <span className="opacity-50">/</span>
            <span>{slotAds.length}</span>
          </div>
        )}

        {/* Apenas ao passar o mouse por cima (hover): identificação discreta de Patrocínio */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
          <span className="px-3 py-1 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 text-xs font-mono font-medium text-white/95">
            Patrocínio
          </span>
        </div>
      </div>
    );
  }

  if (slot === 'catalog_banner') {
    if (!activeAd.url_midia) return null;
    return (
      <div
        className={`relative w-full rounded-2xl overflow-hidden border transition-all duration-200 shadow-lg select-none my-2 group ${
          isVintage
            ? 'border-amber-500/40 shadow-amber-950/20'
            : 'border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
        } ${className}`}
        style={{ minHeight: '74px', maxHeight: '86px' }}
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
    );
  }

  if (slot === 'top_bar') {
    return (
      <div
        className={`w-full py-1 px-3 text-xs font-mono font-semibold flex items-center justify-center gap-2 border-b select-none ${
          isVintage
            ? 'bg-amber-950/90 text-amber-300 border-amber-700/60'
            : 'bg-cyan-950/90 text-cyan-300 border-cyan-800/60 shadow-[0_2px_10px_rgba(6,182,212,0.2)]'
        } ${className}`}
      >
        <span className="truncate">
          {activeAd.titulo}
          {activeAd.descricao ? ` — ${activeAd.descricao}` : ''}
        </span>
      </div>
    );
  }

  return null;
};
