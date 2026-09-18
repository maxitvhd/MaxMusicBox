import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Coins, Zap, Link2, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useJukeboxStore } from '../store/useJukeboxStore';
import { tauriBridge } from '../services/tauriBridge';
import { PixCharge } from '../types';

export const PixModal = () => {
  const isPixModalOpen = useJukeboxStore((s) => s.isPixModalOpen);
  const setPixModalOpen = useJukeboxStore((s) => s.setPixModalOpen);
  const addCredits = useJukeboxStore((s) => s.addCredits);
  const theme = useJukeboxStore((s) => s.theme);
  const userPlaylist = useJukeboxStore((s) => s.userPlaylist);
  const commitUserPlaylist = useJukeboxStore((s) => s.commitUserPlaylist);
  const mpStatus = useJukeboxStore((s) => s.mpStatus);
  const mpError = useJukeboxStore((s) => s.mpError);
  const setMpError = useJukeboxStore((s) => s.setMpError);
  const activeCharge = useJukeboxStore((s) => s.activeCharge);
  const setActiveCharge = useJukeboxStore((s) => s.setActiveCharge);

  const playlistCost = userPlaylist.reduce((sum, t) => sum + t.cost, 0);

  const [selectedPlan, setSelectedPlan] = useState({ credits: 5, amount: 10.00 });
  const [timeLeft, setTimeLeft] = useState(180);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isPixModalOpen) return;
    const overlay = overlayRef.current;
    const dialog: HTMLDivElement | null = dialogRef.current;
    if (!overlay || !dialog) return;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const background = Array.from(document.body.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlay)
      .map((element) => ({ element, inert: element.inert }));
    const focusDialog = () => {
      const firstButton = dialog.querySelector<HTMLButtonElement>('button:not(:disabled)');
      (firstButton || dialog).focus({ preventScroll: true });
    };
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof Node && !dialog.contains(e.target)) focusDialog();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.type === 'keydown' && !e.repeat) setPixModalOpen(false);
        return;
      }
      if (e.key === 'Tab' && e.type === 'keydown') {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]'
        )).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first) {
          e.preventDefault();
          dialog.focus();
        } else if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
          e.preventDefault();
          first.focus();
        }
      }
      if (!(e.target instanceof Node) || !dialog.contains(e.target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    background.forEach(({ element }) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    document.addEventListener('focusin', onFocus, true);
    focusDialog();

    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      document.removeEventListener('focusin', onFocus, true);
      background.forEach(({ element, inert }) => { element.inert = inert; });
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [isPixModalOpen, setPixModalOpen]);

  const isVintage = theme === 'amp-vintage';
  const isNative = tauriBridge.isNative;
  const hasRealPix = isNative && mpStatus.connected;

  const plans = [
    { credits: 2, amount: 5.00, label: 'Básico' },
    { credits: 5, amount: 10.00, label: 'Popular', bonus: '+1 Bônus' },
    { credits: 12, amount: 20.00, label: 'Super Bar', bonus: '+3 Bônus' },
    { credits: 35, amount: 50.00, label: 'Festa VIP', bonus: '+10 Bônus' }
  ];

  const totalTime = 180;
  const strokeDashoffset = 283 - (283 * (totalTime - timeLeft)) / totalTime;

  // Reset ao abrir
  useEffect(() => {
    if (!isPixModalOpen) return;
    setTimeLeft(180);
    setCopied(false);
    setMpError(null);
    setActiveCharge(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPixModalOpen]);

  // Gera cobrança Pix real quando conectado ao Mercado Pago
  useEffect(() => {
    if (!isPixModalOpen || !hasRealPix) return;
    let cancelled = false;
    (async () => {
      setCreating(true);
      try {
        const charge = await tauriBridge.invokeStrict<PixCharge>('create_pix_charge', {
          amount: selectedPlan.amount,
          credits: selectedPlan.credits
        });
        if (!cancelled) setActiveCharge(charge);
      } catch (e: any) {
        const msg = typeof e === 'string' ? e : e?.message || 'Falha ao gerar cobrança Pix';
        tauriBridge.log(`create_pix_charge falhou: ${msg}`);
        if (!cancelled) setMpError(msg);
      } finally {
        if (!cancelled) setCreating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPixModalOpen, hasRealPix, selectedPlan.amount, selectedPlan.credits]);

  // Contagem regressiva (sincronizada com a expiração da cobrança real)
  useEffect(() => {
    if (!isPixModalOpen) return;
    const target = activeCharge?.expiresAt && activeCharge.expiresAt > 0
      ? activeCharge.expiresAt
      : Date.now() + totalTime * 1000;
    const tick = () => setTimeLeft(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isPixModalOpen, activeCharge]);

  // Simulação manual (navegador ou MP não conectado)
  const handleCompletePayment = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#fef08a', '#10b981'],
      shapes: ['circle', 'square']
    });

    addCredits(selectedPlan.credits, selectedPlan.amount, 'pix');

    if (userPlaylist.length > 0 && selectedPlan.credits >= playlistCost) {
      setTimeout(() => commitUserPlaylist(), 300);
    }

    setTimeout(() => setPixModalOpen(false), 700);
  };

  const copyPixCode = () => {
    const code =
      activeCharge?.copyPaste ||
      `00020126580014br.gov.bcb.pix0136jukebox-pro-pay-${selectedPlan.amount}520400005303986540${selectedPlan.amount.toFixed(2)}5802BR`;
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isPixModalOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none font-modern"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pix-modal-title"
        tabIndex={-1}
        className={`relative w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl p-6 border shadow-2xl transition-all ${
          isVintage
            ? 'bg-[#181a1f] border-[#373c46] text-amber-100'
            : 'bg-[#090d16] border-cyan-800/80 shadow-[0_0_50px_rgba(6,182,212,0.2)] text-slate-100'
        }`}
      >
        <button
          onClick={() => setPixModalOpen(false)}
          aria-label="Fechar Pix"
          className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isVintage
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500'
            }`}
          >
            <Coins className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h2 id="pix-modal-title" className="text-xl font-bold font-tech">Recarregar Créditos via Pix</h2>
            <p className="text-xs opacity-70">
              {hasRealPix
                ? 'Pagamento real processado pelo Mercado Pago'
                : 'Modo demonstração — configure o Mercado Pago no painel admin'}
            </p>
          </div>
        </div>

        {userPlaylist.length > 0 && (
          <div className="mb-4 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between font-mono">
            <span>Playlist pendente: {userPlaylist.length} música(s)</span>
            <span className="font-bold">Total: {playlistCost} crédito(s)</span>
          </div>
        )}

        {/* Status do Mercado Pago */}
        {isNative && !mpStatus.connected && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {mpStatus.configured
                ? 'Conta Mercado Pago ainda não conectada pelo administrador.'
                : 'Credenciais Mercado Pago ausentes (.env).'}
            </span>
            {mpStatus.configured && (
              <button
                onClick={() => tauriBridge.invoke('mp_oauth_start')}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                Conectar
              </button>
            )}
          </div>
        )}

        {mpError && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono">
            {mpError}
          </div>
        )}

        {/* Planos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {plans.map((p) => {
            const isSelected = selectedPlan.amount === p.amount;
            return (
              <button
                key={p.amount}
                onClick={() => setSelectedPlan(p)}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer active:scale-95 ${
                  isSelected
                    ? isVintage
                      ? 'bg-amber-600 text-zinc-950 font-bold border-amber-400 shadow-md'
                      : 'bg-cyan-500 text-slate-950 font-bold border-cyan-300 neon-glow-cyan'
                    : isVintage
                    ? 'bg-[#20242b] border-[#313642] text-amber-200 hover:border-amber-600/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-cyan-700'
                }`}
              >
                <div className="text-[10px] uppercase font-mono opacity-80">{p.label}</div>
                <div className="text-base font-extrabold mt-0.5">R$ {p.amount.toFixed(2)}</div>
                <div className="text-xs font-semibold mt-1 flex items-center justify-center gap-1">
                  <span>{p.credits} Créditos</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* QR Code + Timer */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 rounded-2xl border bg-black/40 border-white/5 my-4">
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={isVintage ? '#f59e0b' : '#06b6d4'}
                strokeWidth="6"
                strokeDasharray="283"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center font-mono">
              <span className="text-lg font-bold">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
              <span className="text-[9px] uppercase opacity-60">Tempo Pix</span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <div className="p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center min-w-[136px] min-h-[136px]">
              {activeCharge?.qrBase64 ? (
                <img
                  src={`data:image/png;base64,${activeCharge.qrBase64}`}
                  alt="QR Code Pix"
                  className="w-28 h-28"
                />
              ) : creating ? (
                <div className="w-28 h-28 flex items-center justify-center text-slate-500 text-xs font-mono text-center px-2">
                  Gerando QR Pix...
                </div>
              ) : (
                <svg viewBox="0 0 120 120" className="w-28 h-28 text-black">
                  <rect x="0" y="0" width="120" height="120" fill="#ffffff" />
                  <rect x="10" y="10" width="30" height="30" fill="#000000" />
                  <rect x="15" y="15" width="20" height="20" fill="#ffffff" />
                  <rect x="20" y="20" width="10" height="10" fill="#000000" />
                  <rect x="80" y="10" width="30" height="30" fill="#000000" />
                  <rect x="85" y="15" width="20" height="20" fill="#ffffff" />
                  <rect x="90" y="20" width="10" height="10" fill="#000000" />
                  <rect x="10" y="80" width="30" height="30" fill="#000000" />
                  <rect x="15" y="85" width="20" height="20" fill="#ffffff" />
                  <rect x="20" y="90" width="10" height="10" fill="#000000" />
                  <rect x="48" y="12" width="6" height="6" fill="#000" />
                  <rect x="58" y="20" width="6" height="6" fill="#000" />
                  <rect x="68" y="30" width="6" height="6" fill="#000" />
                  <rect x="12" y="48" width="6" height="6" fill="#000" />
                  <rect x="24" y="58" width="6" height="6" fill="#000" />
                  <rect x="48" y="48" width="24" height="24" fill="#000" />
                  <rect x="54" y="54" width="12" height="12" fill="#fff" />
                  <rect x="80" y="50" width="8" height="8" fill="#000" />
                  <rect x="95" y="65" width="8" height="8" fill="#000" />
                  <rect x="50" y="80" width="8" height="8" fill="#000" />
                  <rect x="70" y="95" width="10" height="6" fill="#000" />
                  <rect x="90" y="90" width="16" height="16" fill="#000" />
                </svg>
              )}
            </div>
            <span className="text-[10px] font-mono opacity-60 mt-1">
              {hasRealPix ? 'Escaneie com o app do seu banco' : 'QR de demonstração'}
            </span>
          </div>
        </div>

        {/* Copiar código Pix */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            readOnly
            value={activeCharge?.copyPaste || `00020126580014br.gov.bcb.pix0136jukebox-pro-recarga-${selectedPlan.amount}`}
            className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-black/50 border border-white/10 text-zinc-300 truncate"
          />
          <button
            onClick={copyPixCode}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              copied
                ? 'bg-emerald-600 text-white'
                : isVintage
                ? 'vintage-neumorphic-btn text-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-300'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>

        {/* Simulação (apenas quando não há Pix real ativo) */}
        {!hasRealPix && (
          <div className="pt-2 border-t border-white/5">
            <button
              onClick={handleCompletePayment}
              className={`w-full py-3 rounded-xl font-extrabold uppercase tracking-wider text-sm flex items-center justify-center gap-2 transition-all duration-150 active:scale-95 shadow-lg ${
                isVintage
                  ? 'bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-emerald-100 border border-emerald-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:brightness-110 text-slate-950 neon-glow-cyan'
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Simular Pagamento Pix (Receber {selectedPlan.credits} Créditos)</span>
            </button>
            <p className="text-[10px] text-center opacity-50 font-mono mt-2">
              Em produção, o evento `pix_pago` do backend libera os créditos automaticamente.
            </p>
          </div>
        )}

        {hasRealPix && (
          <p className="text-[10px] text-center opacity-60 font-mono pt-2 border-t border-white/5">
            Aguardando confirmação do pagamento... os créditos são liberados automaticamente.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
};
