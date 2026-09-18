import { useEffect, useState } from 'react';
import {
  X,
  Sliders,
  Calendar,
  DollarSign,
  Lock,
  Check,
  Power,
  ShieldCheck,
  Volume2,
  RotateCcw,
  Sparkles,
  Keyboard,
  Play,
  Disc,
  Music,
  Plus,
  Link2,
  Unplug,
  FolderOpen,
  RefreshCw,
  Wallet,
  Users,
  UserRoundPlus,
  Pencil,
  Trash2,
  Coins
} from 'lucide-react';
import { useJukeboxStore } from '../store/useJukeboxStore';
import { tauriBridge } from '../services/tauriBridge';
import { VuMeter } from './VuMeter';
import { RotaryKnob } from './RotaryKnob';

export const AdminRackModal = () => {
  const isAdminModalOpen = useJukeboxStore((s) => s.isAdminModalOpen);
  const setAdminModalOpen = useJukeboxStore((s) => s.setAdminModalOpen);
  const theme = useJukeboxStore((s) => s.theme);

  const categories = useJukeboxStore((s) => s.categories);
  const tracks = useJukeboxStore((s) => s.tracks);
  const playTrack = useJukeboxStore((s) => s.playTrack);
  const addToQueue = useJukeboxStore((s) => s.addToQueue);
  const currentTrack = useJukeboxStore((s) => s.currentTrack);
  const dspSettings = useJukeboxStore((s) => s.dspSettings);
  const setEqBand = useJukeboxStore((s) => s.setEqBand);
  const setCompressor = useJukeboxStore((s) => s.setCompressor);
  const setAgc = useJukeboxStore((s) => s.setAgc);
  const setLimiterCeiling = useJukeboxStore((s) => s.setLimiterCeiling);
  const setMasterGain = useJukeboxStore((s) => s.setMasterGain);

  const autoDjConfig = useJukeboxStore((s) => s.autoDjConfig);
  const setCategoryLocked = useJukeboxStore((s) => s.setCategoryLocked);
  const setWeeklySchedule = useJukeboxStore((s) => s.setWeeklySchedule);
  const setDateOverride = useJukeboxStore((s) => s.setDateOverride);

  const financialReport = useJukeboxStore((s) => s.financialReport);
  const setPricePerCredit = useJukeboxStore((s) => s.setPricePerCredit);
  const kioskKeyboardConfig = useJukeboxStore((s) => s.kioskKeyboardConfig);
  const setKioskKeyboardConfig = useJukeboxStore((s) => s.setKioskKeyboardConfig);
  const mpStatus = useJukeboxStore((s) => s.mpStatus);
  const mpError = useJukeboxStore((s) => s.mpError);
  const refreshMpStatus = useJukeboxStore((s) => s.refreshMpStatus);
  const refreshFinancialReport = useJukeboxStore((s) => s.refreshFinancialReport);
  const loadCatalog = useJukeboxStore((s) => s.loadCatalog);
  const showKioskHud = useJukeboxStore((s) => s.showKioskHud);

  const users = useJukeboxStore((s) => s.users);
  const listUsers = useJukeboxStore((s) => s.listUsers);
  const createUser = useJukeboxStore((s) => s.createUser);
  const updateUser = useJukeboxStore((s) => s.updateUser);
  const deleteUser = useJukeboxStore((s) => s.deleteUser);
  const addUserCredits = useJukeboxStore((s) => s.addUserCredits);

  // Authentication PIN state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState<'dsp' | 'autodj' | 'financial' | 'kiosk' | 'autoplay' | 'users'>('dsp');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [adminSelectedCat, setAdminSelectedCat] = useState<string>('all');

  // New specific date override state
  const [newOverrideDate, setNewOverrideDate] = useState('');
  const [newOverrideCategory, setNewOverrideCategory] = useState('samba');

  // Mercado Pago / Biblioteca / Preço
  const [priceInput, setPriceInput] = useState(financialReport.pricePerCredit.toFixed(2));
  const [libraryInfo, setLibraryInfo] = useState<{ path: string; trackCount: number }>({
    path: '',
    trackCount: tracks.length
  });
  const [busy, setBusy] = useState(false);
  const [mpCodeInput, setMpCodeInput] = useState('');
  const [mpAwaitingCode, setMpAwaitingCode] = useState(false);

  const [userForm, setUserForm] = useState({ name: '', password: '', credits: '0' });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [creditTopUp, setCreditTopUp] = useState<{ id: string; credits: string } | null>(null);

  const loadLibraryInfo = async () => {
    const info = await tauriBridge.invoke<{ path: string; trackCount: number }>('library_info');
    if (info) setLibraryInfo(info);
  };

  useEffect(() => {
    if (!isAdminModalOpen || !isAuthenticated) return;
    if (activeTab === 'financial') {
      refreshMpStatus();
      refreshFinancialReport();
      loadLibraryInfo();
    }
    if (activeTab === 'users') {
      listUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminModalOpen, isAuthenticated, activeTab]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    tauriBridge
      .listen<{ redirect_uri: string; local: boolean }>('mp_oauth_waiting', (e) => {
        setMpAwaitingCode(!e.payload.local);
      })
      .then((u) => {
        unlisten = u;
      });
    return () => unlisten?.();
  }, []);

  const connectMp = () => {
    tauriBridge.invoke('mp_oauth_start');
    showKioskHud('Mercado Pago', 'Conclua o login no navegador...', 'info', 5000);
  };

  const completeMp = async () => {
    const code = mpCodeInput.trim();
    if (!code) return;
    await tauriBridge.invoke('mp_oauth_complete', { code });
    setMpCodeInput('');
    setMpAwaitingCode(false);
    await refreshMpStatus();
  };

  const disconnectMp = async () => {
    await tauriBridge.invoke('mp_disconnect');
    await refreshMpStatus();
    showKioskHud('Mercado Pago', 'Conta desconectada.', 'warning', 3000);
  };

  const pickLibraryFolder = async () => {
    setBusy(true);
    try {
      const path = await tauriBridge.invoke<string | null>('pick_music_folder');
      if (path) {
        const count = await tauriBridge.invoke<number>('set_library_path', { path });
        await loadCatalog();
        await loadLibraryInfo();
        showKioskHud('Biblioteca atualizada', `${count ?? 0} faixa(s) indexada(s)`, 'success', 3500);
      }
    } finally {
      setBusy(false);
    }
  };

  const rescanLibrary = async () => {
    setBusy(true);
    try {
      const count = await tauriBridge.invoke<number>('rescan_library');
      await loadCatalog();
      await loadLibraryInfo();
      showKioskHud('Re-indexação concluída', `${count ?? 0} faixa(s)`, 'success', 3500);
    } finally {
      setBusy(false);
    }
  };

  const savePrice = () => {
    const value = parseFloat(priceInput.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    setPricePerCredit(value);
    showKioskHud('Preço atualizado', `R$ ${value.toFixed(2)} por crédito`, 'success', 2500);
  };

  const daysOfWeek = [
    { day: 0, name: 'Domingo' },
    { day: 1, name: 'Segunda-feira' },
    { day: 2, name: 'Terça-feira' },
    { day: 3, name: 'Quarta-feira' },
    { day: 4, name: 'Quinta-feira' },
    { day: 5, name: 'Sexta-feira' },
    { day: 6, name: 'Sábado' }
  ];

  const handlePinDigit = (digit: string) => {
    if (pinInput.length < 4) {
      const next = pinInput + digit;
      setPinInput(next);
      setPinError(false);

      if (next.length === 4) {
        // Check master PIN (default: 1234)
        if (next === '1234' || next === '0000') {
          setIsAuthenticated(true);
        } else {
          setPinError(true);
          setTimeout(() => {
            setPinInput('');
            setPinError(false);
          }, 800);
        }
      }
    }
  };

  const handleAddDateOverride = () => {
    if (!newOverrideDate) return;
    setDateOverride(newOverrideDate, newOverrideCategory);
    setNewOverrideDate('');
  };

  const resetUserForm = () => {
    setUserForm({ name: '', password: '', credits: '0' });
    setEditingUserId(null);
    setUserFormError(null);
  };

  const handleSaveUser = async () => {
    const name = userForm.name.trim();
    const credits = Math.max(0, parseInt(userForm.credits, 10) || 0);
    if (!name) {
      setUserFormError('Informe o nome do usuário.');
      return;
    }
    const result = editingUserId
      ? await updateUser(editingUserId, name, userForm.password, credits)
      : await createUser(name, userForm.password, credits);
    if (result.ok) {
      showKioskHud(
        editingUserId ? 'Usuário atualizado' : 'Usuário cadastrado',
        `${name} — ${credits} crédito(s)`,
        'success',
        2500
      );
      resetUserForm();
      listUsers();
    } else {
      setUserFormError(result.error || 'Falha ao salvar usuário.');
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Excluir o usuário "${name}"?`)) return;
    await deleteUser(id);
    showKioskHud('Usuário excluído', name, 'warning', 2500);
  };

  const handleTopUp = async (id: string) => {
    if (!creditTopUp || creditTopUp.id !== id) return;
    const value = Math.max(0, parseInt(creditTopUp.credits, 10) || 0);
    if (value <= 0) return;
    await addUserCredits(id, value);
    showKioskHud('Créditos adicionados', `+${value} crédito(s)`, 'success', 2500);
    setCreditTopUp(null);
    listUsers();
  };

  if (!isAdminModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md select-none overflow-y-auto">
      {/* PIN Authentication Screen */}
      {!isAuthenticated ? (
        <div className="relative w-full max-w-sm rounded-3xl p-6 bg-[#16181d] border border-[#313642] text-amber-100 shadow-2xl flex flex-col items-center">
          <button
            onClick={() => setAdminModalOpen(false)}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400 mb-4 shadow-lg">
            <Lock className="w-7 h-7" />
          </div>

          <h3 className="font-tech text-xl font-bold tracking-wider">Rack Quasar - Admin</h3>
          <p className="text-xs opacity-70 font-mono mt-1 text-center">
            Digite o PIN de 4 dígitos para acessar o processador DSP e financeiro
          </p>

          {/* PIN Dots */}
          <div className="flex gap-4 my-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  pinError
                    ? 'border-red-500 bg-red-500/80 shadow-[0_0_10px_#ef4444]'
                    : pinInput.length > i
                    ? 'border-amber-400 bg-amber-400 shadow-[0_0_10px_#f59e0b]'
                    : 'border-zinc-600 bg-transparent'
                }`}
              />
            ))}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'].map((k) => (
              <button
                key={k}
                onClick={() => {
                  if (k === 'CLR') setPinInput('');
                  else if (k === 'OK') {
                    if (pinInput === '1234' || pinInput === '0000') setIsAuthenticated(true);
                    else setPinError(true);
                  } else handlePinDigit(k);
                }}
                className="h-12 rounded-xl bg-[#21252d] hover:bg-[#2a2f3a] border border-[#373d4a] text-lg font-mono font-bold text-amber-300 transition-all active:scale-95 flex items-center justify-center"
              >
                {k}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              setPinInput('1234');
              setIsAuthenticated(true);
            }}
            className="mt-4 text-[11px] text-amber-400/80 hover:text-amber-200 underline font-mono cursor-pointer"
          >
            PIN Padrão: 1234 (Clique aqui para preenchimento rápido)
          </button>
        </div>
      ) : (
        /* Full Professional Quasar Rack Panel */
        <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl bg-[#14161b] border-2 border-[#383e4c] text-zinc-200 shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden">
          {/* Faux Metallic Rack Corner Screws (4 corners) */}
          <div className="absolute top-2.5 left-2.5 w-3.5 h-3.5 rounded-full bg-zinc-600 border border-zinc-800 flex items-center justify-center shadow">
            <div className="w-2 h-0.5 bg-zinc-900 rotate-45" />
          </div>
          <div className="absolute top-2.5 right-2.5 w-3.5 h-3.5 rounded-full bg-zinc-600 border border-zinc-800 flex items-center justify-center shadow">
            <div className="w-2 h-0.5 bg-zinc-900 -rotate-45" />
          </div>
          <div className="absolute bottom-2.5 left-2.5 w-3.5 h-3.5 rounded-full bg-zinc-600 border border-zinc-800 flex items-center justify-center shadow">
            <div className="w-2 h-0.5 bg-zinc-900 -rotate-12" />
          </div>
          <div className="absolute bottom-2.5 right-2.5 w-3.5 h-3.5 rounded-full bg-zinc-600 border border-zinc-800 flex items-center justify-center shadow">
            <div className="w-2 h-0.5 bg-zinc-900 rotate-12" />
          </div>

          {/* Rack Top Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-[#1c2027] via-[#242933] to-[#1c2027] border-b border-[#353b49] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              <h2 className="font-tech text-lg font-bold tracking-widest text-amber-400 uppercase">
                RACK QUASAR DSP & CONTROLE OPERACIONAL
              </h2>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('dsp')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  activeTab === 'dsp'
                    ? 'bg-amber-600 text-zinc-950 shadow-md font-extrabold'
                    : 'bg-[#1b1e25] text-zinc-400 hover:text-white border border-[#313642]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>1. DSP & Equalizador</span>
              </button>

              <button
                onClick={() => setActiveTab('autodj')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  activeTab === 'autodj'
                    ? 'bg-amber-600 text-zinc-950 shadow-md font-extrabold'
                    : 'bg-[#1b1e25] text-zinc-400 hover:text-white border border-[#313642]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>2. Auto-DJ & Agenda</span>
              </button>

              <button
                onClick={() => setActiveTab('financial')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  activeTab === 'financial'
                    ? 'bg-amber-600 text-zinc-950 shadow-md font-extrabold'
                    : 'bg-[#1b1e25] text-zinc-400 hover:text-white border border-[#313642]'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>3. Relatório Financeiro</span>
              </button>

              <button
                onClick={() => setActiveTab('kiosk')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  activeTab === 'kiosk'
                    ? 'bg-amber-600 text-zinc-950 shadow-md font-extrabold'
                    : 'bg-[#1b1e25] text-zinc-400 hover:text-white border border-[#313642]'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>4. Teclado</span>
              </button>

              <button
                onClick={() => setActiveTab('autoplay')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  activeTab === 'autoplay'
                    ? 'bg-emerald-600 text-zinc-950 shadow-md font-extrabold'
                    : 'bg-[#1b1e25] text-emerald-400 hover:text-white border border-emerald-800/60'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>5. Tocar Direto (Admin Free)</span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  activeTab === 'users'
                    ? 'bg-cyan-600 text-zinc-950 shadow-md font-extrabold'
                    : 'bg-[#1b1e25] text-cyan-400 hover:text-white border border-cyan-800/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>6. Usuários</span>
              </button>

              <button
                onClick={() => setAdminModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 ml-2"
                title="Fechar Painel Admin"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* ================= ABA 1: DSP & AUDIO RACK ================= */}
            {activeTab === 'dsp' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Module 1: Master Output VU Meters */}
                <div className="rounded-2xl p-4 bg-[#181a20] border border-[#2d323e] shadow-md relative">
                  <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400">
                      MÓDULO VU MÁSTER (BALÍSTICA MECÂNICA ANALÓGICA)
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">ESCALA: -20dB A +3dB</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-8 py-2">
                    <VuMeter channel="left" label="OUTPUT CH-L" size="large" />
                    <VuMeter channel="right" label="OUTPUT CH-R" size="large" />
                  </div>
                </div>

                {/* Module 2: 5-Band Rotary Equalizer */}
                <div className="rounded-2xl p-5 bg-[#181a20] border border-[#2d323e] shadow-md relative">
                  <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                    <div>
                      <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400">
                        EQUALIZADOR ANALÓGICO PARAMÉTRICO (5 BANDAS)
                      </span>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        Arraste o cursor para cima/baixo para girar (-12dB a +12dB). Dispara Tauri IPC `set_eq_band`.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        [0, 1, 2, 3, 4].forEach((i) => setEqBand(i, 0));
                      }}
                      className="text-[10px] font-mono px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      FLAT (0 dB)
                    </button>
                  </div>

                  {/* 5 Rotary Knobs Grid */}
                  <div className="grid grid-cols-5 gap-4 py-2">
                    <RotaryKnob
                      label="Grave (80Hz)"
                      value={dspSettings.eq.band0_80Hz}
                      min={-12}
                      max={12}
                      color="#ef4444"
                      onChange={(val) => setEqBand(0, val)}
                    />
                    <RotaryKnob
                      label="Médio-Grave (350Hz)"
                      value={dspSettings.eq.band1_350Hz}
                      min={-12}
                      max={12}
                      color="#f97316"
                      onChange={(val) => setEqBand(1, val)}
                    />
                    <RotaryKnob
                      label="Médio (1kHz)"
                      value={dspSettings.eq.band2_1kHz}
                      min={-12}
                      max={12}
                      color="#f59e0b"
                      onChange={(val) => setEqBand(2, val)}
                    />
                    <RotaryKnob
                      label="Médio-Agudo (4kHz)"
                      value={dspSettings.eq.band3_4kHz}
                      min={-12}
                      max={12}
                      color="#06b6d4"
                      onChange={(val) => setEqBand(3, val)}
                    />
                    <RotaryKnob
                      label="Agudo (12kHz)"
                      value={dspSettings.eq.band4_12kHz}
                      min={-12}
                      max={12}
                      color="#a855f7"
                      onChange={(val) => setEqBand(4, val)}
                    />
                  </div>
                </div>

                {/* Module 3: Dynamics (AGC, Compressor, Limiter, Master Gain) */}
                <div className="rounded-2xl p-5 bg-[#181a20] border border-[#2d323e] shadow-md">
                  <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400">
                      MÓDULO DYNAMICS & MASTER GAIN
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">PROTEÇÃO & NIVELAMENTO AUTOMÁTICO</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* AGC (Auto Gain Control) */}
                    <div className="p-3 rounded-xl bg-[#121418] border border-[#2b303a] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono font-bold text-amber-300">AGC (Nivelamento)</span>
                          <button
                            onClick={() => setAgc(!dspSettings.agcActive)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                              dspSettings.agcActive
                                ? 'bg-emerald-600 text-white'
                                : 'bg-zinc-800 text-zinc-500'
                            }`}
                          >
                            {dspSettings.agcActive ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        <p className="text-[10px] opacity-70 mb-3">
                          Normaliza o volume entre faixas antigas e modernas.
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-mono mb-1">
                          <span>Sensibilidade</span>
                          <span>{dspSettings.agcSensitivity}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={dspSettings.agcSensitivity}
                          onChange={(e) => setAgc(dspSettings.agcActive, Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Compressor Rotary Controls */}
                    <div className="p-3 rounded-xl bg-[#121418] border border-[#2b303a] md:col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold text-amber-300">
                          Compressor de Áudio
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">DINÂMICA</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 pt-1">
                        <RotaryKnob
                          label="Threshold"
                          value={dspSettings.compressor.threshold}
                          min={-60}
                          max={0}
                          unit="dB"
                          size={46}
                          color="#f59e0b"
                          onChange={(v) =>
                            setCompressor(
                              v,
                              dspSettings.compressor.ratio,
                              dspSettings.compressor.attack,
                              dspSettings.compressor.release
                            )
                          }
                        />
                        <RotaryKnob
                          label="Ratio"
                          value={dspSettings.compressor.ratio}
                          min={1}
                          max={20}
                          unit=":1"
                          size={46}
                          color="#f59e0b"
                          onChange={(v) =>
                            setCompressor(
                              dspSettings.compressor.threshold,
                              v,
                              dspSettings.compressor.attack,
                              dspSettings.compressor.release
                            )
                          }
                        />
                        <RotaryKnob
                          label="Attack"
                          value={Math.round(dspSettings.compressor.attack * 1000)}
                          min={1}
                          max={500}
                          unit="ms"
                          size={46}
                          color="#06b6d4"
                          onChange={(v) =>
                            setCompressor(
                              dspSettings.compressor.threshold,
                              dspSettings.compressor.ratio,
                              v / 1000,
                              dspSettings.compressor.release
                            )
                          }
                        />
                        <RotaryKnob
                          label="Release"
                          value={Math.round(dspSettings.compressor.release * 1000)}
                          min={50}
                          max={1000}
                          unit="ms"
                          size={46}
                          color="#06b6d4"
                          onChange={(v) =>
                            setCompressor(
                              dspSettings.compressor.threshold,
                              dspSettings.compressor.ratio,
                              dspSettings.compressor.attack,
                              v / 1000
                            )
                          }
                        />
                      </div>
                    </div>

                    {/* Limiter & Master Gain Fader */}
                    <div className="p-3 rounded-xl bg-[#121418] border border-[#2b303a] flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between text-xs font-mono font-bold text-amber-300 mb-1">
                          <span>Limiter Ceiling</span>
                          <span className="text-red-400">{dspSettings.limiterCeiling} dB</span>
                        </div>
                        <p className="text-[9px] opacity-60 mb-2">Teto máximo para proteção dos alto-falantes.</p>
                        <input
                          type="range"
                          min="-12"
                          max="0"
                          step="0.5"
                          value={dspSettings.limiterCeiling}
                          onChange={(e) => setLimiterCeiling(Number(e.target.value))}
                          className="w-full accent-red-500 cursor-pointer"
                        />
                      </div>

                      <div className="mt-3 pt-2 border-t border-white/5">
                        <div className="flex justify-between text-xs font-mono font-bold text-emerald-400 mb-1">
                          <span>Master Gain</span>
                          <span>{Math.round(dspSettings.masterGain * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1.5"
                          step="0.05"
                          value={dspSettings.masterGain}
                          onChange={(e) => setMasterGain(Number(e.target.value))}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= ABA 2: AUTO-DJ & AGENDA INTELIGENTE ================= */}
            {activeTab === 'autodj' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Big Industrial Lever: Trava de Categoria */}
                <div
                  className={`p-6 rounded-2xl border transition-all ${
                    autoDjConfig.categoryLocked
                      ? 'bg-red-950/40 border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.2)]'
                      : 'bg-[#181a20] border-[#2e333d]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-tech font-bold uppercase tracking-wider text-red-400">
                          TRAVA DE CATEGORIA INDUSTRIAL
                        </span>
                        {autoDjConfig.categoryLocked && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-600 text-white font-bold animate-pulse">
                            ATIVADO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-300 max-w-xl mt-1">
                        Quando ativada, oculta todas as outras categorias na tela principal da Jukebox e força o
                        Auto-DJ a tocar exclusivamente faixas desta categoria selecionada.
                      </p>
                    </div>

                    {/* Industrial Toggle Lever Switch */}
                    <div className="flex items-center gap-4">
                      <select
                        value={autoDjConfig.lockedCategoryId}
                        onChange={(e) => setCategoryLocked(autoDjConfig.categoryLocked, e.target.value)}
                        className="px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-xs font-mono font-bold text-amber-300"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() =>
                          setCategoryLocked(!autoDjConfig.categoryLocked, autoDjConfig.lockedCategoryId)
                        }
                        className={`w-20 h-10 rounded-full p-1 transition-colors duration-300 flex items-center cursor-pointer ${
                          autoDjConfig.categoryLocked ? 'bg-red-600 justify-end' : 'bg-zinc-800 justify-start'
                        }`}
                        title="Ativar/Desativar Trava de Categoria"
                      >
                        <div className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
                          <Power
                            className={`w-4 h-4 ${
                              autoDjConfig.categoryLocked ? 'text-red-600' : 'text-zinc-600'
                            }`}
                          />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Weekly Category Mapping Schedule */}
                <div className="rounded-2xl p-5 bg-[#181a20] border border-[#2d323e]">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">
                    MAPEAMENTO SEMANAL (PROGRAMAÇÃO AUTOMÁTICA)
                  </h3>
                  <p className="text-xs opacity-70 mb-4">
                    O Auto-DJ seleciona automaticamente o gênero programado para cada dia da semana se a fila estiver vazia.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
                    {daysOfWeek.map(({ day, name }) => {
                      const currentVal =
                        autoDjConfig.weeklySchedule[day as 0 | 1 | 2 | 3 | 4 | 5 | 6] || 'rock';

                      return (
                        <div
                          key={day}
                          className="p-3 rounded-xl bg-[#121418] border border-[#2b303a] flex flex-col justify-between"
                        >
                          <span className="text-xs font-bold font-tech text-amber-200 mb-2">{name}</span>
                          <select
                            value={currentVal}
                            onChange={(e) => setWeeklySchedule(day, e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 text-[11px] font-mono text-amber-300"
                          >
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Specific Date Override Calendar */}
                <div className="rounded-2xl p-5 bg-[#181a20] border border-[#2d323e]">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">
                    EVENTOS ESPECÍFICOS / DATAS ESPECIAIS (SOBRESCREVE A REGRA SEMANAL)
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <input
                      type="date"
                      value={newOverrideDate}
                      onChange={(e) => setNewOverrideDate(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-zinc-200"
                    />

                    <select
                      value={newOverrideCategory}
                      onChange={(e) => setNewOverrideCategory(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-amber-300"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleAddDateOverride}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs font-mono transition-all"
                    >
                      Adicionar Regra de Data
                    </button>
                  </div>

                  {/* Existing Date Overrides List */}
                  <div className="space-y-2">
                    {Object.entries(autoDjConfig.dateOverrides).map(([date, catId]) => {
                      const catName = categories.find((c) => c.id === catId)?.name || catId;
                      return (
                        <div
                          key={date}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-[#121418] border border-[#2b303a] text-xs font-mono"
                        >
                          <span className="font-bold text-amber-300">{date}</span>
                          <span className="text-zinc-300 font-semibold">Gênero Travado: {catName}</span>
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                            Sobrescreve regra semanal
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ================= ABA 3: RELATÓRIO FINANCEIRO ================= */}
            {activeTab === 'financial' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-[#181a20] border border-[#2d323e]">
                    <span className="text-[10px] uppercase font-mono text-zinc-400">Arrecadação Hoje</span>
                    <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                      R$ {financialReport.dailyRevenue.toFixed(2)}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                      {financialReport.dailyCredits} créditos inseridos
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#181a20] border border-[#2d323e]">
                    <span className="text-[10px] uppercase font-mono text-zinc-400">Arrecadação do Mês</span>
                    <div className="text-2xl font-extrabold text-amber-400 font-mono mt-1">
                      R$ {financialReport.monthlyRevenue.toFixed(2)}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                      {financialReport.monthlyCredits} créditos gerados
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#181a20] border border-[#2d323e]">
                    <span className="text-[10px] uppercase font-mono text-zinc-400">Total Histórico</span>
                    <div className="text-2xl font-extrabold text-cyan-400 font-mono mt-1">
                      {financialReport.totalCreditsInserted}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                      Músicas tocadas pagas
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#181a20] border border-[#2d323e]">
                    <span className="text-[10px] uppercase font-mono text-zinc-400">Preço Base</span>
                    <div className="text-2xl font-extrabold text-purple-400 font-mono mt-1">
                      R$ {financialReport.pricePerCredit.toFixed(2)}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                      Valor por 1 crédito de música
                    </span>
                  </div>
                </div>

                {/* Mercado Pago (Pix real com split) */}
                <div className="rounded-2xl p-5 bg-[#181a20] border border-[#2d323e] space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-sky-400 flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      <span>MERCADO PAGO — RECEBIMENTO PIX (MARKETPLACE)</span>
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                        mpStatus.connected
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                          : 'bg-zinc-900 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {mpStatus.connected ? 'CONECTADO' : 'DESCONECTADO'}
                    </span>
                  </div>

                  {!mpStatus.configured && (
                    <p className="text-xs font-mono text-amber-300">
                      Credenciais ausentes. Defina <strong>MP_CLIENT_ID</strong> e <strong>MP_CLIENT_SECRET</strong> em um
                      arquivo <strong>.env</strong> na raiz do projeto e reinicie o aplicativo.
                    </p>
                  )}

                  {mpError && (
                    <p className="text-xs font-mono text-rose-300 bg-rose-950/40 border border-rose-800 rounded-lg px-3 py-2">
                      {mpError}
                    </p>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-[#121418] border border-[#2b303a]">
                      <span className="text-zinc-500 block text-[10px] uppercase">ID Vendedor</span>
                      <strong className="text-zinc-200">{mpStatus.collectorId || '—'}</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-[#121418] border border-[#2b303a]">
                      <span className="text-zinc-500 block text-[10px] uppercase">Split Plataforma</span>
                      <strong className="text-emerald-300">{mpStatus.splitPercent}%</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-[#121418] border border-[#2b303a] col-span-2">
                      <span className="text-zinc-500 block text-[10px] uppercase">Preço por Crédito (R$)</span>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          className="w-24 px-2 py-1 rounded-lg bg-black/60 border border-white/10 text-amber-300 font-mono"
                        />
                        <button
                          onClick={savePrice}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {mpStatus.connected ? (
                      <button
                        onClick={disconnectMp}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono flex items-center gap-2"
                      >
                        <Unplug className="w-4 h-4" />
                        Desconectar Conta
                      </button>
                    ) : (
                      <button
                        onClick={connectMp}
                        disabled={!mpStatus.configured}
                        className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold font-mono flex items-center gap-2"
                      >
                        <Link2 className="w-4 h-4" />
                        Conectar Mercado Pago
                      </button>
                    )}
                    <button
                      onClick={refreshMpStatus}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold font-mono flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Atualizar Status
                    </button>
                  </div>

                  {mpAwaitingCode && !mpStatus.connected && (
                    <div className="rounded-xl p-3 bg-[#121418] border border-sky-800 space-y-2">
                      <p className="text-[11px] font-mono text-sky-300">
                        Após autorizar, o navegador irá para o seu callback. Copie a URL inteira
                        (ou apenas o <strong>code</strong>) e cole abaixo:
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={mpCodeInput}
                          onChange={(e) => setMpCodeInput(e.target.value)}
                          placeholder="https://maximo.tec.br/mp/callback/maxmusicbox?code=TG-..."
                          className="flex-1 px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-emerald-300 font-mono text-xs"
                        />
                        <button
                          onClick={completeMp}
                          disabled={!mpCodeInput.trim()}
                          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold font-mono"
                        >
                          Concluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Biblioteca de músicas */}
                <div className="rounded-2xl p-5 bg-[#181a20] border border-[#2d323e] space-y-3">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    <span>PASTA DE MÚSICAS (CATÁLOGO LOCAL)</span>
                  </h3>
                  <p className="text-xs font-mono text-zinc-300 break-all">
                    {libraryInfo.path || 'Nenhuma pasta definida'}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-500">
                    {libraryInfo.trackCount} faixa(s) indexada(s) no banco SQLite.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={pickLibraryFolder}
                      disabled={busy}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold font-mono flex items-center gap-2"
                    >
                      <FolderOpen className="w-4 h-4" />
                      Escolher Pasta & Reindexar
                    </button>
                    <button
                      onClick={rescanLibrary}
                      disabled={busy}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs font-bold font-mono flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reindexar Agora
                    </button>
                  </div>
                </div>

                {/* Transactions Table */}
                <div className="rounded-2xl p-5 bg-[#181a20] border border-[#2d323e]">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">
                    REGISTRO DE TRANSAÇÕES PIX (LOCAL SQLITE LOG)
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-[#2b303a] text-zinc-400 uppercase text-[10px]">
                          <th className="py-2 px-3">ID Transação</th>
                          <th className="py-2 px-3">Data / Hora</th>
                          <th className="py-2 px-3">Método</th>
                          <th className="py-2 px-3">Créditos</th>
                          <th className="py-2 px-3 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {financialReport.history.map((tx) => (
                          <tr key={tx.id} className="hover:bg-white/[0.02]">
                            <td className="py-2.5 px-3 text-zinc-400 font-bold">{tx.id}</td>
                            <td className="py-2.5 px-3 text-zinc-300">
                              {new Date(tx.timestamp).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                                {tx.paymentMethod}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-amber-300">
                              +{tx.credits} créditos
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                              R$ {tx.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================= ABA 4: TECLADO QUIOSQUE & MAPEAMENTO ================= */}
            {activeTab === 'kiosk' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Module 1: Shortcut Prefixes Configuration */}
                <div className="rounded-2xl p-5 bg-[#181a20] border border-[#2d323e]">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-2">
                    <Keyboard className="w-4 h-4" />
                    <span>CONFIGURAÇÃO DE ATALHOS DO TECLADO NUMÉRICO EXTERNO</span>
                  </h3>
                  <p className="text-xs text-zinc-300 mb-4">
                    Personalize os caracteres e comportamentos do teclado físico conectado via USB no quiosque.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Prefix Category */}
                    <div className="p-4 rounded-xl bg-[#121418] border border-[#2b303a]">
                      <label className="block text-xs font-mono font-bold text-amber-300 mb-1">
                        Prefixo para Seleção de Categoria:
                      </label>
                      <p className="text-[11px] text-zinc-400 mb-2">
                        Tecla que inicia a seleção rápida de categoria (ex: apertar / e depois 1 a 6)
                      </p>
                      <input
                        type="text"
                        maxLength={1}
                        value={kioskKeyboardConfig.prefixCategory}
                        onChange={(e) => setKioskKeyboardConfig({ prefixCategory: e.target.value || '/' })}
                        className="w-16 text-center py-1.5 px-2 rounded-lg bg-black/50 border border-[#3b414d] text-amber-400 font-mono font-bold text-lg focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Prefix Direct Track */}
                    <div className="p-4 rounded-xl bg-[#121418] border border-[#2b303a]">
                      <label className="block text-xs font-mono font-bold text-amber-300 mb-1">
                        Prefixo para Música Direta:
                      </label>
                      <p className="text-[11px] text-zinc-400 mb-2">
                        Tecla para digitar o código numérico da música diretamente (ex: *01, *15)
                      </p>
                      <input
                        type="text"
                        maxLength={1}
                        value={kioskKeyboardConfig.prefixTrack}
                        onChange={(e) => setKioskKeyboardConfig({ prefixTrack: e.target.value || '*' })}
                        className="w-16 text-center py-1.5 px-2 rounded-lg bg-black/50 border border-[#3b414d] text-amber-400 font-mono font-bold text-lg focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Volume Step */}
                    <div className="p-4 rounded-xl bg-[#121418] border border-[#2b303a]">
                      <label className="block text-xs font-mono font-bold text-amber-300 mb-1">
                        Passo de Ajuste do Volume (+ / -):
                      </label>
                      <p className="text-[11px] text-zinc-400 mb-2">
                        Variação percentual a cada toque nas teclas + ou - do teclado numérico
                      </p>
                      <select
                        value={kioskKeyboardConfig.volumeStep}
                        onChange={(e) => setKioskKeyboardConfig({ volumeStep: parseFloat(e.target.value) })}
                        className="py-1.5 px-3 rounded-lg bg-black/50 border border-[#3b414d] text-amber-400 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                      >
                        <option value={0.02}>2% por toque (Ajuste fino)</option>
                        <option value={0.05}>5% por toque (Padrão recomendado)</option>
                        <option value={0.10}>10% por toque (Rápido)</option>
                      </select>
                    </div>

                    {/* Enter opens Pix */}
                    <div className="p-4 rounded-xl bg-[#121418] border border-[#2b303a] flex flex-col justify-between">
                      <div>
                        <label className="block text-xs font-mono font-bold text-amber-300 mb-1">
                          Tecla ENTER Direta:
                        </label>
                        <p className="text-[11px] text-zinc-400 mb-2">
                          Se ativado, pressionar ENTER sem digitar código abre instantaneamente o modal de pagamento Pix
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer mt-2">
                        <input
                          type="checkbox"
                          checked={kioskKeyboardConfig.openPixOnEnter}
                          onChange={(e) => setKioskKeyboardConfig({ openPixOnEnter: e.target.checked })}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs font-mono text-zinc-200">
                          Habilitar abertura de PIX ao pressionar ENTER
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Module 2: Keypad Mapping Reference Table */}
                <div className="rounded-2xl p-5 bg-[#181a20] border border-[#2d323e]">
                  <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">
                    MAPA DE TECLAS DO QUIOSQUE (TECLADO NUMÉRICO FÍSICO EXTERNO)
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-[#2b303a] text-zinc-400 uppercase text-[10px]">
                          <th className="py-2 px-3">Tecla Física</th>
                          <th className="py-2 px-3">Ação Executada no Terminal</th>
                          <th className="py-2 px-3">Descrição Operacional</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-extrabold text-amber-400">/ + [1 a 6]</td>
                          <td className="py-2.5 px-3 text-zinc-200">Escolha de Categoria</td>
                          <td className="py-2.5 px-3 text-zinc-400">Filtra músicas pelo gênero musical do número</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-extrabold text-amber-400">* + [01 a 99]</td>
                          <td className="py-2.5 px-3 text-zinc-200">Música Direta</td>
                          <td className="py-2.5 px-3 text-zinc-400">Toca ou enfileira a faixa do código digitado</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-extrabold text-amber-400">[1 a 9]</td>
                          <td className="py-2.5 px-3 text-zinc-200">Cantor / Artista</td>
                          <td className="py-2.5 px-3 text-zinc-400">Seleciona o cantor/banda da tela pelo número</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-extrabold text-emerald-400">[Enter]</td>
                          <td className="py-2.5 px-3 text-zinc-200">Abrir PIX / Confirmar</td>
                          <td className="py-2.5 px-3 text-zinc-400">Abre o QR Code Pix sem créditos ou confirma código</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-extrabold text-cyan-400">[+] e [-]</td>
                          <td className="py-2.5 px-3 text-zinc-200">Controle de Volume</td>
                          <td className="py-2.5 px-3 text-zinc-400">Aumenta ou diminui o Master Gain com feedback visual HUD</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-extrabold text-zinc-300">[0] ou [5]</td>
                          <td className="py-2.5 px-3 text-zinc-200">Play / Pausa / Repetir</td>
                          <td className="py-2.5 px-3 text-zinc-400">Alterna reprodução e pausa da música em execução</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-extrabold text-zinc-300">[6] e [4]</td>
                          <td className="py-2.5 px-3 text-zinc-200">Avançar / Reiniciar</td>
                          <td className="py-2.5 px-3 text-zinc-400">Pula para a próxima da fila ou reinicia faixa atual</td>
                        </tr>
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-extrabold text-zinc-300">[.] ou [Esc]</td>
                          <td className="py-2.5 px-3 text-zinc-200">Limpar / Voltar</td>
                          <td className="py-2.5 px-3 text-zinc-400">Cancela digitação ou fecha modais</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================= ABA 5: TOCAR AUTOMÁTICO (ADMIN FREE PLAY) ================= */}
            {activeTab === 'autoplay' && (
              <div className="space-y-6">
                <div className="bg-[#121418] border border-emerald-800/60 rounded-xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500">
                        <Play className="w-5 h-5 fill-current" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-emerald-400 uppercase tracking-wide">
                          Seleção & Reprodução Automática (Operador / Admin)
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Toque ou enfileire qualquer faixa imediatamente sem dedução de créditos (bypass total).
                        </p>
                      </div>
                    </div>

                    {currentTrack && (
                      <div className="px-3 py-1.5 rounded-lg bg-[#181b22] border border-emerald-700/50 flex items-center gap-2 text-xs">
                        <span className="text-zinc-400">Tocando agora:</span>
                        <strong className="text-emerald-300 font-bold">{currentTrack.title}</strong>
                        <span className="text-zinc-500">({currentTrack.artist})</span>
                      </div>
                    )}
                  </div>

                  {/* Filters & Search */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-mono text-zinc-400 mb-1">Buscar por Título ou Artista:</label>
                      <input
                        type="text"
                        value={adminSearchTerm}
                        onChange={(e) => setAdminSearchTerm(e.target.value)}
                        placeholder="Ex: Raul Seixas, Evidências..."
                        className="w-full bg-[#1b1e25] border border-[#2e3340] rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-zinc-400 mb-1">Filtrar por Categoria:</label>
                      <select
                        value={adminSelectedCat}
                        onChange={(e) => setAdminSelectedCat(e.target.value)}
                        className="w-full bg-[#1b1e25] border border-[#2e3340] rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="all">Todas as Categorias ({tracks.length} músicas)</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Track Table */}
                  <div className="max-h-96 overflow-y-auto border border-[#2b303b] rounded-lg">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead className="sticky top-0 bg-[#16181f] border-b border-[#2b303a] text-zinc-400 uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Cód</th>
                          <th className="py-2.5 px-3">Título & Artista</th>
                          <th className="py-2.5 px-3">Gênero</th>
                          <th className="py-2.5 px-3 text-right">Ação Admin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {tracks
                          .filter((t) => {
                            const matchCat = adminSelectedCat === 'all' || t.category === adminSelectedCat;
                            const matchSearch =
                              t.title.toLowerCase().includes(adminSearchTerm.toLowerCase()) ||
                              t.artist.toLowerCase().includes(adminSearchTerm.toLowerCase()) ||
                              t.code.includes(adminSearchTerm);
                            return matchCat && matchSearch;
                          })
                          .map((track) => (
                            <tr key={track.id} className="hover:bg-emerald-950/20 transition-colors">
                              <td className="py-2 px-3 font-extrabold text-amber-400">
                                *{track.code}
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={track.albumArt}
                                    alt={track.title}
                                    className="w-7 h-7 rounded object-cover"
                                  />
                                  <div>
                                    <p className="font-bold text-zinc-100">{track.title}</p>
                                    <p className="text-[11px] text-zinc-400">{track.artist}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-zinc-400 uppercase text-[10px]">
                                {track.category}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => addToQueue(track, 'Admin (Operador)')}
                                    className="px-2.5 py-1 rounded bg-[#202530] text-zinc-300 hover:text-white border border-[#333a4a] text-xs font-bold transition-all active:scale-95 flex items-center gap-1"
                                    title="Adicionar à fila como Admin"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Fila</span>
                                  </button>
                                  <button
                                    onClick={() => playTrack(track, 'Admin (Operador)')}
                                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-extrabold transition-all active:scale-95 flex items-center gap-1 shadow-md"
                                    title="Tocar Imediatamente (Free)"
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>Tocar Agora</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================= ABA 6: USUÁRIOS & ACESSO POR SENHA ================= */}
            {activeTab === 'users' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="rounded-2xl p-5 bg-[#181a20] border border-[#2d323e]">
                  <div className="flex items-center justify-between mb-1 border-b border-white/5 pb-2">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>CONTAS DE USUÁRIOS (ACESSO POR SENHA ÚNICA)</span>
                    </h3>
                    <span className="text-[10px] font-mono text-zinc-500">{users.length} conta(s)</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-4">
                    Cada usuário tem uma senha exclusiva. No terminal, a senha digitada libera o saldo da
                    conta para tocar músicas (o crédito é descontado da conta). O Pix continua recarregando o
                    crédito global do terminal.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                    {/* Formulário cadastro/edição */}
                    <div className="p-4 rounded-xl bg-[#121418] border border-[#2b303a] md:col-span-1 space-y-3">
                      <div className="flex items-center gap-2">
                        {editingUserId ? (
                          <Pencil className="w-4 h-4 text-amber-400" />
                        ) : (
                          <UserRoundPlus className="w-4 h-4 text-cyan-400" />
                        )}
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {editingUserId ? 'EDITAR USUÁRIO' : 'NOVO USUÁRIO'}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-zinc-400 mb-1">Nome</label>
                        <input
                          type="text"
                          value={userForm.name}
                          onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                          placeholder="Ex: João da Silva"
                          className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-sm text-cyan-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                          Senha {editingUserId && '(vazio = manter atual)'}
                        </label>
                        <input
                          type="password"
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          placeholder="Senha exclusiva para tocar"
                          className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-sm text-cyan-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-zinc-400 mb-1">
                          Créditos (saldo inicial)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={userForm.credits}
                          onChange={(e) => setUserForm({ ...userForm, credits: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-sm text-amber-300 font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      {userFormError && (
                        <p className="text-[11px] font-mono text-rose-300 bg-rose-950/40 border border-rose-800 rounded-lg px-3 py-2">
                          {userFormError}
                        </p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleSaveUser}
                          className="flex-1 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold font-mono flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {editingUserId ? 'Salvar' : 'Cadastrar'}
                        </button>
                        {editingUserId && (
                          <button
                            onClick={resetUserForm}
                            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold font-mono"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Lista de usuários */}
                    <div className="p-4 rounded-xl bg-[#121418] border border-[#2b303a] md:col-span-2">
                      <div className="max-h-[420px] overflow-y-auto pr-1 space-y-2">
                        {users.length === 0 && (
                          <p className="text-xs font-mono text-zinc-500 text-center py-8">
                            Nenhum usuário cadastrado. Cadastre a primeira conta acima.
                          </p>
                        )}
                        {users.map((u) => (
                          <div
                            key={u.id}
                            className="p-3 rounded-xl bg-[#16181f] border border-[#2b303a] flex flex-wrap items-center gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-sm text-cyan-100 truncate">{u.name}</p>
                              <div className="flex items-center gap-3 mt-0.5 text-[11px] font-mono text-zinc-400">
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                  <Coins className="w-3 h-3" />
                                  {u.credits} cr
                                </span>
                                <span>
                                  desde {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {creditTopUp?.id === u.id ? (
                                <div className="flex items-center gap-1.5" key={u.id}>
                                  <input
                                    type="number"
                                    min={1}
                                    value={creditTopUp.credits}
                                    onChange={(e) =>
                                      setCreditTopUp({ id: u.id, credits: e.target.value })
                                    }
                                    className="w-20 px-2 py-1 rounded-lg bg-black/60 border border-emerald-700 text-emerald-300 font-mono text-xs"
                                  />
                                  <button
                                    onClick={() => handleTopUp(u.id)}
                                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold font-mono"
                                  >
                                    OK
                                  </button>
                                  <button
                                    onClick={() => setCreditTopUp(null)}
                                    className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-[10px] font-bold font-mono"
                                  >
                                    X
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setCreditTopUp({ id: u.id, credits: '10' })}
                                  className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[10px] font-bold font-mono hover:bg-emerald-900"
                                  title="Adicionar créditos à conta"
                                >
                                  + Créditos
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setEditingUserId(u.id);
                                  setUserForm({ name: u.name, password: '', credits: String(u.credits) });
                                  setUserFormError(null);
                                }}
                                className="p-1.5 rounded bg-[#202530] text-zinc-300 hover:text-white border border-[#333a4a] transition-colors"
                                title="Editar usuário"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                className="p-1.5 rounded bg-rose-950 text-rose-300 border border-rose-800/60 hover:bg-rose-900 transition-colors"
                                title="Excluir usuário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
