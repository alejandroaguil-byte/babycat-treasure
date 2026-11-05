import * as THREE from 'three';

const outlineMat = new THREE.MeshBasicMaterial({ color: '#2b1d16', side: THREE.BackSide });

/**
 * Cartoon outlines with the inverted-hull trick: each shadow-casting mesh gets a
 * slightly bigger back-face copy. Small details (eyes, whiskers) are skipped.
 */
export function addOutline(root, thickness = 0.06) {
  const targets = [];
  root.traverse((o) => {
    if (o.isMesh && o.castShadow && !o.userData.isOutline) targets.push(o);
  });
  for (const mesh of targets) {
    const hull = new THREE.Mesh(mesh.geometry, outlineMat);
    hull.userData.isOutline = true;
    hull.scale.setScalar(1 + thickness);
    hull.raycast = () => {};
    mesh.add(hull);
  }
  return root;
}
