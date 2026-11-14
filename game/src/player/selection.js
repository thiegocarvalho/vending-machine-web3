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
    new THREE.LineBasicMaterial({ color: 0x4fd2ff }));
  frame.visible = false; scene.add(frame);
  return {
    moveTo(anchor) { anchor.getWorldPosition(frame.position); frame.position.z += 0.012; frame.rotation.x = anchor.rotation.x; frame.visible = true; },
    setVisible(v) { frame.visible = v; }
  };
}
