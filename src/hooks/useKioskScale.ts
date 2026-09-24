import { useEffect, useState } from 'react';

// Canvas fixo do design do kiosk (1920x1080): a UI inteira é escalada para caber
// em qualquer resolução, evitando conteúdo esticado/fora da área clicável.
const DESIGN_W = 1920;
const DESIGN_H = 1080;

export function useKioskScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w <= 0 || h <= 0) return;
      setScale(Math.max(Math.min(w / DESIGN_W, h / DESIGN_H), 0.05));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  return { scale, kioskW: DESIGN_W, kioskH: DESIGN_H };
}