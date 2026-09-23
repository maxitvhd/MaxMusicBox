import { useEffect, useState } from 'react';
import { useJukeboxStore } from './store/useJukeboxStore';
import { Header } from './components/Header';
import { NowPlaying } from './components/NowPlaying';
import { QueueList } from './components/QueueList';
import { CategoryCarousel } from './components/CategoryCarousel';
import { ArtistGrid } from './components/ArtistGrid';
import { TrackList } from './components/TrackList';
import { TopTracksList } from './components/TopTracksList';
import { Footer } from './components/Footer';
import { PixModal } from './components/PixModal';
import { UserLoginModal } from './components/UserLoginModal';
import { AdminRackModal } from './components/AdminRackModal';
import { SecondaryScreenModal } from './components/SecondaryScreenModal';
import { AccessibilityKeypadModal } from './components/AccessibilityKeypadModal';
import { MusicBrowserModal } from './components/MusicBrowserModal';
import { KioskKeyboardHud } from './components/KioskKeyboardHud';
import { AdBanner } from './components/AdBanner';
import { Screensaver } from './components/Screensaver';
import { useKioskKeyboardListener } from './hooks/useKioskKeyboardListener';
import { audioEngine } from './services/audioEngine';
import { tauriBridge } from './services/tauriBridge';
import { bootstrapNative } from './services/nativeSync';
import { Flame, ListMusic, Users } from 'lucide-react';

export default function App() {
  const theme = useJukeboxStore((s) => s.theme);
  const selectedCategory = useJukeboxStore((s) => s.selectedCategory);
  const selectedArtist = useJukeboxStore((s) => s.selectedArtist);
  const setSelectedCategory = useJukeboxStore((s) => s.setSelectedCategory);
  const setSelectedArtist = useJukeboxStore((s) => s.setSelectedArtist);
  const activeSection = useJukeboxStore((s) => s.activeSection);
  const setActiveSection = useJukeboxStore((s) => s.setActiveSection);

  const [centerTab, setCenterTab] = useState<'categories' | 'artists'>('categories');

  // Automatically switch tab if activeSection changes
  useEffect(() => {
    if (activeSection === 'categories') {
      setCenterTab('categories');
    } else if (activeSection === 'artists') {
      setCenterTab('artists');
    }
  }, [activeSection]);

  // Activate external numpad kiosk listeners
  useKioskKeyboardListener();

  const isVintage = theme === 'amp-vintage';

  // Conecta ao backend nativo (configurações + catálogo + eventos IPC)
  useEffect(() => {
    bootstrapNative();
  }, []);

  // Initialize WebAudio context on first touch/click (somente no navegador)
  useEffect(() => {
    if (tauriBridge.isNative) return;
    const handleFirstInteraction = () => {
      audioEngine.init();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('pointerdown', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col font-modern transition-colors duration-200 select-none ${
        isVintage
          ? 'bg-[#131519] text-amber-100 selection:bg-amber-500 selection:text-black'
          : 'bg-[#090d18] text-slate-100 selection:bg-cyan-500 selection:text-black'
      }`}
    >
      {/* Visual On-Screen HUD for Numpad inputs */}
      <KioskKeyboardHud />

      {/* Top Header - Fixed */}
      <Header />

      {/* Main Kiosk Container - Strictly No Page Scroll */}
      <div className="flex-1 min-h-0 flex w-full relative overflow-hidden">
        {/* Left Wood Accent for Vintage Amp */}
        {isVintage && (
          <div className="hidden 2xl:block w-5 shrink-0 wood-panel-left border-r border-[#201006]" />
        )}

        <main className="flex-1 min-h-0 w-full p-2 sm:p-3 flex flex-col gap-2 overflow-y-auto lg:overflow-hidden">
          {/* TOP SECTION: Now Playing (6-cols) & Queue List (6-cols em 2 blocos) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 shrink-0">
            <div className="lg:col-span-6 xl:col-span-6 h-[174px] sm:h-[180px] flex flex-col">
              <NowPlaying />
            </div>
            <div className="lg:col-span-6 xl:col-span-6 h-[174px] sm:h-[180px] flex flex-col overflow-hidden">
              <QueueList />
            </div>
          </div>

          {/* MIDDLE SECTION: Categories & Artists bar (compact, with keypad numbers) */}
          <div className="shrink-0 flex flex-col gap-1">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCenterTab('categories')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
                    centerTab === 'categories'
                      ? isVintage
                        ? 'bg-amber-500 text-black shadow'
                        : 'bg-cyan-500 text-slate-950 font-extrabold shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                      : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>Gêneros [/]</span>
                </button>

                <button
                  onClick={() => setCenterTab('artists')}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold uppercase transition-all flex items-center gap-1.5 ${
                    centerTab === 'artists'
                      ? isVintage
                        ? 'bg-amber-500 text-black shadow'
                        : 'bg-pink-500 text-white font-extrabold shadow-[0_0_10px_rgba(236,72,153,0.4)]'
                      : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Artistas [1-9]</span>
                </button>

                {(selectedCategory || selectedArtist) && (
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedArtist(null);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-800 hover:bg-rose-900"
                  >
                    ✕ Limpar Filtro [Esc]
                  </button>
                )}
              </div>

              <span className="hidden sm:inline text-[11px] font-mono opacity-50">
                Aperte <strong className="text-amber-400">/ + número</strong> para gênero ou <strong className="text-amber-400">* + código</strong> para tocar direto
              </span>
            </div>

            {centerTab === 'categories' ? (
              <div className="w-full">
                <CategoryCarousel />
              </div>
            ) : (
              <div className="w-full">
                <ArtistGrid />
              </div>
            )}
          </div>

          {/* BOTTOM SECTION: Split view of Track Catalog & Top 15 Jukebox Hits */}
          <div className="flex-1 min-h-[260px] grid grid-cols-1 lg:grid-cols-12 gap-2.5 overflow-hidden">
            {/* Track Catalog (7 cols on large screens) */}
            <div className="lg:col-span-7 h-full min-h-0 overflow-hidden flex flex-col">
              <TrackList />
            </div>

            {/* Top 15 Jukebox Hits (5 cols on large screens) */}
            <div className="lg:col-span-5 h-full min-h-0 overflow-hidden flex flex-col">
              <TopTracksList limit={15} />
            </div>
          </div>
        </main>

        {/* Right Wood Accent for Vintage Amp */}
        {isVintage && (
          <div className="hidden 2xl:block w-5 shrink-0 wood-panel-right border-l border-[#201006]" />
        )}
      </div>

      {/* Kiosk Bottom Footer - Fixed */}
      <Footer />

      {/* Modals & Screensaver */}
      <PixModal />
      <UserLoginModal />
      <AdminRackModal />
      <SecondaryScreenModal />
      <AccessibilityKeypadModal />
      <MusicBrowserModal />
      <Screensaver />
    </div>
  );
}
