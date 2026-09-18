const PALETTE = [
  '#06b6d4',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ef4444',
  '#3b82f6',
  '#eab308'
];

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '\u266B';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Gera um data URI SVG determinístico para uso quando a faixa/artista/categoria
 * não possui capa embutida nos metadados.
 */
export function placeholderArt(seed: string, label = ''): string {
  const color = PALETTE[hash(seed) % PALETTE.length];
  const text = escapeXml(initials(label || seed));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="#0f172a"/>
</linearGradient></defs>
<rect width="240" height="240" fill="url(#g)"/>
<circle cx="120" cy="120" r="72" fill="rgba(2,6,23,0.45)" stroke="rgba(255,255,255,0.35)" stroke-width="3"/>
<text x="120" y="138" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="64" font-weight="700" fill="#f8fafc">${text}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function ensureArt(art: string | undefined, seed: string, label = ''): string {
  if (art && art.trim().length > 0) return art;
  return placeholderArt(seed, label);
}
