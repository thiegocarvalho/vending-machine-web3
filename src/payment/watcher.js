import { publicClient, ABI } from '../data/chain.js';
import { config } from '../config.js';

// Polls CardPurchased logs for a card (optionally filtered by buyer) and calls back once.
export function watchPurchase(cardId, buyer) {
  let cb = null;
  const stop = publicClient.watchContractEvent({
    address: config.contractAddress, abi: ABI, eventName: 'CardPurchased',
    args: { cardId: BigInt(cardId), ...(buyer ? { buyer } : {}) },
    pollingInterval: 4000,
    onLogs: (logs) => { if (cb && logs.length) cb({ hash: logs[0].transactionHash, buyer: logs[0].args.buyer }); }
  });
  return { on(fn) { cb = fn; }, stop };
}
