export function idToHex(id) { return id.toString(16).padStart(64, '0'); }

export function ipfsToHttp(uri, gateway) {
  return uri.startsWith('ipfs://') ? gateway + uri.slice('ipfs://'.length) : uri;
}

export async function fetchIpfs(uri, gateways, { timeoutMs = 8000, as = 'json', fetchImpl = fetch } = {}) {
  const errors = [];
  for (const gw of gateways) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(ipfsToHttp(uri, gw), { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await (as === 'blob' ? res.blob() : res.json());
    } catch (e) {
      errors.push(`${gw}: ${e.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`All IPFS gateways failed: ${errors.join(' | ')}`);
}
