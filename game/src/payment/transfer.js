import { isAddress } from '../data/inventory.js';

const ZERO = '0x0000000000000000000000000000000000000000';

// Valida um envio de card antes de pedir a assinatura. Retorna { ok:true, to, amount } ou { ok:false, error } em português.
export function validateSend({ to, amount, balance, from, paused = false, status = 'connected' }) {
  if (status !== 'connected') {
    const why = { demo: 'No modo demo não há envio.', nowallet: 'Instale uma carteira para enviar cards.', disconnected: 'Conecte a carteira para enviar.', connecting: 'Aguarde a carteira conectar.', wrongnet: 'Troque a carteira para a rede do jogo.', readonly: 'Conecte a carteira (não só consultar o endereço) para enviar.' };
    return { ok: false, error: why[status] || 'Carteira indisponível.' };
  }
  if (paused) return { ok: false, error: 'A máquina está pausada: envios suspensos.' };
  const dest = String(to || '').trim();
  if (!isAddress(dest)) return { ok: false, error: 'Endereço inválido: use 0x seguido de 40 caracteres.' };
  if (dest.toLowerCase() === ZERO) return { ok: false, error: 'Não envie para o endereço zero: o card seria destruído.' };
  if (from && dest.toLowerCase() === from.toLowerCase()) return { ok: false, error: 'O destinatário é a sua própria carteira.' };
  const n = Number(amount);
  if (!Number.isInteger(n) || n < 1) return { ok: false, error: 'Quantidade inválida.' };
  if (n > balance) return { ok: false, error: `Você só tem ${balance} deste card.` };
  return { ok: true, to: dest, amount: n };
}
