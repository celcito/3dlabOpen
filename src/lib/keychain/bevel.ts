import * as THREE from 'three';

/**
 * Remove o chanfro INFERIOR de uma ExtrudeGeometry (com bevel) sem CSG.
 *
 * O ExtrudeGeometry do three.js estende o bevel para fora do intervalo [0, depth]:
 * a geometria ocupa [-bevelThickness, depth + bevelThickness]. Quando o relevo é
 * posicionado sobre o corpo, esse chanfro inferior fica ENTERRADO dentro do corpo e
 * as duas peças se sobrepõem em Z. Para impressão multicolor isso é ruim: as camadas
 * da sobreposição levam as duas cores, o fatiador alterna de filamento a cada camada
 * e purga a cada troca.
 *
 * Como os anéis do bevel inferior ficam todos em z <= 0 (o anel de z = 0 é a base da
 * parede vertical), basta achatar tudo que está abaixo de 0 no plano z = 0: os
 * triângulos do bevel viram uma face plana, a malha continua fechada (mesma topologia)
 * e o relevo passa a ter fundo reto, começando exatamente em z = 0.
 *
 * Opera in-place e recalcula as normais. Espera geometria não-indexada (saída padrão
 * do ExtrudeGeometry).
 */
export function flattenBottomBevel(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geometry.getAttribute('position');
  if (!pos) return geometry;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getZ(i) < 0) pos.setZ(i, 0);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}