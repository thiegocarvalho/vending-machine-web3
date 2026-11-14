// Níveis de qualidade e escala de pixel adaptativa (aparelho fraco => pixels maiores, mesmo visual PS1).
export const TIERS = {
  low:    { pixelScale: 5, texW: 150, texH: 200 },
  medium: { pixelScale: 4, texW: 300, texH: 400 },
  high:   { pixelScale: 3, texW: 300, texH: 400 }
};

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

// Recebe o tempo (ms) de cada quadro desenhado; sobe a escala se ficar lento e desce de volta com folga sustentada.
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
