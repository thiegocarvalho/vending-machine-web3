export const DEMO_PRICE = 100000000000000n; // 0.0001 ETH
export function demoCardsInfo() {
  return Array.from({ length: 30 }, () => ({ price: DEMO_PRICE, stock: 100, active: true }));
}
