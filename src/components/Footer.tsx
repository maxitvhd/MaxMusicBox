import { Settings, Coins, Shield, HelpCircle } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';

export const Footer = () => {
  const theme = useJukeboxStore((s) => s.theme);
  const credits = useJukeboxStore((s) => s.credits);
  const setPixModalOpen = useJukeboxStore((s) => s.setPixModalOpen);
  const setAdminModalOpen = useJukeboxStore((s) => s.setAdminModalOpen);

  const isVintage = theme === 'amp-vintage';

  return (
    <footer
      className={`w-full px-6 py-3 border-t flex flex-wrap items-center justify-between gap-4 transition-colors duration-200 select-none ${
        isVintage
          ? 'bg-[#181a20] border-[#2e333e] text-amber-200'
          : 'bg-[#090e1a]/95 backdrop-blur-md border-cyan-900/40 text-slate-300'
      }`}
    >
      {/* Left: Discreet Admin Button & System Status */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setAdminModalOpen(true)}
          className={`p-2 rounded-xl border transition-all active:scale-95 flex items-center gap-2 group ${
            isVintage
              ? 'vintage-neumorphic-btn text-amber-400 hover:text-white'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-800'
          }`}
          title="Acesso Técnico / Painel Admin Rack Quasar"
        >
          <Settings className="w-4 h-4 group-hover:rotate-45 transition-transform" />
          <span className="text-xs font-mono font-bold tracking-wider">Rack Admin</span>
        </button>

        <div className="hidden md:flex items-center gap-2 text-xs font-mono opacity-60">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Áudio DSP Ativo (60 FPS)</span>
          <span>•</span>
          <span>SQLite Local Sincronizado</span>
        </div>
      </div>

      {/* Center: External Numpad Shortcut Legend */}
      <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono select-none">
        <span className="opacity-50 font-bold uppercase tracking-wider">Teclado Numérico:</span>
        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300">
          <strong className="text-amber-400">[/]</strong> Gênero
        </span>
        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300">
          <strong className="text-amber-400">[*]</strong> Tocar Direto
        </span>
        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300">
          <strong className="text-amber-400">[,]</strong> Seção
        </span>
        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300">
          <strong className="text-amber-400">[4862]</strong> Navegar
        </span>
        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300">
          <strong className="text-amber-400">[+] [-]</strong> Vol / Pág
        </span>
        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-300">
          <strong className="text-emerald-400">[Enter]</strong> PIX / OK
        </span>
      </div>

      {/* Right: Prominent "Inserir Créditos (Pix)" Button & Balance */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-bold font-mono">
            Saldo: <span className="text-emerald-400 font-extrabold">{credits} {credits === 1 ? 'música' : 'músicas'}</span>
          </div>
          <div className="text-[10px] opacity-60 font-mono">1 Crédito = 1 Faixa</div>
        </div>

        <button
          onClick={() => setPixModalOpen(true)}
          className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-extrabold uppercase tracking-wider text-xs sm:text-sm flex items-center gap-2 transition-all duration-150 active:scale-95 shadow-lg ${
            isVintage
              ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-emerald-100 border border-emerald-500'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 neon-glow-cyan'
          }`}
          title="Inserir créditos via PIX (ou aperte a tecla ENTER no teclado)"
        >
          <Coins className="w-4 h-4 animate-bounce fill-current" />
          <span>Inserir Pix</span>
          <span className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono font-black border border-white/20">
            ENTER
          </span>
        </button>
      </div>
    </footer>
  );
};
