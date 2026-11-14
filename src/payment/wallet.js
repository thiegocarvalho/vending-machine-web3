import { encodeBuyCard } from '../data/rpc.js';

export class PaymentError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

export const hasWallet = (win) => !!win?.ethereum?.request;

const hex = (n) => '0x' + BigInt(n).toString(16);
const chainParams = (cfg) => ({
  chainId: hex(cfg.chainId), chainName: cfg.chainName || 'Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: [cfg.rpcUrl || 'https://ethereum-sepolia-rpc.publicnode.com'],
  ...(cfg.explorer ? { blockExplorerUrls: [cfg.explorer] } : {})
});

// Garante que a carteira esteja na rede do jogo: troca; se ela não conhece a rede, pede para adicionar.
export async function ensureChain(eth, cfg) {
  const chain = await eth.request({ method: 'eth_chainId' });
  if (parseInt(chain, 16) === cfg.chainId) return;
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex(cfg.chainId) }] });
  } catch (e) {
    if (e.code !== 4902) throw e;
    await eth.request({ method: 'wallet_addEthereumChain', params: [chainParams(cfg)] });
  }
}

export async function payWithWallet(win, cfg, cardId, priceWei, stock) {
  if (!hasWallet(win)) throw new PaymentError('no_wallet', 'Nenhuma carteira encontrada no navegador');
  if (stock <= 0) throw new PaymentError('sold_out', 'Card esgotado');
  const eth = win.ethereum;
  try {
    const [from] = await eth.request({ method: 'eth_requestAccounts' });
    await ensureChain(eth, cfg);
    const data = encodeBuyCard(cardId);
    const hash = await eth.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: cfg.contractAddress, data, value: hex(priceWei) }]
    });
    return { hash, from };
  } catch (e) {
    if (e instanceof PaymentError) throw e;
    if (e.code === 4001) throw new PaymentError('user_rejected', 'Transação rejeitada na carteira');
    if (/insufficient funds/i.test(e.message || '')) throw new PaymentError('no_funds', 'Saldo insuficiente');
    throw new PaymentError('failed', e.shortMessage || e.message || 'Falha ao enviar a transação');
  }
}
