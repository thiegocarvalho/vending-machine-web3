import { encodeBuyCard, encodeSafeTransferFrom, explainError } from '../data/rpc.js';

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
    if (e.code === 4001) throw e;      // recusou; qualquer outro erro (4902 ou -32603 "rede desconhecida", conforme a carteira) tenta adicionar
    await eth.request({ method: 'wallet_addEthereumChain', params: [chainParams(cfg)] });
  }
}

// Erro da carteira -> PaymentError com mensagem clara. Prioridade: recusa do usuário, erro do contrato (decodificado), saldo, genérico.
function toPaymentError(e, rejectedMsg, failedMsg) {
  if (e instanceof PaymentError) return e;
  if (e?.code === 4001) return new PaymentError('user_rejected', rejectedMsg);
  const friendly = explainError(e);
  if (friendly) return new PaymentError('contract', friendly);
  if (/insufficient funds/i.test(e?.message || '')) return new PaymentError('no_funds', 'Saldo insuficiente para o valor + taxa de rede.');
  return new PaymentError('failed', e?.shortMessage || e?.message || failedMsg);
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
  } catch (e) { throw toPaymentError(e, 'Transação rejeitada na carteira', 'Falha ao enviar a transação'); }
}

// Envia `amount` unidades do card `id` para `to` (ERC-1155 safeTransferFrom). Irreversível: a validação e o aviso ficam na interface.
export async function transferWithWallet(win, cfg, { from, to, id, amount }) {
  if (!hasWallet(win)) throw new PaymentError('no_wallet', 'Nenhuma carteira encontrada no navegador');
  const eth = win.ethereum;
  try {
    await ensureChain(eth, cfg);
    const hash = await eth.request({ method: 'eth_sendTransaction', params: [{ from, to: cfg.contractAddress, data: encodeSafeTransferFrom(from, to, id, amount) }] });
    return { hash };
  } catch (e) { throw toPaymentError(e, 'Envio rejeitado na carteira', 'Falha ao enviar o card'); }
}
