import * as THREE from 'three';

// Aproxima `current` de `target` de forma suave e independente do FPS (rate = 1/s aproximado).
export function approach(current, target, rate, dt) {
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}

function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => r.addColorStop(o, col));
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Foco sobre o card selecionado: escurece em volta (vinheta) e acende um halo suave atrás do card.
export function createSpotlight(scene) {
  const dim = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(2,4,12,0)'], [0.1, 'rgba(2,4,12,0)'], [0.27, 'rgba(2,4,12,0.78)'], [0.5, 'rgba(2,4,12,0.9)'], [1, 'rgba(2,4,12,0.92)']]),
    transparent: true, depthWrite: false, opacity: 0
  }));
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.72), new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(190,230,255,0.75)'], [0.45, 'rgba(120,190,255,0.28)'], [1, 'rgba(120,190,255,0)']]),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0
  }));
  dim.renderOrder = 10; halo.renderOrder = 9; dim.visible = halo.visible = false;
  scene.add(dim, halo);

  const target = new THREE.Vector3(), cur = new THREE.Vector3();
  let on = false, level = 0, placed = false;
  return {
    setOn(v) { on = v; if (v) dim.visible = halo.visible = true; },
    moveTo(anchor) { anchor.getWorldPosition(target); if (!placed) { cur.copy(target); placed = true; } },
    // retorna true enquanto ainda anima (o chamador mantém o render ligado)
    update(dt) {
      const goal = on ? 1 : 0;
      level = approach(level, goal, 9, dt);
      const moving = cur.distanceToSquared(target) > 1e-6;
      cur.set(approach(cur.x, target.x, 14, dt), approach(cur.y, target.y, 14, dt), approach(cur.z, target.z, 14, dt));
      dim.position.set(cur.x, cur.y, cur.z + 0.1); halo.position.set(cur.x, cur.y, cur.z + 0.015);   // vinheta à frente do gabinete, halo atrás da moldura
      dim.material.opacity = level; halo.material.opacity = level;
      if (!on && level < 0.01) { dim.visible = halo.visible = false; level = 0; }
      return Math.abs(level - goal) > 0.01 || moving;
    },
    get level() { return level; }
  };
}
