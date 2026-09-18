import { useEffect, useState } from 'react';
import { 
  Disc3, 
  Radio, 
  Tv2, 
  Sparkles, 
  Coins, 
  Volume2, 
  Maximize2, 
  Accessibility,
  UserRound
} from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';
import { VuMeter } from './VuMeter';

export const Header = () => {
  const theme = useJukeboxStore((s) => s.theme);
  const setTheme = useJukeboxStore((s) => s.setTheme);
  const credits = useJukeboxStore((s) => s.credits);
  const setPixModalOpen = useJukeboxStore((s) => s.setPixModalOpen);
  const setSecondaryScreenOpen = useJukeboxStore((s) => s.setSecondaryScreenOpen);
  const setAccessibilityKeypadOpen = useJukeboxStore((s) => s.setAccessibilityKeypadOpen);
  const currentUser = useJukeboxStore((s) => s.currentUser);
  const setUserLoginOpen = useJukeboxStore((s) => s.setUserLoginOpen);
  const logoutUser = useJukeboxStore((s) => s.logoutUser);

  const [timeString, setTimeString] = useState('');
  const [dateString, setDateString] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setDateString(
        now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
      );
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullScreen = () => {
    // WKWebView (Tauri no macOS) não implementa a Fullscreen API.
    const el = document.documentElement as HTMLElement & {
      requestFullscreen?: () => Promise<void>;
    };
    if (!el.requestFullscreen) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const isVintage = theme === 'amp-vintage';

  return (
    <header
      className={`w-full px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b transition-colors duration-200 select-none ${
        isVintage
          ? 'bg-[#1a1d22] border-[#2e333d] shadow-md text-amber-100'
          : 'bg-[#0b1120]/90 backdrop-blur-md border-cyan-900/50 shadow-[0_4px_20px_rgba(6,182,212,0.08)] text-slate-100'
      }`}
    >
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center justify-center w-11 h-11 rounded-xl transition-all ${
            isVintage
              ? 'vintage-neumorphic-btn text-amber-500 border border-amber-500/20'
              : 'bg-cyan-950/60 border border-cyan-400 text-cyan-400 neon-glow-cyan'
          }`}
        >
          {isVintage ? (
            <Radio className="w-6 h-6 text-amber-500" />
          ) : (
            <Disc3 className="w-6 h-6 text-cyan-400 animate-spin-slow" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <h1
              className={`text-xl font-extrabold tracking-wider ${
                isVintage
                  ? 'font-tech text-amber-400 tracking-widest'
                  : 'font-modern text-white tracking-wide text-glow-cyan'
              }`}
            >
              MAX<span className={isVintage ? 'text-amber-200' : 'text-cyan-400'}>MUSICBOX</span>
            </h1>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
                isVintage
                  ? 'bg-amber-950/70 text-amber-400 border border-amber-700/50'
                  : 'bg-cyan-950/80 text-cyan-300 border border-cyan-600/60 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
              }`}
            >
              KIOSK DIGITAL
            </span>
          </div>
          <p
            className={`text-xs ${
              isVintage ? 'text-amber-600/80 font-mono' : 'text-slate-400'
            }`}
          >
            Terminal MaxMusicBox • Teclado Numérico
          </p>
        </div>
      </div>

      {/* Center: Digital Clock & Dual Mini VU Meters */}
      <div className="flex items-center gap-4">
        {/* Dual Mini VUs (L & R) */}
        <div className="hidden sm:flex items-center gap-2">
          <VuMeter channel="left" label="VU L" size="mini" />
          <VuMeter channel="right" label="VU R" size="mini" />
        </div>

        {/* Digital Clock Display */}
        <div
          className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-lg border select-none ${
            isVintage
              ? 'bg-[#121418] border-[#2c3038] shadow-inner text-amber-400 font-vfd'
              : 'bg-[#060a12] border-cyan-900/80 text-cyan-400 font-vfd shadow-[inset_0_0_10px_rgba(6,182,212,0.15)]'
          }`}
        >
          <span className="text-lg font-bold tracking-widest leading-none">
            {timeString || '12:00:00'}
          </span>
          <span className="text-[10px] uppercase opacity-75 tracking-wider mt-0.5 font-mono">
            {dateString || 'QUI, 16 SET'}
          </span>
        </div>
      </div>

      {/* Right Controls: Credits, Theme Switcher, Screen 2, Rust Spec */}
      <div className="flex items-center gap-2">
        {/* Usuário logado / Acesso por senha */}
        {currentUser ? (
          <button
            onClick={logoutUser}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 ${
              isVintage
                ? 'bg-[#251a05] text-amber-300 border border-amber-600/70 shadow-md hover:bg-[#2f2108]'
                : 'bg-cyan-950/70 text-cyan-300 border border-cyan-700/70 shadow-[0_0_12px_rgba(6,182,212,0.2)] hover:bg-cyan-900/70'
            }`}
            title="Cliente logado — clique para sair"
          >
            <Coins className="w-4 h-4 text-emerald-400" />
            <span className="max-w-[140px] truncate">{currentUser.name}</span>
            <span className="px-1.5 py-0.2 rounded bg-black/40 text-[11px] font-mono font-extrabold border border-white/10 text-emerald-300">
              {currentUser.credits} cr
            </span>
          </button>
        ) : (
          <button
            onClick={() => setUserLoginOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 ${
              isVintage
                ? 'bg-[#1c2b21] text-emerald-300 border border-emerald-700/60 shadow-md hover:bg-[#223628]'
                : 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/60 hover:bg-emerald-600/30'
            }`}
            title="Entrar com a senha do usuário para usar o saldo da conta"
          >
            <UserRound className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Entrar</span>
          </button>
        )}

        {/* Credits Badge with Enter shortcut indicator */}
        <button
          onClick={() => setPixModalOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 ${
            isVintage
              ? 'bg-gradient-to-r from-emerald-800 to-emerald-700 text-emerald-100 border border-emerald-600 shadow-md hover:brightness-110'
              : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:bg-emerald-600/40'
          }`}
          title="Inserir créditos via Pix (Ou aperte ENTER no teclado)"
        >
          <Coins className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>
            {credits} {credits === 1 ? 'Crédito' : 'Créditos'}
          </span>
          <span className="px-1.5 py-0.2 rounded bg-black/40 text-[9px] font-mono font-extrabold border border-white/10 text-emerald-300">
            ENTER
          </span>
        </button>

        {/* Theme Switcher */}
        <div
          className={`flex p-0.5 rounded-lg border ${
            isVintage ? 'bg-[#121418] border-[#2b3039]' : 'bg-[#070c18] border-cyan-950'
          }`}
        >
          <button
            onClick={() => setTheme('neon-vinyl')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              theme === 'neon-vinyl'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.6)]'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Tema Neon Vinyl"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Neon</span>
          </button>
          <button
            onClick={() => setTheme('amp-vintage')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              theme === 'amp-vintage'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-[0_0_10px_rgba(245,158,11,0.6)]'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Tema Amp Vintage"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Vintage</span>
          </button>
        </div>

        {/* Accessibility Keypad Button */}
        <button
          onClick={() => setAccessibilityKeypadOpen(true)}
          className={`p-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 active:scale-95 ${
            isVintage
              ? 'vintage-neumorphic-btn text-amber-300 hover:text-white'
              : 'bg-slate-900 border-slate-700 text-amber-300 hover:text-amber-200 hover:border-amber-500/50 shadow-sm'
          }`}
          title="Abrir Teclado Numérico Virtual para Toque na Tela"
        >
          <Accessibility className="w-4 h-4 text-amber-400" />
          <span className="hidden md:inline text-xs font-mono font-bold">Acessibilidade</span>
        </button>

        {/* Monitor 2 Button */}
        <button
          onClick={() => setSecondaryScreenOpen(true)}
          className={`p-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
            isVintage
              ? 'vintage-neumorphic-btn text-amber-300 hover:text-white'
              : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-cyan-400 hover:border-cyan-700'
          }`}
          title="Abrir Tela Secundária (Monitor de Áudio 2 / Telão do Bar)"
        >
          <Tv2 className="w-4 h-4 text-cyan-400" />
          <span className="hidden lg:inline text-xs font-mono">Telão Bar</span>
        </button>

        {/* Fullscreen Kiosk Mode */}
        <button
          onClick={toggleFullScreen}
          className={`p-2 rounded-xl border transition-all ${
            isVintage
              ? 'vintage-neumorphic-btn text-zinc-400 hover:text-white'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Tela Cheia (Modo Quiosque)"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
