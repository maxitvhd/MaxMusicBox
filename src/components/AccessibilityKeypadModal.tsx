import { X, Delete, Check, Hash, Accessibility, Volume2, Coins, FolderOpen } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';

export const AccessibilityKeypadModal = () => {
  const isAccessibilityKeypadOpen = useJukeboxStore((s) => s.isAccessibilityKeypadOpen);
  const setAccessibilityKeypadOpen = useJukeboxStore((s) => s.setAccessibilityKeypadOpen);
  const theme = useJukeboxStore((s) => s.theme);
  const keypadBuffer = useJukeboxStore((s) => s.keypadBuffer);
  const keypadFeedback = useJukeboxStore((s) => s.keypadFeedback);
  const handleKeypadDigit = useJukeboxStore((s) => s.handleKeypadDigit);
  const handleKeypadCorrect = useJukeboxStore((s) => s.handleKeypadCorrect);
  const handleKeypadConfirm = useJukeboxStore((s) => s.handleKeypadConfirm);
  const increaseVolume = useJukeboxStore((s) => s.increaseVolume);
  const decreaseVolume = useJukeboxStore((s) => s.decreaseVolume);
  const setPixModalOpen = useJukeboxStore((s) => s.setPixModalOpen);

  const isVintage = theme === 'amp-vintage';

  if (!isAccessibilityKeypadOpen) return null;

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'];

  const handleKeyClick = (key: string) => {
    if (key === 'CLR') {
      handleKeypadCorrect();
    } else if (key === 'OK') {
      handleKeypadConfirm();
    } else {
      handleKeypadDigit(key);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-sm rounded-3xl p-5 border transition-all duration-200 shadow-2xl flex flex-col ${
          isVintage
            ? 'bg-[#191b21] border-[#363c48] text-amber-100'
            : 'bg-[#0b1220]/95 border-cyan-800/80 shadow-[0_0_40px_rgba(6,182,212,0.25)] text-slate-100'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isVintage
                  ? 'bg-amber-950/80 text-amber-400 border border-amber-600/50'
                  : 'bg-cyan-950/80 text-cyan-400 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              }`}
            >
              <Accessibility className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wider font-modern">
                Teclado de Acessibilidade
              </h3>
              <p className="text-[10px] opacity-60 font-mono">
                Teclado numérico virtual para toque na tela
              </p>
            </div>
          </div>

          <button
            onClick={() => setAccessibilityKeypadOpen(false)}
            className="p-1.5 rounded-xl border border-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Fechar teclado virtual"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Digital Screen Display (VFD simulation) */}
        <div
          className={`w-full py-3 px-4 rounded-2xl border flex flex-col items-center justify-center mb-4 transition-all duration-200 ${
            keypadFeedback === 'success'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
              : keypadFeedback === 'error'
              ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)]'
              : isVintage
              ? 'bg-[#0f1114] border-[#2c3039] text-amber-400 shadow-inner'
              : 'bg-[#040810] border-cyan-900/80 text-cyan-400 shadow-[inset_0_0_12px_rgba(6,182,212,0.2)]'
          }`}
        >
          <span className="text-[10px] uppercase font-mono tracking-widest opacity-60">
            {keypadFeedback === 'success'
              ? '✓ MÚSICA ADICIONADA!'
              : keypadFeedback === 'error'
              ? '⚠ CÓDIGO INVÁLIDO'
              : 'CÓDIGO DA MÚSICA'}
          </span>
          <div className="text-3xl font-vfd font-bold tracking-widest mt-1">
            {keypadBuffer ? `*${keypadBuffer}` : <span className="opacity-30">*__</span>}
          </div>
        </div>

        {/* Tactile 3D Buttons Grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          {keys.map((key) => {
            const isCorrect = key === 'CLR';
            const isConfirm = key === 'OK';

            return (
              <button
                key={key}
                onClick={() => handleKeyClick(key)}
                className={`h-12 rounded-xl font-bold font-mono transition-all duration-75 flex items-center justify-center cursor-pointer select-none active:scale-95 ${
                  isConfirm
                    ? isVintage
                      ? 'bg-emerald-700 hover:bg-emerald-600 text-emerald-100 border border-emerald-500 shadow-md'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 neon-glow-cyan font-extrabold'
                    : isCorrect
                    ? isVintage
                      ? 'bg-rose-900 hover:bg-rose-800 text-rose-200 border border-rose-700'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                    : isVintage
                    ? 'bg-[#22262e] hover:bg-[#2a2f3a] text-amber-300 border border-[#3b414d] text-xl shadow'
                    : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-900/60 text-xl shadow'
                }`}
              >
                {isCorrect ? (
                  <div className="flex flex-col items-center text-[10px]">
                    <Delete className="w-4 h-4" />
                    <span>CORR</span>
                  </div>
                ) : isConfirm ? (
                  <div className="flex flex-col items-center text-[10px]">
                    <Check className="w-4 h-4" />
                    <span>CONF</span>
                  </div>
                ) : (
                  key
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Kiosk Actions: Volume & Pix */}
        <div className="pt-2 border-t border-white/5 grid grid-cols-3 gap-2">
          <button
            onClick={decreaseVolume}
            className="py-2 px-1 rounded-xl text-xs font-mono font-bold bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-1"
          >
            <span>- Vol</span>
          </button>
          <button
            onClick={increaseVolume}
            className="py-2 px-1 rounded-xl text-xs font-mono font-bold bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-1"
          >
            <span>+ Vol</span>
          </button>
          <button
            onClick={() => {
              setAccessibilityKeypadOpen(false);
              setPixModalOpen(true);
            }}
            className="py-2 px-1 rounded-xl text-xs font-mono font-bold bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-300 flex items-center justify-center gap-1"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Pix</span>
          </button>
        </div>

        <p className="text-[10px] text-center font-mono opacity-50 mt-2.5">
          Teclado físico USB externo também suportado: [/] Categoria | [*] Música | [Enter] Pix
        </p>
      </div>
    </div>
  );
};
