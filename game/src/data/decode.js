// Decodifica a imagem de um card para um canvas já no tamanho da textura e já invertido (flipY manual).
// Um único caminho para todos os navegadores: createImageBitmap(blob) sem opções (Safari/iOS e Firefox ignoram ou rejeitam
// `imageOrientation`/`resizeWidth` em versões antigas) e, se nem isso existir, <img>.decode().
export async function decodeCardImage(blob, { texW, texH }, env = {}) {
  const cib = env.createImageBitmap ?? globalThis.createImageBitmap;
  const doc = env.document ?? document;
  let src = null;
  if (cib) { try { src = await cib(blob); } catch { src = null; } }
  if (!src) {
    const U = env.URL ?? URL, url = U.createObjectURL(blob), img = new (env.Image ?? Image)();
    try { img.src = url; await img.decode(); src = img; } finally { U.revokeObjectURL(url); }
  }
  const canvas = doc.createElement('canvas'); canvas.width = texW; canvas.height = texH;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.translate(0, texH); g.scale(1, -1);                               // WebGL tem origem embaixo: inverte aqui, textura com flipY = false
  g.drawImage(src, 0, 0, texW, texH);
  src.close?.();
  return canvas;
}
