import React, { useState, useRef } from 'react';

interface RotaryKnobProps {
  label: string;
  value: number; // e.g. -12 to +12
  min: number;
  max: number;
  step?: number;
  unit?: string;
  size?: number;
  onChange: (val: number) => void;
  onCommit?: (val: number) => void;
  color?: string;
}

export const RotaryKnob = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'dB',
  size = 54,
  onChange,
  onCommit,
  color = '#f59e0b'
}: RotaryKnobProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(value);

  // Map value range to rotation angle: -135deg (min) to +135deg (max) -> 270 deg total sweep
  const normalized = (value - min) / (max - min);
  const angle = -135 + normalized * 270;

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dy = startYRef.current - e.clientY; // positive = dragging up = increase
    const pixelRange = 150; // pixels to sweep from min to max
    const deltaVal = (dy / pixelRange) * (max - min);
    let newVal = startValRef.current + deltaVal;

    // Apply step
    if (step) {
      newVal = Math.round(newVal / step) * step;
    }
    newVal = Math.max(min, Math.min(max, newVal));
    onChange(newVal);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      if (onCommit) onCommit(value);
    }
  };

  return (
    <div className="flex flex-col items-center select-none touch-none">
      {/* Knob Dial */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative flex items-center justify-center cursor-ns-resize group"
        style={{ width: size, height: size }}
        title={`${label}: ${value} ${unit} (Arraste para cima/baixo)`}
      >
        {/* Outer Bezel */}
        <div className="absolute inset-0 rounded-full border border-[#424754] bg-gradient-to-b from-[#2a2e37] to-[#16181d] shadow-md group-hover:border-amber-500/50" />

        {/* Circular tick track indicator */}
        <svg className="absolute inset-[-4px] pointer-events-none" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="3"
            strokeDasharray="207"
            strokeDashoffset="69"
            strokeLinecap="round"
            transform="rotate(135 50 50)"
          />
        </svg>

        {/* Inner Rotating Face */}
        <div
          className="relative rounded-full bg-gradient-to-b from-[#383d49] via-[#20232a] to-[#181a1f] shadow-inner flex items-center justify-center"
          style={{
            width: size - 10,
            height: size - 10,
            transform: `rotate(${angle}deg)`
          }}
        >
          {/* Top Pointer Notch / Indicator line */}
          <div
            className="absolute top-1 w-1 rounded-full shadow-sm"
            style={{
              height: size * 0.28,
              backgroundColor: color,
              boxShadow: `0 0 6px ${color}`
            }}
          />
          {/* Center metal cap */}
          <div className="w-3 h-3 rounded-full bg-[#121417] border border-white/10" />
        </div>
      </div>

      {/* Label and Value */}
      <span className="text-[10px] uppercase font-mono font-bold tracking-wider mt-1.5 opacity-80 truncate max-w-[70px] text-center">
        {label}
      </span>
      <span
        className="text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-black/40 border border-white/5 mt-0.5"
        style={{ color }}
      >
        {value > 0 ? `+${value}` : value} {unit}
      </span>
    </div>
  );
};
