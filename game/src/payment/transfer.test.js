import { describe, it, expect } from 'vitest';
import { validateSend } from './transfer.js';

const ME = '0xa78276259faC49aF008Be85D855e0Cb0F1aD9433', YOU = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const ok = { to: YOU, amount: 1, balance: 3, from: ME };

describe('validateSend', () => {
  it('aceita um envio válido', () => { expect(validateSend(ok)).toEqual({ ok: true, to: YOU, amount: 1 }); });
  it('só envia com carteira conectada na rede certa', () => {
    for (const status of ['demo', 'nowallet', 'disconnected', 'connecting', 'wrongnet', 'readonly']) { const r = validateSend({ ...ok, status }); expect(r.ok).toBe(false); expect(r.error).toBeTruthy(); }
  });
  it('bloqueia com a máquina pausada (o contrato recusa transferências)', () => { expect(validateSend({ ...ok, paused: true }).error).toMatch(/pausada/i); });
  it('endereço inválido, zero, ou o próprio remetente', () => {
    expect(validateSend({ ...ok, to: '0x123' }).error).toMatch(/inválido/i);
    expect(validateSend({ ...ok, to: '' }).ok).toBe(false);
    expect(validateSend({ ...ok, to: '0x0000000000000000000000000000000000000000' }).error).toMatch(/zero/i);
    expect(validateSend({ ...ok, to: ME.toLowerCase() }).error).toMatch(/própria/i);        // compara sem diferenciar maiúsculas
  });
  it('quantidade: inteira, de 1 até o saldo', () => {
    for (const amount of [0, -1, 1.5, 'abc', NaN]) expect(validateSend({ ...ok, amount }).ok).toBe(false);
    expect(validateSend({ ...ok, amount: 4 }).error).toMatch(/só tem 3/);
    expect(validateSend({ ...ok, amount: '3' })).toMatchObject({ ok: true, amount: 3 });
  });
  it('espaços em volta do endereço colado são ignorados', () => { expect(validateSend({ ...ok, to: `  ${YOU}\n` }).ok).toBe(true); });
});
