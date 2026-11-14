import * as THREE from 'three';
import { loadMetadata, imageUrlFor } from '../data/chain.js';
import { fetchIpfs } from '../data/ipfs.js';
import { config } from '../config.js';
import { decodeCardImage } from '../data/decode.js';

const CARD_W = 0.17, CARD_H = CARD_W * 4 / 3, CONCURRENCY = 6;

const CARD_GEO = new THREE.PlaneGeometry(CARD_W, CARD_H);   // uma geometria para os 30 cards

function placeholderTexture(label, failed = false) {
  const c = document.createElement('canvas'); c.width = 75; c.height = 100;
  const g = c.getContext('2d');
  g.fillStyle = '#0c0c10'; g.fillRect(0, 0, 75, 100);
  g.strokeStyle = failed ? '#ff0033' : '#40404a'; g.strokeRect(2, 2, 71, 96);
  g.fillStyle = failed ? '#ff0033' : '#80808a'; g.font = '20px monospace'; g.textAlign = 'center';
  g.fillText(failed ? '!' : label, 37, 56);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; return t;
}

async function loadTexture(meta, { texW, texH, mip = true, aniso = 4 }) {
  const url = imageUrlFor(meta);
  const blob = url.startsWith('ipfs://') ? await fetchIpfs(url, config.gateways, { as: 'blob', timeoutMs: 15000 })
                                         : await (await fetch(url)).blob();
  const canvas = await decodeCardImage(blob, { texW, texH });
  const t = new THREE.CanvasTexture(canvas); t.flipY = false;               // já invertido no decode
  t.anisotropy = aniso; t.colorSpace = THREE.SRGBColorSpace;
  if (!mip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }   // aparelho fraco: -33% de memória de textura
  return t;
}

// Verso oficial do card: `collection.png`, na mesma pasta do IPFS das artes (o campo `image` de qualquer card aponta para essa pasta).
export const backUrlFor = (meta) => meta.image.replace(/[^/]+$/, 'collection.png');
export async function loadBackTexture(meta, { texW = 600, texH = 800, aniso = 4 } = {}) {
  const url = backUrlFor(meta);
  const blob = url.startsWith('ipfs://') ? await fetchIpfs(url, config.gateways, { as: 'blob', timeoutMs: 25000 }) : await (await fetch(url)).blob();
  const t = new THREE.CanvasTexture(await decodeCardImage(blob, { texW, texH })); t.flipY = false;
  t.anisotropy = aniso; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Arte completa (campo padrão `image` do NFT) para o visualizador do inventário: baixada só sob demanda, decodificada em 600x800.
export async function loadFullTexture(meta, { texW = 600, texH = 800, aniso = 4 } = {}) {
  const url = meta.image;
  const blob = url.startsWith('ipfs://') ? await fetchIpfs(url, config.gateways, { as: 'blob', timeoutMs: 25000 }) : await (await fetch(url)).blob();
  const t = new THREE.CanvasTexture(await decodeCardImage(blob, { texW, texH })); t.flipY = false;
  t.anisotropy = aniso; t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function populateCards(anchors, infos, { texW = 300, texH = 400, mip = true, aniso = 4 } = {}) {
  const cards = [], metas = new Array(anchors.length).fill(null), listeners = [];
  anchors.forEach((anchor, i) => {
    const mesh = new THREE.Mesh(CARD_GEO, new THREE.MeshBasicMaterial({ map: placeholderTexture(String(i + 1)) }));
    mesh.userData.cardId = i + 1;
    anchor.add(mesh); cards.push(mesh);
  });

  function swapMap(mesh, tex) { const old = mesh.material.map; mesh.material.map = tex; mesh.material.needsUpdate = true; old?.dispose(); }   // libera a textura anterior da GPU

  async function loadOne(i) {
    const mesh = cards[i];
    try {
      const meta = await loadMetadata(i + 1);
      metas[i] = meta;
      swapMap(mesh, await loadTexture(meta, { texW, texH, mip, aniso }));
      listeners.forEach(cb => cb(i + 1, meta));
    } catch (e) {
      console.warn(`card ${i + 1} failed`, e.message);
      swapMap(mesh, placeholderTexture('', true));
    }
  }
  async function run() {
    let next = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (next < cards.length) await loadOne(next++); }));
  }
  const done = run();

  function setSoldOut(id, v) {
    const m = cards[id - 1]; m.material.color.set(v ? 0x555555 : 0xffffff);
    m.userData.soldOut = v;
  }
  infos.forEach((inf, i) => { if (inf.stock <= 0 || !inf.active) setSoldOut(i + 1, true); });

  return { cards, metas, done, setSoldOut, retry: (id) => loadOne(id - 1), onLoaded: (cb) => listeners.push(cb) };
}
