// Níveis de qualidade e resolução dinâmica (aparelho fraco => menos pixels, mesma cena).
export const TIERS = {
  low:    { dprCap: 1,   antialias: false, texW: 150, texH: 200 },
  medium: { dprCap: 1.5, antialias: false, texW: 300, texH: 400 },
  high:   { dprCap: 2,   antialias: true,  texW: 300, texH: 400 }
};
// Níveis da resolução dinâmica (fração da densidade de pixels): 0 = cheia, depois degraus menores.
export const RESOLUTION_LEVELS = [1, 0.85, 0.7, 0.55];

export function pickTier({ deviceMemory, hardwareConcurrency } = {}) {
  if ((deviceMemory && deviceMemory <= 2) || (hardwareConcurrency && hardwareConcurrency <= 2)) return 'low';
  if (deviceMemory >= 8 && hardwareConcurrency >= 8) return 'high';
  return 'medium';
}

export function detectTier(nav = typeof navigator !== 'undefined' ? navigator : {}) {
  const forced = typeof location !== 'undefined' && new URLSearchParams(location.search).get('quality');
  if (forced && TIERS[forced]) return forced;
  return pickTier({ deviceMemory: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency });
}

// Recebe o tempo (ms) de cada quadro desenhado; sobe o nível (menos pixels) se ficar lento e desce de volta com folga sustentada.
export function createAdaptiveScale({ base, max = 8, onChange = () => {}, windowSize = 45, slowMs = 24, fastMs = 13, calmWindows = 3 }) {
  let scale = base, sum = 0, n = 0, calm = 0;
  function change(v) { scale = v; sum = 0; n = 0; calm = 0; onChange(v); }
  return {
    get scale() { return scale; },
    sample(ms) {
      if (ms > 250) return;                    // soluço (aba em segundo plano, carregamento): não conta
      sum += ms; n++;
      if (n < windowSize) return;
      const avg = sum / n; sum = 0; n = 0;
      if (avg > slowMs && scale < max) return change(scale + 1);
      if (avg < fastMs && scale > base) { if (++calm >= calmWindows) change(scale - 1); } else calm = 0;
    }
  };
}
