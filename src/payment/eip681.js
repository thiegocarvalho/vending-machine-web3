export function buildEip681(contract, chainId, cardId, priceWei) {
  return `ethereum:${contract}@${chainId}/buyCard?uint256=${cardId}&value=${BigInt(priceWei).toString()}`;
}
