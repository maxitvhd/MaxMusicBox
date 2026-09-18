import { Delete, Check, Hash } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';

export const Keypad = () => {
  const theme = useJukeboxStore((s) => s.theme);
  const keypadBuffer = useJukeboxStore((s) => s.keypadBuffer);
  const keypadFeedback = useJukeboxStore((s) => s.keypadFeedback);
  const handleKeypadDigit = useJukeboxStore((s) => s.handleKeypadDigit);
  const handleKeypadCorrect = useJukeboxStore((s) => s.handleKeypadCorrect);
  const handleKeypadConfirm = useJukeboxStore((s) => s.handleKeypadConfirm);

  const isVintage = theme === 'amp-vintage';

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
    <div
      className={`w-full sm:w-72 rounded-2xl p-4 border transition-colors select-none flex flex-col justify-between ${
        isVintage
          ? 'bg-[#181a1f] border-[#2e333d] shadow-2xl text-amber-100'
          : 'bg-[#0b1120]/95 border-cyan-900/60 shadow-2xl text-slate-100'
      }`}
    >
      {/* Title */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <Hash className={`w-4 h-4 ${isVintage ? 'text-amber-500' : 'text-cyan-400'}`} />
          <h3 className="font-bold text-xs uppercase tracking-wider font-mono">Teclado Numérico</h3>
        </div>
        <span className="text-[10px] opacity-60 font-mono">DIGITE O CÓDIGO</span>
      </div>

      {/* Digital Screen Display (VFD simulation) */}
      <div
        className={`w-full py-3 px-4 rounded-xl border flex flex-col items-center justify-center mb-4 transition-all duration-200 ${
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
            ? 'FAIXA ADICIONADA!'
            : keypadFeedback === 'error'
            ? 'CÓDIGO INVÁLIDO'
            : 'CÓDIGO DA MÚSICA'}
        </span>
        <div className="text-3xl font-vfd font-bold tracking-widest mt-0.5">
          {keypadBuffer ? keypadBuffer : <span className="opacity-30">__</span>}
        </div>
      </div>

      {/* Tactile 3D Buttons Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {keys.map((key) => {
          const isCorrect = key === 'CLR';
          const isConfirm = key === 'OK';

          return (
            <button
              key={key}
              onClick={() => handleKeyClick(key)}
              className={`h-14 rounded-xl font-bold font-mono transition-all duration-75 flex items-center justify-center cursor-pointer select-none active:translate-y-1 ${
                isConfirm
                  ? isVintage
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-emerald-100 border border-emerald-500 shadow-[0_4px_0_#064e3b]'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_4px_0_#047857] neon-glow-cyan'
                  : isCorrect
                  ? isVintage
                    ? 'bg-rose-900 hover:bg-rose-800 text-rose-200 border border-rose-700 shadow-[0_4px_0_#4c0519]'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_4px_0_#9f1239]'
                  : isVintage
                  ? 'bg-[#22262e] hover:bg-[#282d36] text-amber-300 border border-[#3b414d] shadow-[0_4px_0_#14161a] text-xl active:shadow-none'
                  : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-900/60 shadow-[0_4px_0_#06162d] text-xl active:shadow-none'
              }`}
            >
              {isCorrect ? (
                <div className="flex flex-col items-center text-[11px]">
                  <Delete className="w-4 h-4" />
                  <span>CORR</span>
                </div>
              ) : isConfirm ? (
                <div className="flex flex-col items-center text-[11px]">
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

      {/* Guide label */}
      <p className="text-[10px] text-center font-mono opacity-50 mt-3">
        Dica: Veja o código na tabela de faixas (ex: 01, 10, 20)
      </p>
    </div>
  );
};
