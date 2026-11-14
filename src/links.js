// Links externos do contrato/cards. OpenSea de testes só existe na Sepolia; o explorer vem da configuração (vazio na rede local).
export const SEPOLIA = 11155111;

export function openseaCardUrl(cfg, id) {
  if (cfg.chainId !== SEPOLIA || !cfg.contractAddress) return null;
  return `https://testnets.opensea.io/assets/sepolia/${cfg.contractAddress}/${id}`;
}
export function explorerAddressUrl(cfg, address = cfg.contractAddress) {
  return cfg.explorer && address ? `${cfg.explorer}/address/${address}` : null;
}
export function explorerTxUrl(cfg, hash) {
  return cfg.explorer && hash ? `${cfg.explorer}/tx/${hash}` : null;
}
export const shortAddress = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
