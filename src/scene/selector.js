import * as THREE from 'three';

// Aproxima `current` de `target` de forma suave e independente do FPS.
export function approach(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export const SEL = { cardW: 0.17, cardH: 0.17 * 4 / 3, margin: 0.014, arm: 0.04, thick: 0.007, popZ: 0.03, popScale: 0.08 };

// Quatro cantoneiras em "L" (8 retângulos) ao redor do card, numa só malha.
export function bracketGeometry({ cardW, cardH, margin, arm, thick } = SEL) {
  const hx = cardW / 2 + margin, hy = cardH / 2 + margin, pos = [], idx = [];
  const rect = (x0, y0, x1, y1) => { const b = pos.length / 3; pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const cx = sx * hx, cy = sy * hy;
    rect(Math.min(cx, cx - sx * arm), Math.min(cy, cy - sy * thick), Math.max(cx, cx - sx * arm), Math.max(cy, cy - sy * thick));     // braço horizontal
    rect(Math.min(cx, cx - sx * thick), Math.min(cy, cy - sy * arm), Math.max(cx, cx - sx * thick), Math.max(cy, cy - sy * arm));     // braço vertical
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}

// Seletor de card: cantoneiras vermelhas (cor da marca) nítidas + o card selecionado "salta" para frente e cresce um pouco. Sem escurecer nada, sem brilho.
export function createSelector(scene) {
  const frame = new THREE.Mesh(bracketGeometry(), new THREE.MeshBasicMaterial({ color: 0xff2a44, side: THREE.DoubleSide }));
  frame.visible = false; frame.renderOrder = 6; scene.add(frame);
  const target = new THREE.Vector3(), cur = new THREE.Vector3();
  let on = false, placed = false, anchor = null, mesh = null, lift = 0, prev = null, prevLift = 0, rotX = 0;
  const apply = (m, l) => { if (!m) return; m.position.z = SEL.popZ * l; m.scale.setScalar(1 + SEL.popScale * l); };
  return {
    setOn(v) { on = v; if (v) frame.visible = true; },
    // anchor: slot da máquina; cardMesh: o card dentro dele (é ele que salta)
    moveTo(a, cardMesh) {
      if (cardMesh !== mesh) { if (prev && prev !== mesh) apply(prev, 0); prev = mesh; prevLift = lift; mesh = cardMesh; lift = 0; }
      anchor = a; a.getWorldPosition(target); rotX = a.rotation.x;
      if (!placed) { cur.copy(target); placed = true; }
    },
    // true enquanto ainda anima (o chamador mantém o render ligado)
    update(dt) {
      const goal = on ? 1 : 0;
      lift = approach(lift, goal, 16, dt); prevLift = approach(prevLift, 0, 16, dt);
      const moving = cur.distanceToSquared(target) > 1e-7;
      cur.set(approach(cur.x, target.x, 18, dt), approach(cur.y, target.y, 18, dt), approach(cur.z, target.z, 18, dt));
      frame.position.set(cur.x, cur.y, cur.z + 0.016 + SEL.popZ * lift); frame.rotation.x = rotX; frame.scale.setScalar(1 + SEL.popScale * lift * 0.5);
      apply(mesh, lift); apply(prev, prevLift);
      if (!on && lift < 0.01) { frame.visible = false; lift = 0; apply(mesh, 0); }
      return Math.abs(lift - goal) > 0.01 || prevLift > 0.01 || moving;
    },
    get lift() { return lift; }
  };
}
