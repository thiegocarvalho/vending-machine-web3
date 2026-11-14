import * as THREE from 'three';
import { loadMetadata, imageUrlFor } from '../data/chain.js';
import { fetchIpfs } from '../data/ipfs.js';
import { config } from '../config.js';
import { applyPs1Snap } from '../render/ps1Renderer.js';

const CARD_W = 0.17, CARD_H = CARD_W * 4 / 3, TEX_W = 300, TEX_H = 400, CONCURRENCY = 6;

function placeholderTexture(label, failed = false) {
  const c = document.createElement('canvas'); c.width = 75; c.height = 100;
  const g = c.getContext('2d');
  g.fillStyle = '#0c0c10'; g.fillRect(0, 0, 75, 100);
  g.strokeStyle = failed ? '#ff0033' : '#40404a'; g.strokeRect(2, 2, 71, 96);
  g.fillStyle = failed ? '#ff0033' : '#80808a'; g.font = '20px monospace'; g.textAlign = 'center';
  g.fillText(failed ? '!' : label, 37, 56);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace; return t;
}

async function loadTexture(meta) {
  const url = imageUrlFor(meta);
  const blob = url.startsWith('ipfs://') ? await fetchIpfs(url, config.gateways, { as: 'blob', timeoutMs: 15000 })
                                         : await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { resizeWidth: TEX_W, resizeHeight: TEX_H, resizeQuality: 'medium', imageOrientation: 'flipY' });
  // ImageBitmap ignora flipY: a inversão vem de imageOrientation no createImageBitmap
  const t = new THREE.Texture(bmp); t.flipY = false; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}

export function populateCards(anchors, infos) {
  const cards = [], metas = new Array(anchors.length).fill(null), listeners = [];
  anchors.forEach((anchor, i) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H),
      applyPs1Snap(new THREE.MeshBasicMaterial({ map: placeholderTexture(String(i + 1)) })));
    mesh.userData.cardId = i + 1;
    anchor.add(mesh); cards.push(mesh);
  });

  async function loadOne(i) {
    const mesh = cards[i];
    try {
      const meta = await loadMetadata(i + 1);
      metas[i] = meta;
      mesh.material.map = await loadTexture(meta); mesh.material.needsUpdate = true;
      listeners.forEach(cb => cb(i + 1, meta));
    } catch (e) {
      console.warn(`card ${i + 1} failed`, e.message);
      mesh.material.map = placeholderTexture('', true); mesh.material.needsUpdate = true;
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
