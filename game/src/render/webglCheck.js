export function hasWebGL2(doc = document) {
  try {
    const c = doc.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}

export function showWebGLError(doc = document) {
  const box = doc.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:#08080A;color:#fff;font-family:"Space Grotesk",system-ui,sans-serif;text-align:center;z-index:99';
  box.innerHTML = `<div style="max-width:460px"><h1 style="font-family:'Bebas Neue',sans-serif;font-size:42px;letter-spacing:2px;color:#FF0033;margin:0 0 12px">WEBGL INDISPONÍVEL</h1>
    <p style="line-height:1.5;margin:0 0 12px">Seu navegador não conseguiu iniciar o gráfico 3D.</p>
    <p style="line-height:1.5;margin:0;color:#bbb;font-size:14px">Ative a aceleração de hardware nas configurações do navegador (no Brave: <code>brave://settings/system</code>), reinicie e recarregue. Se o Brave bloqueia fingerprinting, desative-o para este site.</p></div>`;
  doc.body.appendChild(box);
}
