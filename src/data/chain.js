import { ethCall, decodeCardsInfo, decodeString, decodeBool, encodeUri, SELECTORS } from './rpc.js';
import { config } from '../config.js';
import { demoCardsInfo } from './demo.js';
import { fetchIpfs, idToHex } from './ipfs.js';

export async function loadCardsInfo() {
  if (config.demoMode) return demoCardsInfo();
  const { prices, stocks, active } = decodeCardsInfo(await ethCall(config.contractAddress, SELECTORS.getAllCardsInfo));
  return prices.map((p, i) => ({ price: p, stock: Number(stocks[i]), active: active[i] }));
}

// A máquina está pausada (Pausable do contrato)? No modo demo nunca.
export async function loadPaused() {
  if (config.demoMode) return false;
  return decodeBool(await ethCall(config.contractAddress, SELECTORS.paused));
}

export async function tokenMetadataUri(id) {
  if (config.demoMode) return `ipfs://${config.metadataCid}/${idToHex(id)}.json`;
  const uri = decodeString(await ethCall(config.contractAddress, encodeUri(id)));
  return uri.replace('{id}', idToHex(id));
}

const LOCAL_DEV = () => config.demoMode && !config.metadataCid;   // dev only: no CID uploaded yet

export function imageUrlFor(meta) {
  if (LOCAL_DEV()) return `/dev-images/${meta.image.split('/').pop()}`;
  return meta.image_thumbnail || meta.image;   // miniatura leve quando existir; `image` segue sendo o padrão NFT (arte completa)
}

export async function loadMetadata(id) {
  const meta = LOCAL_DEV()
    ? await (await fetch(`/dev-metadata/${idToHex(id)}.json`)).json()
    : await fetchIpfs(await tokenMetadataUri(id), config.gateways);
  if (!meta || typeof meta.name !== 'string' || typeof meta.image !== 'string') throw new Error(`Incomplete metadata for card ${id}`);
  return meta;
}
