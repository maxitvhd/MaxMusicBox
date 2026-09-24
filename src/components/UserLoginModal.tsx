import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserRound, LogOut, Coins, KeyRound, CheckCircle } from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';

export const UserLoginModal = () => {
  const isUserLoginOpen = useJukeboxStore((s) => s.isUserLoginOpen);
  const setUserLoginOpen = useJukeboxStore((s) => s.setUserLoginOpen);
  const currentUser = useJukeboxStore((s) => s.currentUser);
  const authenticateUser = useJukeboxStore((s) => s.authenticateUser);
  const logoutUser = useJukeboxStore((s) => s.logoutUser);
  const theme = useJukeboxStore((s) => s.theme);

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isVintage = theme === 'amp-vintage';

  useEffect(() => {
    if (!isUserLoginOpen) return;
    setPassword('');
    setError(null);
    setChecking(false);
  }, [isUserLoginOpen]);

  useEffect(() => {
    if (!isUserLoginOpen) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        setUserLoginOpen(false);
        return;
      }
      if (e.key === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        submit();
        return;
      }
      if (e.key === 'Backspace' || e.code === 'NumpadDecimal') {
        e.preventDefault();
        setPassword((p) => p.slice(0, -1));
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        appendDigit(e.key);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserLoginOpen, password]);

  const appendDigit = (digit: string) => {
    setChecking(false);
    setError(null);
    setPassword((p) => (p.length < 8 ? p + digit : p));
  };

  const submit = async () => {
    if (checking) return;
    if (password.length < 1) {
      setError('Digite a senha do usuário.');
      return;
    }
    setChecking(true);
    const result = await authenticateUser(password);
    if (!result.ok) {
      setError(result.error || 'Senha não encontrada.');
      setPassword('');
      setChecking(false);
    }
  };

  if (!isUserLoginOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none font-modern"
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Acesso do usuário"
        className={`relative w-full max-w-sm rounded-3xl p-6 border shadow-2xl ${
          isVintage
            ? 'bg-[#181a1f] border-[#373c46] text-amber-100'
            : 'bg-[#090d16] border-cyan-800/80 shadow-[0_0_50px_rgba(6,182,212,0.2)] text-slate-100'
        }`}
      >
        {currentUser ? (
          <div className="flex flex-col items-center py-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                isVintage
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500'
              }`}
            >
              <CheckCircle className="w-7 h-7" />
            </div>
            <h2 className="font-tech text-xl font-bold uppercase">{currentUser.name}</h2>
            <p className="text-xs opacity-70 font-mono mt-1">Acesso liberado pela senha</p>
            <div className="flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 font-mono">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-emerald-300">
                {currentUser.credits} {currentUser.credits === 1 ? 'crédito' : 'créditos'}
              </span>
            </div>
            <button
              onClick={() => {
                logoutUser();
                setUserLoginOpen(false);
              }}
              className={`mt-6 w-full py-3 rounded-xl font-extrabold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${
                isVintage
                  ? 'bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-700'
                  : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-700/50'
              }`}
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </button>
            <button
              onClick={() => setUserLoginOpen(false)}
              className="mt-2 text-xs font-mono opacity-70 hover:opacity-100 underline"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setUserLoginOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isVintage
                    ? 'bg-amber-950 text-amber-400 border border-amber-700'
                    : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500'
                }`}
              >
                <UserRound className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold font-tech">Acesso do Cliente</h2>
                <p className="text-xs opacity-70">Digite a senha para liberar o saldo da conta</p>
              </div>
            </div>

            <div className="mb-4 p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between font-mono">
              <span className="text-xs opacity-70 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                Senha do usuário
              </span>
              <span className={`text-lg font-bold tracking-widest ${error ? 'text-rose-400' : 'text-cyan-300'}`}>
                {'●'.repeat(password.length)}
              </span>
            </div>

            {error && (
              <div className="mb-4 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono">
                {error}
              </div>
            )}

            <input ref={inputRef} type="hidden" autoFocus />

            <div className="grid grid-cols-3 gap-3 w-full">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'].map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    if (k === 'CLR') {
                      setPassword('');
                      setError(null);
                    } else if (k === 'OK') {
                      submit();
                    } else {
                      appendDigit(k);
                    }
                  }}
                  className={`h-14 rounded-xl flex items-center justify-center text-lg font-mono font-bold transition-all active:scale-95 ${
                    k === 'OK'
                      ? isVintage
                        ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : k === 'CLR'
                      ? isVintage
                        ? 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800'
                        : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-700/50'
                      : isVintage
                      ? 'bg-[#21252d] hover:bg-[#2a2f3a] border border-[#373d4a] text-amber-300'
                      : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            <p className="mt-4 text-[10px] text-center opacity-50 font-mono">
              {checking ? 'Verificando senha...' : 'Teclado numérico externo também funciona'}
            </p>
          </>
        )}
      </div>
    </div>,
    document.getElementById('mmb-stage') || document.body
  );
};