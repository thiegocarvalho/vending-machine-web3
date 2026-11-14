// Links externos do contrato/cards. O OpenSea descontinuou as testnets (jul/2025), então o card é visto no explorer da rede
// (Etherscan: página NFT do token). O explorer vem da configuração e fica vazio na rede local.
export const SEPOLIA = 11155111;

export function explorerNftUrl(cfg, id) {
  return cfg.explorer && cfg.contractAddress ? `${cfg.explorer}/nft/${cfg.contractAddress}/${id}` : null;
}
export function explorerAddressUrl(cfg, address = cfg.contractAddress) {
  return cfg.explorer && address ? `${cfg.explorer}/address/${address}` : null;
}
export function explorerTxUrl(cfg, hash) {
  return cfg.explorer && hash ? `${cfg.explorer}/tx/${hash}` : null;
}
export const shortAddress = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
