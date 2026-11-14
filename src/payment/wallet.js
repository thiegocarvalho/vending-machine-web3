import { encodeFunctionData } from 'viem';
import { ABI } from '../data/chain.js';

export class PaymentError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

export const hasWallet = (win) => !!win?.ethereum?.request;

const hex = (n) => '0x' + BigInt(n).toString(16);
const SEPOLIA_PARAMS = {
  chainId: '0xaa36a7', chainName: 'Sepolia', nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com'], blockExplorerUrls: ['https://sepolia.etherscan.io']
};

export async function payWithWallet(win, cfg, cardId, priceWei, stock) {
  if (!hasWallet(win)) throw new PaymentError('no_wallet', 'Nenhuma carteira encontrada no navegador');
  if (stock <= 0) throw new PaymentError('sold_out', 'Card esgotado');
  const eth = win.ethereum;
  try {
    const [from] = await eth.request({ method: 'eth_requestAccounts' });
    const chain = await eth.request({ method: 'eth_chainId' });
    if (parseInt(chain, 16) !== cfg.chainId) {
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex(cfg.chainId) }] });
      } catch (e) {
        if (e.code !== 4902) throw e;
        await eth.request({ method: 'wallet_addEthereumChain', params: [SEPOLIA_PARAMS] });
      }
    }
    const data = encodeFunctionData({ abi: ABI, functionName: 'buyCard', args: [BigInt(cardId)] });
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
