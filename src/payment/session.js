import { hasWallet, ensureChain } from './wallet.js';

const KEY_OFF = 'dvm.wallet.off';       // o jogador clicou em "desconectar": não reconectar sozinho ao abrir o inventário
const safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

// Estado da carteira para a interface. Estados: demo | nowallet | disconnected | connecting | connected | wrongnet | readonly
export function walletStatus({ demo = false, hasWallet: hw = false, address = null, source = null, chainId = null, wantedChain = null, connecting = false } = {}) {
  if (demo) return 'demo';
  if (connecting) return 'connecting';
  if (address) {
    if (source === 'wallet' && hw) return chainId !== null && chainId !== wantedChain ? 'wrongnet' : 'connected';
    return 'readonly';                                           // endereço colado: só leitura
  }
  return hw ? 'disconnected' : 'nowallet';
}

// Sessão com a carteira do navegador (EIP-1193). "Desconectar" é local: dapps não conseguem desconectar a extensão, então
// esquecemos o endereço, marcamos para não reconectar sozinho e, se a carteira suportar, revogamos a permissão do site.
export function createWalletSession({ win = window, cfg, storage = globalThis.localStorage } = {}) {
  const eth = () => win?.ethereum;
  return {
    get available() { return hasWallet(win); },
    get dismissed() { return !!safe(() => storage.getItem(KEY_OFF), null); },
    async chainId() { try { return parseInt(await eth().request({ method: 'eth_chainId' }), 16); } catch { return null; } },
    // lê a conta já autorizada, sem abrir pop-up (e sem religar o que o jogador desconectou)
    async silentAccount() {
      if (!hasWallet(win) || this.dismissed) return null;
      try { const [a] = await eth().request({ method: 'eth_accounts' }); return a || null; } catch { return null; }
    },
    clearDismissed() { safe(() => storage.removeItem(KEY_OFF)); },     // pagar com a carteira também conta como conectar
    async connect() {
      const [a] = await eth().request({ method: 'eth_requestAccounts' });
      safe(() => storage.removeItem(KEY_OFF));
      return a;
    },
    async disconnect() {
      safe(() => storage.setItem(KEY_OFF, '1'));
      try { await eth()?.request?.({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch { /* nem toda carteira suporta */ }
    },
    switchNetwork: () => ensureChain(eth(), cfg),
    // eventos da extensão; devolve a função que cancela a escuta
    onChange(cb) {
      const e = eth(); if (!e?.on) return () => {};
      const acc = (accounts) => cb({ type: 'accounts', accounts }), chain = () => cb({ type: 'chain' });
      e.on('accountsChanged', acc); e.on('chainChanged', chain);
      return () => { e.removeListener?.('accountsChanged', acc); e.removeListener?.('chainChanged', chain); };
    }
  };
}
