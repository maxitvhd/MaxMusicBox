import { useEffect, useRef, useState } from 'react';
import { useJukeboxStore } from '../store/useJukeboxStore';

interface VuMeterProps {
  channel: 'left' | 'right';
  label?: string;
  size?: 'mini' | 'compact' | 'large';
}

export const VuMeter = ({ channel, label, size = 'mini' }: VuMeterProps) => {
  const theme = useJukeboxStore((s) => s.theme);

  // Animação feita direto no DOM (60fps) — sem re-render do React por frame.
  const needleRef = useRef<HTMLDivElement>(null);
  const currentAngleRef = useRef<number>(-45);
  const overloadRef = useRef(false);
  const [peakOverload, setPeakOverload] = useState(false);

  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();

    const updatePhysics = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Lê o sinal atual do DSP direto da store (sem assinatura reativa).
      const levels = useJukeboxStore.getState().audioLevels;
      const raw = channel === 'left' ? levels.left : levels.right;
      const pk = channel === 'left' ? levels.peakLeft : levels.peakRight;

      // RMS linear -> dB: -50dB (fim esquerdo) .. +3dB (fim direito).
      const db = raw > 1e-6 ? 20 * Math.log10(raw) : -60;
      const clamped = Math.max(-50, Math.min(3, db));
      const targetDeg = -45 + ((clamped + 50) / 53) * 90;

      // Ballistics: ataque rápido (~20ms) e decaimento viscoso (~300ms).
      const current = currentAngleRef.current;
      const speed = targetDeg > current ? 48 : 7.5;
      currentAngleRef.current += (targetDeg - current) * Math.min(1, speed * dt);

      if (needleRef.current) {
        needleRef.current.style.transform = `rotate(${currentAngleRef.current.toFixed(2)}deg)`;
      }

      // Overload real: pico acima de ~-1dB (zona vermelha do mostrador).
      const pkDb = pk > 1e-6 ? 20 * Math.log10(pk) : -60;
      const isOver = pkDb > -1;
      if (isOver !== overloadRef.current) {
        overloadRef.current = isOver;
        setPeakOverload(isOver);
      }

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, [channel]);

  // Sizing configurations
  const dimensions = {
    mini: { width: 90, height: 50, scale: 0.55 },
    compact: { width: 140, height: 75, scale: 0.8 },
    large: { width: 260, height: 145, scale: 1.5 }
  }[size];

  const isVintage = theme === 'amp-vintage';

  return (
    <div
      className={`relative inline-flex flex-col items-center select-none rounded-lg p-1.5 transition-colors duration-200 ${
        isVintage
          ? 'bg-[#181a1f] border border-[#373c46] shadow-inner'
          : 'bg-[#090d16] border border-cyan-950/80 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
      }`}
      style={{ width: dimensions.width }}
    >
      {/* Label and Overload LED */}
      <div className="w-full flex items-center justify-between px-1 mb-0.5 text-[9px] uppercase font-mono tracking-wider font-semibold">
        <span className={isVintage ? 'text-amber-500' : 'text-cyan-400'}>
          {label || (channel === 'left' ? 'VU CH-L' : 'VU CH-R')}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[7px] text-zinc-400">PEAK</span>
          <div
            className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${
              peakOverload
                ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                : 'bg-red-950 opacity-40'
            }`}
          />
        </div>
      </div>

      {/* Analog Face */}
      <div
        className={`relative overflow-hidden rounded border w-full flex justify-center items-end ${
          isVintage
            ? 'bg-gradient-to-b from-[#f2e6cb] to-[#dfce9f] border-[#2c271e] text-[#1f1a14]'
            : 'bg-gradient-to-b from-[#0b1424] to-[#040810] border-cyan-900/60 text-cyan-300'
        }`}
        style={{ height: dimensions.height }}
      >
        {/* Dial Scale Background SVG */}
        <svg
          viewBox="0 0 160 90"
          className="w-full h-full absolute inset-0 pointer-events-none"
        >
          {/* Arc path */}
          <path
            d="M 20 75 A 70 70 0 0 1 140 75"
            fill="none"
            stroke={isVintage ? '#453a2a' : '#164e63'}
            strokeWidth="1.5"
          />

          {/* Red Overload Arc Section (0dB to +3dB) */}
          <path
            d="M 116 38 A 70 70 0 0 1 140 75"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
          />

          {/* Dial scale markings */}
          {/* -20 dB */}
          <line x1="22" y1="72" x2="28" y2="69" stroke={isVintage ? '#2d2417' : '#22d3ee'} strokeWidth="1.5" />
          {/* -10 dB */}
          <line x1="42" y1="46" x2="47" y2="48" stroke={isVintage ? '#2d2417' : '#22d3ee'} strokeWidth="1.5" />
          {/* -5 dB */}
          <line x1="68" y1="30" x2="70" y2="35" stroke={isVintage ? '#2d2417' : '#22d3ee'} strokeWidth="1.5" />
          {/* 0 dB (Critical transition) */}
          <line x1="116" y1="38" x2="112" y2="42" stroke="#ef4444" strokeWidth="2" />
          {/* +3 dB */}
          <line x1="138" y1="72" x2="132" y2="69" stroke="#ef4444" strokeWidth="2" />

          {/* Scale Text Labels */}
          <text x="24" y="62" fontSize="7" fontFamily="monospace" fill={isVintage ? '#4a3d2c' : '#0891b2'} fontWeight="bold">-20</text>
          <text x="46" y="42" fontSize="7" fontFamily="monospace" fill={isVintage ? '#4a3d2c' : '#0891b2'} fontWeight="bold">-10</text>
          <text x="75" y="32" fontSize="7" fontFamily="monospace" fill={isVintage ? '#4a3d2c' : '#0891b2'} fontWeight="bold">-3</text>
          <text x="110" y="34" fontSize="8" fontFamily="monospace" fill="#ef4444" fontWeight="bold">0</text>
          <text x="130" y="62" fontSize="7" fontFamily="monospace" fill="#ef4444" fontWeight="bold">+3</text>

          <text x="70" y="58" fontSize="6.5" fontFamily="sans-serif" letterSpacing="1" fill={isVintage ? '#69573f' : '#0e7490'}>
            VU dB
          </text>
        </svg>

        {/* Needle: pivô explícito no centro da base (rotação via DOM) */}
        <div
          ref={needleRef}
          className="absolute left-1/2 pointer-events-none"
          style={{
            bottom: -10,
            width: 0,
            height: dimensions.height * 0.82,
            transform: 'rotate(-45deg)',
            transformOrigin: 'bottom center'
          }}
        >
          <div
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[1.5px] rounded-t ${
              isVintage ? 'bg-[#15120c]' : 'bg-[#f43f5e] shadow-[0_0_6px_#f43f5e]'
            }`}
            style={{ height: '100%' }}
          />
        </div>

        {/* Mechanical Pivot Cap */}
        <div
          className={`absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border ${
            isVintage
              ? 'bg-[#2b251a] border-[#524430] shadow'
              : 'bg-[#0f172a] border-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]'
          }`}
        />
      </div>
    </div>
  );
};
