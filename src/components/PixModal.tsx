import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Coins, Zap, Link2, AlertTriangle, KeyRound, UserCheck, LogOut, ArrowRight } from 'lucide-react';
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
  const pricePerCredit = useJukeboxStore((s) => s.financialReport.pricePerCredit || 2.50);
  const currentUser = useJukeboxStore((s) => s.currentUser);
  const lastPurchasedPin = useJukeboxStore((s) => s.lastPurchasedPin);
  const authenticateUser = useJukeboxStore((s) => s.authenticateUser);
  const logoutUser = useJukeboxStore((s) => s.logoutUser);
  const handlePixPaid = useJukeboxStore((s) => s.handlePixPaid);

  const playlistCost = userPlaylist.reduce((sum, t) => sum + t.cost, 0);

  // Planos dinâmicos calculados pelo backend Rust (pricePerCredit configurado)
  const baseAmounts = [2.0, 5.0, 10.0, 20.0];
  const dynamicPlans = baseAmounts.map((amt) => {
    const creds = Math.max(1, Math.floor(amt / pricePerCredit));
    let label = 'Básico';
    if (amt >= 20) label = 'Super Bar';
    else if (amt >= 10) label = 'Popular';
    else if (amt >= 5) label = 'Padrão';
    else label = 'Rápido';
    return {
      amount: amt,
      credits: creds,
      label
    };
  });

  const [selectedPlan, setSelectedPlan] = useState(dynamicPlans[1] || { credits: 2, amount: 5.0, label: 'Padrão' });
  const [timeLeft, setTimeLeft] = useState(180);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  // Campo para resgatar/puxar créditos pelo código de 5 dígitos
  const [clientPinInput, setClientPinInput] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isVintage = theme === 'amp-vintage';
  const isNative = tauriBridge.isNative;
  const hasRealPix = isNative && (mpStatus.connected || mpStatus.configured);

  const totalTime = 180;
  const strokeDashoffset = 283 - (283 * (totalTime - timeLeft)) / totalTime;

  // Atualiza o plano selecionado sempre que o preço unitário mudar
  useEffect(() => {
    const creds = Math.max(1, Math.floor(selectedPlan.amount / pricePerCredit));
    setSelectedPlan((prev) => ({ ...prev, credits: creds }));
  }, [pricePerCredit]);

  // Reset ao abrir
  useEffect(() => {
    if (!isPixModalOpen) return;
    setTimeLeft(180);
    setCopied(false);
    setMpError(null);
    setActiveCharge(null);
    setClientPinInput('');
    setPinError(null);
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

  // Puxar créditos usando o código de cliente de 5 dígitos
  const handlePullCredits = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const clean = clientPinInput.trim();
    if (!clean) return;
    if (clean === '0000') {
      logoutUser();
      setClientPinInput('');
      return;
    }
    setPinLoading(true);
    setPinError(null);
    const res = await authenticateUser(clean);
    setPinLoading(false);
    if (!res.ok) {
      setPinError(res.error || 'Código não encontrado');
    } else {
      setClientPinInput('');
    }
  };

  // Simulação manual (navegador ou MP não conectado)
  const handleCompletePayment = async () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#fbbf24', '#fef08a', '#10b981'],
      shapes: ['circle', 'square']
    });

    if (isNative) {
      try {
        const tempUser = await tauriBridge.invokeStrict<any>('create_temp_user', {
          credits: selectedPlan.credits
        });
        if (tempUser) {
          const userPin = tempUser.id.replace('temp-', '');
          handlePixPaid({
            credits: selectedPlan.credits,
            amount: selectedPlan.amount,
            tx_id: `sim-${Date.now()}`,
            userCode: userPin,
            user: tempUser
          });
          return;
        }
      } catch (err) {
        tauriBridge.log(`Erro create_temp_user simulação: ${err}`);
      }
    }

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

  // NAVEGAÇÃO 100% VIA TECLADO NUMÉRICO QUANDO O MODAL ESTIVER ABERTO (SEM MOUSE)
  useEffect(() => {
    if (!isPixModalOpen) return;

    const handleKeyDownModal = (e: KeyboardEvent) => {
      const key = e.key;

      // 1. ESC: Fecha o modal
      if (key === 'Escape') {
        e.preventDefault();
        setPixModalOpen(false);
        return;
      }

      // 2. ENTER / NUMPAD ENTER
      if (key === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        const pin = clientPinInput.trim();

        // 0000 + Enter: Desloga
        if (pin === '0000') {
          logoutUser();
          setClientPinInput('');
          return;
        }

        // 4 ou 5 dígitos + Enter: Autentica e carrega créditos
        if (pin.length >= 4 && pin.length <= 5) {
          handlePullCredits();
          return;
        }

        // Sem PIN digitado: se modo demo, simula pagamento
        if (!hasRealPix && pin.length === 0) {
          handleCompletePayment();
        } else if (hasRealPix && pin.length === 0) {
          copyPixCode();
        }
        return;
      }

      // 3. BACKSPACE: Apaga dígito do PIN ou fecha modal se vazio
      if (key === 'Backspace') {
        if (clientPinInput.length > 0) {
          e.preventDefault();
          setClientPinInput((prev) => prev.slice(0, -1));
          setPinError(null);
        } else {
          e.preventDefault();
          setPixModalOpen(false);
        }
        return;
      }

      // 4. PONTO / VÍRGULA (. ou ,): Copia o código Pix
      if (key === '.' || key === ',' || e.code === 'NumpadDecimal') {
        e.preventDefault();
        copyPixCode();
        return;
      }

      // 5. TECLAS '+' e '-': Alternam entre os planos de recarga disponíveis
      if (key === '+' || e.code === 'NumpadAdd') {
        e.preventDefault();
        const curIdx = dynamicPlans.findIndex((p) => p.amount === selectedPlan.amount);
        const nextIdx = (curIdx + 1) % dynamicPlans.length;
        setSelectedPlan(dynamicPlans[nextIdx]);
        return;
      }

      if (key === '-' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        if (clientPinInput.length > 0) {
          setClientPinInput((prev) => prev.slice(0, -1));
          setPinError(null);
        } else {
          const curIdx = dynamicPlans.findIndex((p) => p.amount === selectedPlan.amount);
          const prevIdx = (curIdx - 1 + dynamicPlans.length) % dynamicPlans.length;
          setSelectedPlan(dynamicPlans[prevIdx]);
        }
        return;
      }

      // 6. TECLA '/': Alterna plano para frente
      if (key === '/' || e.code === 'NumpadDivide') {
        e.preventDefault();
        const curIdx = dynamicPlans.findIndex((p) => p.amount === selectedPlan.amount);
        const nextIdx = (curIdx + 1) % dynamicPlans.length;
        setSelectedPlan(dynamicPlans[nextIdx]);
        return;
      }

      // 7. TECLA '*': Se modo demo e PIN vazio, simula pagamento
      if ((key === '*' || e.code === 'NumpadMultiply') && !hasRealPix && clientPinInput.length === 0) {
        e.preventDefault();
        handleCompletePayment();
        return;
      }

      // 8. DÍGITOS NUMÉRICOS 0 a 9 (incluindo 1, 2, 3, 4, 5): SEMPRE alimentam o PIN do cliente!
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        setClientPinInput((prev) => {
          if (prev.length >= 5) return prev;
          return prev + key;
        });
        setPinError(null);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDownModal, true);
    return () => window.removeEventListener('keydown', handleKeyDownModal, true);
  }, [isPixModalOpen, clientPinInput, dynamicPlans, hasRealPix, selectedPlan]);

  if (!isPixModalOpen) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
      onClick={() => setPixModalOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pix-modal-title"
        tabIndex={-1}
        className={`w-full max-w-lg rounded-3xl p-5 sm:p-6 border shadow-2xl relative overflow-hidden max-h-[92vh] overflow-y-auto ${
          isVintage
            ? 'bg-gradient-to-b from-[#1c1f26] to-[#0f1115] border-amber-500/30 text-amber-100 shadow-amber-950/40'
            : 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-cyan-500/30 text-white shadow-cyan-950/40'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                isVintage ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'
              }`}
            >
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 id="pix-modal-title" className="text-lg font-bold tracking-tight">
                Recarga Pix Instantânea
              </h2>
              <p className="text-xs opacity-60 font-mono">
                {pricePerCredit > 0
                  ? `R$ ${pricePerCredit.toFixed(2)} por crédito`
                  : 'Créditos automáticos'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPixModalOpen(false)}
            aria-label="Fechar recarga Pix"
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors opacity-70 hover:opacity-100 flex items-center gap-1 text-xs font-mono"
            title="Aperte Esc ou Backspace para fechar"
          >
            <span className="hidden sm:inline opacity-60">[Esc]</span>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Ajuda do Teclado Numérico & Touch */}
        <div className="mb-3 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between text-[11px] font-mono gap-1">
          <span className="text-amber-400 font-bold">Teclado 17 Teclas / Touch:</span>
          <span className="opacity-80"><strong className="text-cyan-400">[0-9]</strong> Digita PIN (4-5 dígitos)</span>
          <span className="opacity-80"><strong className="text-amber-300">[+] / [-]</strong> Troca Plano</span>
          <span className="opacity-80"><strong className="text-emerald-300">[,] ou [.]</strong> Copia Pix</span>
          <span className="opacity-80"><strong className="text-white">[Enter]</strong> Confirma</span>
        </div>

        {/* Status de Conexão Mercado Pago (Split vs Direto) */}
        {isNative && mpStatus.connected && (
          <div className="mb-3 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-emerald-300">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {mpStatus.isOAuth
                  ? `Mercado Pago Operador (Split de ${mpStatus.splitPercent}% ativo)`
                  : 'Mercado Pago Oficial (Recarga Direta Automática)'}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 hidden sm:inline">Pix Instantâneo</span>
          </div>
        )}

        {/* Banner comemorativo: Código do Cliente gerado na recarga */}
        {lastPurchasedPin && (
          <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/25 via-emerald-500/25 to-cyan-500/25 border border-amber-400/60 text-center shadow-lg animate-pulse">
            <div className="text-[11px] uppercase tracking-widest font-mono font-bold text-amber-300 flex items-center justify-center gap-1.5">
              <span>🎉 SEU CÓDIGO DE CLIENTE</span>
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest text-amber-300 my-1 drop-shadow">
              {lastPurchasedPin}
            </div>
            <p className="text-[11px] text-zinc-200">
              Guarde este código para resgatar créditos em qualquer momento nesta máquina!
              <br />
              <span className="font-bold text-amber-300">
                Para sair da conta: digite 0000 e pressione ENTER.
              </span>
            </p>
          </div>
        )}

        {/* Seção de Identificação / Puxar Créditos de Cliente Temporário */}
        <div className="mb-4 p-3 rounded-2xl bg-black/40 border border-white/10">
          {currentUser ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-400">{currentUser.name}</div>
                  <div className="text-[11px] font-mono opacity-80">
                    Saldo disponível: <span className="font-bold text-white">{currentUser.credits}</span> crédito(s)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={logoutUser}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 transition-all"
                title="Ou digite 0000 no teclado numérico e aperte Enter"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair [0000]</span>
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2 text-zinc-300">
                <div className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Código de Cliente (5 dígitos):</span>
                </div>
                <span className="text-[10px] font-mono text-cyan-300 opacity-80">
                  Digite no teclado numérico
                </span>
              </div>
              <form onSubmit={handlePullCredits} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    maxLength={5}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={clientPinInput}
                    onChange={(e) => {
                      setClientPinInput(e.target.value.replace(/\D/g, ''));
                      setPinError(null);
                    }}
                    placeholder="Ex: 84920"
                    className="w-full px-3 py-2 text-center text-base font-mono tracking-widest font-bold rounded-xl bg-black/60 border border-white/20 text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                  {clientPinInput.length > 0 && (
                    <span className="absolute right-3 top-2.5 text-xs font-mono text-amber-400">
                      [Enter]
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={clientPinInput.length < 5 || pinLoading}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-slate-950 flex items-center gap-1.5 transition-all shadow"
                >
                  {pinLoading ? 'Buscando...' : 'Puxar Créditos'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
              {pinError && (
                <div className="text-[11px] text-rose-400 mt-1.5 font-mono">{pinError}</div>
              )}
            </div>
          )}
        </div>

        {/* Alerta Mercado Pago não conectado */}
        {isNative && !mpStatus.connected && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Mercado Pago não conectado (modo demonstração).</span>
            </div>
          </div>
        )}

        {mpError && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono">
            {mpError}
          </div>
        )}

        {/* Planos Dinâmicos com Teclas 1, 2, 3, 4 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {dynamicPlans.map((p, idx) => {
            const isSelected = selectedPlan.amount === p.amount;
            const keyNumber = idx + 1;
            return (
              <button
                key={p.amount}
                onClick={() => setSelectedPlan(p)}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer active:scale-95 relative ${
                  isSelected
                    ? isVintage
                      ? 'bg-amber-600 text-zinc-950 font-bold border-amber-400 shadow-md ring-2 ring-amber-300'
                      : 'bg-cyan-500 text-slate-950 font-bold border-cyan-300 neon-glow-cyan ring-2 ring-cyan-300'
                    : isVintage
                    ? 'bg-[#20242b] border-[#313642] text-amber-200 hover:border-amber-600/50'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-cyan-700'
                }`}
                title={`Pressione a tecla [${keyNumber}] no teclado numérico`}
              >
                {/* Indicador de Seleção e Atalho */}
                <div
                  className={`absolute top-1.5 left-1.5 px-1.5 py-0.2 rounded font-mono text-[9px] font-black ${
                    isSelected
                      ? 'bg-black text-white ring-1 ring-white/40'
                      : 'bg-white/10 text-zinc-300 border border-white/10'
                  }`}
                >
                  {isSelected ? '★ ATIVO' : `Opção ${keyNumber}`}
                </div>

                <div className="text-[10px] uppercase font-mono opacity-80 mt-1">{p.label}</div>
                <div className="text-base font-extrabold mt-0.5">R$ {p.amount.toFixed(2)}</div>
                <div className="text-xs font-semibold mt-1 flex items-center justify-center gap-1">
                  <span>{p.credits} Créditos</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* QR Code + Timer */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-4 rounded-2xl border bg-black/40 border-white/5 my-3">
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
            title="Ou aperte a tecla Ponto (.) ou Vírgula (,)"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar [ . ]'}</span>
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
              <span>Simular Pagamento [5 / Enter] ({selectedPlan.credits} Créditos)</span>
            </button>
            <p className="text-[10px] text-center opacity-50 font-mono mt-2">
              Em produção, o evento `pix_pago` do backend libera os créditos e gera o código de 5 dígitos automaticamente.
            </p>
          </div>
        )}

        {hasRealPix && (
          <p className="text-[10px] text-center opacity-60 font-mono pt-2 border-t border-white/5">
            Aguardando confirmação do pagamento... os créditos e o código de 5 dígitos serão liberados automaticamente.
          </p>
        )}
      </div>
    </div>,
    document.getElementById('mmb-stage') || document.body
  );
};
