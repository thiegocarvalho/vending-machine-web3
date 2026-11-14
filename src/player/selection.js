import * as THREE from 'three';
import { moveSelection, cardIdToSlot } from '../grid.js';

export function createSelection(initial = 1) {
  cardIdToSlot(initial);
  let id = initial; const cbs = [];
  const sel = {
    get id() { return id; },
    set(n) { cardIdToSlot(n); if (n !== id) { id = n; cbs.forEach(cb => cb(id)); } },
    move(dir) { sel.set(moveSelection(id, dir)); return id; },
    onChange(cb) { cbs.push(cb); }
  };
  return sel;
}

export function pickCard(raycaster, cardMeshes) {
  const hit = raycaster.intersectObjects(cardMeshes, false)[0];
  return hit ? hit.object.userData.cardId : null;
}

// Highlight frame that follows the selected anchor.
export function createHighlight(scene) {
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.19, 0.19 * 4 / 3)),
    new THREE.LineBasicMaterial({ color: 0xff0033 }));
  frame.visible = false; scene.add(frame);
  return { moveTo(anchor) { anchor.getWorldPosition(frame.position); frame.position.z += 0.012; frame.rotation.x = anchor.rotation.x; frame.visible = true; } };
}

// Smoothly walks the camera to a point in front of the anchor (clamped by the caller's wall).
export function focusOn(camera, controls, anchor, distance = 1.6) {
  const target = anchor.getWorldPosition(new THREE.Vector3());
  const from = camera.position.clone();
  const to = new THREE.Vector3(target.x, 1.6, target.z + distance + 0.07);
  const t0 = performance.now();
  return new Promise(res => {
    (function step(now) {
      const k = Math.min(1, (now - t0) / 450), e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(from, to, e);
      const pitch = Math.atan2(target.y - 1.6, distance);
      controls.setLook(0, pitch * e);
      k < 1 ? requestAnimationFrame(step) : res();
    })(t0);
  });
}
