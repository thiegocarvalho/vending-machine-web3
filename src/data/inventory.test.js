import { describe, it, expect, vi } from 'vitest';
import { createInventory, isAddress } from './inventory.js';
import { encodeFunctionResult, parseAbi } from 'viem';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const ADDR = '0xa78276259faC49aF008Be85D855e0Cb0F1aD9433';
const real = { demoMode: false, contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3' };
const abi = parseAbi(['function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])']);

describe('inventário', () => {
  it('valida endereços', () => {
    expect(isAddress(ADDR)).toBe(true); expect(isAddress('0x123')).toBe(false); expect(isAddress(null)).toBe(false);
  });
  it('lê os saldos via balanceOfBatch e calcula totais', async () => {
    const vals = Array.from({ length: 30 }, (_, i) => (i === 0 ? 3n : i === 7 ? 1n : 0n));
    const call = vi.fn(async () => encodeFunctionResult({ abi, functionName: 'balanceOfBatch', result: vals }));
    const inv = createInventory({ storage: mem(), call, cfg: real });
    inv.setAddress(ADDR); await inv.refresh();
    expect(call).toHaveBeenCalledWith(real.contractAddress, expect.stringMatching(/^0x4e1273f4/));
    expect(inv.balances[0]).toBe(3); expect(inv.balances[7]).toBe(1);
    expect(inv.ownedCount).toBe(2); expect(inv.total).toBe(4);
  });
  it('sem endereço no modo real: pede o endereço e fica zerado; endereço inválido é recusado', async () => {
    const inv = createInventory({ storage: mem(), call: vi.fn(), cfg: real });
    expect(inv.needsAddress).toBe(true); await inv.refresh(); expect(inv.total).toBe(0);
    inv.setAddress('lixo'); expect(inv.address).toBeNull();
  });
  it('lembra o endereço entre sessões', () => {
    const st = mem(); createInventory({ storage: st, cfg: real }).setAddress(ADDR);
    expect(createInventory({ storage: st, cfg: real }).address).toBe(ADDR);
  });
  it('modo demo: compra soma no inventário e persiste', () => {
    const st = mem(), cfg = { demoMode: true };
    const a = createInventory({ storage: st, cfg }); const cb = vi.fn(); a.onChange(cb);
    a.add(5); a.add(5); expect(a.balances[4]).toBe(2); expect(cb).toHaveBeenCalledTimes(2);
    expect(createInventory({ storage: st, cfg }).balances[4]).toBe(2);
  });
});
