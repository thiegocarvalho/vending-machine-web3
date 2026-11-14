import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';
import { config } from '../config.js';
import { demoCardsInfo } from './demo.js';
import { fetchIpfs, idToHex } from './ipfs.js';

export const ABI = parseAbi([
  'function uri(uint256 cardId) view returns (string)',
  'function getAllCardsInfo() view returns (uint256[] prices, uint256[] stocks, bool[] activeStatuses)',
  'function buyCard(uint256 cardId) payable',
  'event CardPurchased(address indexed buyer, uint256 indexed cardId, uint256 amount, uint256 totalCost, uint256 remainingStock)'
]);

export const publicClient = createPublicClient({ chain: sepolia, transport: http(config.rpcUrl) });

export async function loadCardsInfo() {
  if (config.demoMode) return demoCardsInfo();
  const [prices, stocks, active] = await publicClient.readContract({ address: config.contractAddress, abi: ABI, functionName: 'getAllCardsInfo' });
  return prices.map((p, i) => ({ price: p, stock: Number(stocks[i]), active: active[i] }));
}

export async function tokenMetadataUri(id) {
  if (config.demoMode) return `ipfs://${config.metadataCid}/${idToHex(id)}.json`;
  const uri = await publicClient.readContract({ address: config.contractAddress, abi: ABI, functionName: 'uri', args: [BigInt(id)] });
  return uri.replace('{id}', idToHex(id));
}

export async function loadMetadata(id) {
  const meta = await fetchIpfs(await tokenMetadataUri(id), config.gateways);
  if (!meta || typeof meta.name !== 'string' || typeof meta.image !== 'string') throw new Error(`Incomplete metadata for card ${id}`);
  return meta;
}
