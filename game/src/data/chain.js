import { ethCall, loadMintedCounts, decodeCardsInfo, decodeString, decodeBool, encodeUri, SELECTORS } from './rpc.js';
import { config } from '../config.js';
import { demoCardsInfo } from './demo.js';
import { fetchIpfs, idToHex } from './ipfs.js';

export const SLOTS = 30;                           // a máquina tem 5x6 espaços

// Monta as 30 posições da máquina a partir do que o contrato devolve. O contrato pode ter menos cards que espaços (os que sobram
// ficam "SEM CARD", indisponíveis) e `max` é o estoque inicial real (estoque + emitidos), não um 100 fixo.
export function buildInfos({ prices, stocks, active }, minted = [], slots = SLOTS) {
  return Array.from({ length: slots }, (_, i) => {
    if (i >= prices.length) return { price: 0n, stock: 0, active: false, missing: true, minted: 0, max: 0 };
    const stock = Number(stocks[i]), m = minted[i] ?? null;
    return { price: prices[i], stock, active: !!active[i], missing: false, minted: m, max: m === null ? Math.max(100, stock) : stock + m };
  });
}

export async function loadCardsInfo() {
  if (config.demoMode) return demoCardsInfo();
  const raw = decodeCardsInfo(await ethCall(config.contractAddress, SELECTORS.getAllCardsInfo));
  const minted = await loadMintedCounts(Math.min(raw.prices.length, SLOTS)).catch(() => []);       // falhou? usa o padrão do contrato (100)
  return buildInfos(raw, minted);
}

// A máquina está pausada (Pausable do contrato)? No modo demo nunca.
export async function loadPaused() {
  if (config.demoMode) return false;
  return decodeBool(await ethCall(config.contractAddress, SELECTORS.paused));
}

// O contrato devolve o mesmo modelo ("ipfs://CID/{id}.json") para qualquer card: pergunta uma vez só e troca o {id} aqui.
// Se a pergunta falhar, o próximo pedido tenta de novo.
export function createUriResolver(fetchTemplate) {
  let pending = null;
  return async (id) => {
    pending ??= fetchTemplate().catch((e) => { pending = null; throw e; });
    return (await pending).replace('{id}', idToHex(id));
  };
}
const resolveUri = createUriResolver(async () => decodeString(await ethCall(config.contractAddress, encodeUri(1))));

export async function tokenMetadataUri(id) {
  if (config.demoMode) return `ipfs://${config.metadataCid}/${idToHex(id)}.json`;
  return resolveUri(id);
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
