/**
 * Refina a face frontal (a que carrega a arte, com UV) de uma peça de quebra-cabeça
 * para que a pintura por triângulo do Bambu Studio (`paint_color`) tenha resolução
 * suficiente para reconhecer a imagem.
 *
 * O contorno da peça é triangulado pelo three.js em triângulos enormes e finos
 * (ligando vértices do perímetro). Dividir esses triângulos não dá resolução
 * uniforme; por isso a frente é re-triangulada: pontos de uma malha triangular
 * regular (espaçamento = `targetEdgeMm`) são inseridos na triangulação existente,
 * com arestas legalizadas por Delaunay. Arestas do contorno e dobras (chanfro ↔ topo)
 * ficam fixas, então:
 *   - a forma e a área da frente são preservadas exatamente;
 *   - a malha continua conforme com as laterais (sem rachaduras/T-junctions);
 *   - os triângulos ficam ~equiláteros, com a aresta pedida.
 *
 * Laterais e fundo permanecem intactos.
 */

import * as THREE from "three";

export interface SubdivideFrontOptions {
  /**
   * Usado só quando `targetEdgeMm` não é informado: a aresta-alvo passa a ser a maior
   * aresta frontal dividida por 2^maxIterations (compatível com chamadas antigas).
   */
  maxIterations: number;
  /** Teto de triângulos na frente (válvula de segurança; aumenta a aresta se preciso). */
  maxFrontTriangles: number;
  /** Comprimento-alvo da aresta, em mm. Menor = mais detalhe da arte. */
  targetEdgeMm?: number;
}

const DEFAULT_OPTIONS: SubdivideFrontOptions = {
  maxIterations: 2,
  maxFrontTriangles: 6000,
};

/**
 * Triângulos da frente carregam UV real; laterais/fundo têm UV pinado em (0,0).
 * (Não dá para usar a "extensão" do UV: triângulos finos têm extensão minúscula.)
 */
export function hasArtworkUV(
  u0: number, v0: number, u1: number, v1: number, u2: number, v2: number
): boolean {
  return Math.abs(u0) + Math.abs(v0) + Math.abs(u1) + Math.abs(v1) + Math.abs(u2) + Math.abs(v2) > 1e-9;
}

const EDGE_KEY_BASE = 67108864; // 2^26
const CREASE_COS = Math.cos((8 * Math.PI) / 180);

export function subdivideFrontFaces(
  geometry: THREE.BufferGeometry,
  options: Partial<SubdivideFrontOptions> = {}
): THREE.BufferGeometry {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const base = geometry.index ? geometry.clone().toNonIndexed() : geometry.clone();
  base.computeVertexNormals();

  const pos = base.getAttribute("position");
  const uv = base.getAttribute("uv");
  const norm = base.getAttribute("normal");
  if (!pos || !norm || !uv || pos.count < 3) return base.clone();

  const triCount = pos.count / 3;
  const posArr = pos.array as Float32Array;
  const uvArr = uv.array as Float32Array;
  const normArr = norm.array as Float32Array;

  // ---- 1. Triângulos da frente ----
  const isFront = new Uint8Array(triCount);
  let frontCount = 0;
  for (let t = 0; t < triCount; t++) {
    const i = t * 3;
    if (
      hasArtworkUV(
        uvArr[i * 2], uvArr[i * 2 + 1],
        uvArr[(i + 1) * 2], uvArr[(i + 1) * 2 + 1],
        uvArr[(i + 2) * 2], uvArr[(i + 2) * 2 + 1]
      )
    ) {
      isFront[t] = 1;
      frontCount++;
    }
  }
  if (frontCount === 0) return base.clone();

  // ---- 2. Malha indexada da frente (vértices soldados por posição + UV) ----
  const vx: number[] = [], vy: number[] = [], vz: number[] = [];
  const vu: number[] = [], vv: number[] = [];
  const vnx: number[] = [], vny: number[] = [], vnz: number[] = [];
  const vmap = new Map<string, number>();
  const fix = (n: number) => (Math.abs(n) < 5e-5 ? 0 : n).toFixed(4); // evita "-0.0000"
  const addVertex = (i: number): number => {
    const x = posArr[i * 3], y = posArr[i * 3 + 1], z = posArr[i * 3 + 2];
    const u = uvArr[i * 2], v = uvArr[i * 2 + 1];
    const key = `${fix(x)}|${fix(y)}|${fix(z)}|${u.toFixed(5)}|${v.toFixed(5)}`;
    let id = vmap.get(key);
    if (id === undefined) {
      id = vx.length;
      vmap.set(key, id);
      vx.push(x); vy.push(y); vz.push(z);
      vu.push(u); vv.push(v);
      vnx.push(normArr[i * 3]); vny.push(normArr[i * 3 + 1]); vnz.push(normArr[i * 3 + 2]);
    }
    return id;
  };

  const ta: number[] = [], tb: number[] = [], tc: number[] = [];
  const alive: boolean[] = [];
  const edges = new Map<number, number[]>();
  const edgeKey = (a: number, b: number) => (a < b ? a * EDGE_KEY_BASE + b : b * EDGE_KEY_BASE + a);

  const registerEdge = (a: number, b: number, t: number) => {
    const k = edgeKey(a, b);
    const list = edges.get(k);
    if (list) list.push(t);
    else edges.set(k, [t]);
  };
  const unregisterEdge = (a: number, b: number, t: number) => {
    const k = edgeKey(a, b);
    const list = edges.get(k);
    if (!list) return;
    const idx = list.indexOf(t);
    if (idx >= 0) list.splice(idx, 1);
    if (list.length === 0) edges.delete(k);
  };
  const addTri = (a: number, b: number, c: number): number => {
    const t = ta.length;
    ta.push(a); tb.push(b); tc.push(c);
    alive.push(true);
    registerEdge(a, b, t); registerEdge(b, c, t); registerEdge(c, a, t);
    return t;
  };
  const removeTri = (t: number) => {
    unregisterEdge(ta[t], tb[t], t); unregisterEdge(tb[t], tc[t], t); unregisterEdge(tc[t], ta[t], t);
    alive[t] = false;
  };

  for (let t = 0; t < triCount; t++) {
    if (!isFront[t]) continue;
    const a = addVertex(t * 3), b = addVertex(t * 3 + 1), c = addVertex(t * 3 + 2);
    if (a === b || b === c || a === c) continue;
    addTri(a, b, c);
  }

  // ---- 3. Aresta fixa = contorno (1 triângulo) ou dobra (normais bem diferentes) ----
  const constrained = new Set<number>();
  const triNormal = (t: number): [number, number, number] => {
    const a = ta[t], b = tb[t], c = tc[t];
    const ux = vx[b] - vx[a], uy = vy[b] - vy[a], uz = vz[b] - vz[a];
    const wx = vx[c] - vx[a], wy = vy[c] - vy[a], wz = vz[c] - vz[a];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  };
  edges.forEach((list, key) => {
    if (list.length !== 2) {
      constrained.add(key);
      return;
    }
    const n0 = triNormal(list[0]), n1 = triNormal(list[1]);
    if (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2] < CREASE_COS) constrained.add(key);
  });

  // ---- 4. Geometria 2D (a frente é um campo de altura sobre XY) ----
  const orient = (a: number, b: number, c: number) =>
    (vx[b] - vx[a]) * (vy[c] - vy[a]) - (vy[b] - vy[a]) * (vx[c] - vx[a]);

  /** > 0 quando d está dentro do círculo circunscrito de (a,b,c), qualquer orientação. */
  const inCircle = (a: number, b: number, c: number, d: number): number => {
    const adx = vx[a] - vx[d], ady = vy[a] - vy[d];
    const bdx = vx[b] - vx[d], bdy = vy[b] - vy[d];
    const cdx = vx[c] - vx[d], cdy = vy[c] - vy[d];
    const det =
      (adx * adx + ady * ady) * (bdx * cdy - cdx * bdy) -
      (bdx * bdx + bdy * bdy) * (adx * cdy - cdx * ady) +
      (cdx * cdx + cdy * cdy) * (adx * bdy - bdx * ady);
    return orient(a, b, c) >= 0 ? det : -det;
  };

  const otherTri = (key: number, t: number): number => {
    const list = edges.get(key);
    if (!list) return -1;
    return list[0] === t ? (list.length > 1 ? list[1] : -1) : list[0];
  };
  const thirdVertex = (t: number, a: number, b: number): number =>
    ta[t] !== a && ta[t] !== b ? ta[t] : tb[t] !== a && tb[t] !== b ? tb[t] : tc[t];

  /** Os dois triângulos que dividem a aresta formam um quadrilátero convexo? */
  const isConvexQuad = (p: number, q: number, r: number, s: number): boolean => {
    // diagonal atual p-q; nova diagonal r-s
    const o1 = orient(r, s, p), o2 = orient(r, s, q);
    const o3 = orient(p, q, r), o4 = orient(p, q, s);
    return o1 * o2 < 0 && o3 * o4 < 0;
  };

  /** Gira a aresta (p,q) entre t=(p,q,r) e n=(q,p,s) para r–s. Retorna os 2 novos triângulos. */
  const flip = (t: number, n: number, p: number, q: number, r: number, s: number): [number, number] => {
    removeTri(t);
    removeTri(n);
    return [addTri(r, p, s), addTri(r, s, q)];
  };

  // ---- 5. Inserção de pontos + legalização de Delaunay (arestas fixas não giram) ----
  const legalize = (t: number, a: number, b: number, p: number, depth: number) => {
    if (depth > 64 || !alive[t]) return;
    const key = edgeKey(a, b);
    if (constrained.has(key)) return;
    const n = otherTri(key, t);
    if (n < 0) return;
    const d = thirdVertex(n, a, b);
    if (inCircle(a, b, p, d) <= 1e-9) return;
    if (!isConvexQuad(a, b, p, d)) return;
    // t tem a aresta a→b com terceiro vértice p; n tem b→a com terceiro d
    const [t1, t2] = flip(t, n, a, b, p, d); // (p,a,d) e (p,d,b)
    legalize(t1, a, d, p, depth + 1);
    legalize(t2, d, b, p, depth + 1);
  };

  const triContains = (t: number, px: number, py: number, eps: number): boolean => {
    const a = ta[t], b = tb[t], c = tc[t];
    const s = orient(a, b, c) >= 0 ? 1 : -1;
    const o1 = s * ((vx[b] - vx[a]) * (py - vy[a]) - (vy[b] - vy[a]) * (px - vx[a]));
    const o2 = s * ((vx[c] - vx[b]) * (py - vy[b]) - (vy[c] - vy[b]) * (px - vx[b]));
    const o3 = s * ((vx[a] - vx[c]) * (py - vy[c]) - (vy[a] - vy[c]) * (px - vx[c]));
    return o1 >= -eps && o2 >= -eps && o3 >= -eps;
  };

  /** Localiza o triângulo que contém (px,py): caminhada a partir de `start`, com varredura de reserva. */
  const locate = (px: number, py: number, start: number): number => {
    let t = start;
    for (let step = 0; step < 400 && t >= 0 && alive[t]; step++) {
      const a = ta[t], b = tb[t], c = tc[t];
      const s = orient(a, b, c) >= 0 ? 1 : -1;
      const ev: Array<[number, number]> = [[a, b], [b, c], [c, a]];
      let moved = false;
      for (const [u, w] of ev) {
        const o = s * ((vx[w] - vx[u]) * (py - vy[u]) - (vy[w] - vy[u]) * (px - vx[u]));
        if (o < -1e-12) {
          const nb = otherTri(edgeKey(u, w), t);
          if (nb >= 0) {
            t = nb;
            moved = true;
            break;
          }
        }
      }
      if (!moved) {
        if (triContains(t, px, py, 1e-9)) return t;
        break; // a caminhada parou numa aresta do contorno: varredura de reserva
      }
    }
    for (let t2 = 0; t2 < ta.length; t2++) {
      if (alive[t2] && triContains(t2, px, py, 1e-9)) return t2;
    }
    return -1;
  };

  const distToConstrained = (px: number, py: number, limit: number): number => {
    let best = Infinity;
    for (const [a, b] of cEdges) {
      const ex = vx[b] - vx[a], ey = vy[b] - vy[a];
      const l2 = ex * ex + ey * ey || 1e-12;
      let u = ((px - vx[a]) * ex + (py - vy[a]) * ey) / l2;
      u = Math.max(0, Math.min(1, u));
      const d = Math.hypot(px - (vx[a] + u * ex), py - (vy[a] + u * ey));
      if (d < best) {
        best = d;
        if (best < limit) return best;
      }
    }
    return best;
  };

  // ---- 4b. Alvo, divisão das arestas fixas longas e lista de arestas fixas ----
  // área frontal e aresta efetiva (respeita o teto de triângulos)
  let area = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let maxEdge = 0;
  for (let t = 0; t < ta.length; t++) {
    const [a, b, c] = [ta[t], tb[t], tc[t]];
    area += 0.5 * Math.abs(orient(a, b, c));
    for (const v of [a, b, c]) {
      minX = Math.min(minX, vx[v]); maxX = Math.max(maxX, vx[v]);
      minY = Math.min(minY, vy[v]); maxY = Math.max(maxY, vy[v]);
    }
    maxEdge = Math.max(
      maxEdge,
      Math.hypot(vx[a] - vx[b], vy[a] - vy[b]),
      Math.hypot(vx[b] - vx[c], vy[b] - vy[c]),
      Math.hypot(vx[c] - vx[a], vy[c] - vy[a])
    );
  }

  let target = opts.targetEdgeMm && opts.targetEdgeMm > 0
    ? opts.targetEdgeMm
    : maxEdge / Math.pow(2, Math.max(0, opts.maxIterations));
  // uma malha regular de lado s tem ≈ 2·A/(0.866·s²) triângulos
  const minEdgeForBudget = Math.sqrt((2 * area) / (0.866 * Math.max(1, opts.maxFrontTriangles)));
  target = Math.max(target, minEdgeForBudget);


  // Laterais (triângulos fora da frente): guardadas com posições para poder dividir, junto
  // com a frente, as arestas do contorno — assim a malha continua sem rachaduras.
  const wallPos: number[][] = [];
  const wallNorm: number[][] = [];
  const wallAlive: boolean[] = [];
  const wallEdges = new Map<string, number[]>();
  const pk = (x: number, y: number, z: number) => `${fix(x)}|${fix(y)}|${fix(z)}`;
  const wk = (k1: string, k2: string) => (k1 < k2 ? `${k1}#${k2}` : `${k2}#${k1}`);
  const wallCorner = (w: number, c: number) => pk(wallPos[w][c * 3], wallPos[w][c * 3 + 1], wallPos[w][c * 3 + 2]);
  const registerWall = (w: number) => {
    for (let c = 0; c < 3; c++) {
      const key = wk(wallCorner(w, c), wallCorner(w, (c + 1) % 3));
      const list = wallEdges.get(key);
      if (list) list.push(w);
      else wallEdges.set(key, [w]);
    }
  };
  const unregisterWall = (w: number) => {
    for (let c = 0; c < 3; c++) {
      const key = wk(wallCorner(w, c), wallCorner(w, (c + 1) % 3));
      const list = wallEdges.get(key);
      if (!list) continue;
      const idx = list.indexOf(w);
      if (idx >= 0) list.splice(idx, 1);
      if (list.length === 0) wallEdges.delete(key);
    }
  };
  for (let t = 0; t < triCount; t++) {
    if (isFront[t]) continue;
    const pp: number[] = [], nn: number[] = [];
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k;
      pp.push(posArr[i * 3], posArr[i * 3 + 1], posArr[i * 3 + 2]);
      nn.push(normArr[i * 3], normArr[i * 3 + 1], normArr[i * 3 + 2]);
    }
    wallPos.push(pp);
    wallNorm.push(nn);
    wallAlive.push(true);
    registerWall(wallPos.length - 1);
  }

  const lerpVertex = (a: number, b: number, f: number): number => {
    const id = vx.length;
    vx.push(vx[a] + (vx[b] - vx[a]) * f); vy.push(vy[a] + (vy[b] - vy[a]) * f); vz.push(vz[a] + (vz[b] - vz[a]) * f);
    vu.push(vu[a] + (vu[b] - vu[a]) * f); vv.push(vv[a] + (vv[b] - vv[a]) * f);
    vnx.push(vnx[a] + (vnx[b] - vnx[a]) * f); vny.push(vny[a] + (vny[b] - vny[a]) * f); vnz.push(vnz[a] + (vnz[b] - vnz[a]) * f);
    return id;
  };

  /** Divide a aresta fixa (a,b) em segmentos ≤ alvo; refaz os triângulos vizinhos em leque. */
  const splitFixedEdge = (a: number, b: number, k: number) => {
    const key = edgeKey(a, b);
    const tris = [...(edges.get(key) ?? [])];
    if (tris.length === 0 || tris.length > 2) return;

    const mids: number[] = [];
    for (let i = 1; i < k; i++) mids.push(lerpVertex(a, b, i / k));
    const chain = [a, ...mids, b]; // de a até b

    for (const t of tris) {
      const vs = [ta[t], tb[t], tc[t]];
      let i = 0;
      for (; i < 3; i++) {
        const p = vs[i], q = vs[(i + 1) % 3];
        if ((p === a && q === b) || (p === b && q === a)) break;
      }
      const p = vs[i], q = vs[(i + 1) % 3], r = vs[(i + 2) % 3];
      const seq = p === a ? chain : [...chain].reverse(); // de p até q
      removeTri(t);
      for (let j = 0; j < seq.length - 1; j++) addTri(seq[j], seq[j + 1], r);
    }

    constrained.delete(key);
    for (let j = 0; j < chain.length - 1; j++) constrained.add(edgeKey(chain[j], chain[j + 1]));

    if (tris.length === 1) {
      // contorno: refaz também a(s) lateral(is) coladas a esta aresta
      const ka = pk(vx[a], vy[a], vz[a]), kb = pk(vx[b], vy[b], vz[b]);
      for (const w of [...(wallEdges.get(wk(ka, kb)) ?? [])]) {
        if (!wallAlive[w]) continue;
        let c = 0;
        for (; c < 3; c++) {
          const k1 = wallCorner(w, c), k2 = wallCorner(w, (c + 1) % 3);
          if ((k1 === ka && k2 === kb) || (k1 === kb && k2 === ka)) break;
        }
        const P = wallPos[w], N = wallNorm[w];
        const i0 = c, i1 = (c + 1) % 3, i2 = (c + 2) % 3;
        const lerp3 = (arr: number[], i: number, j: number, f: number) => [0, 1, 2].map(d => arr[i * 3 + d] + (arr[j * 3 + d] - arr[i * 3 + d]) * f);
        const pts: Array<{ p: number[]; n: number[] }> = [];
        for (let m = 0; m <= k; m++) {
          // pontos igualmente espaçados de p até q: coincidem com os da frente
          // (mesmo conjunto de posições, independente da direção a→b)
          pts.push({ p: lerp3(P, i0, i1, m / k), n: lerp3(N, i0, i1, m / k) });
        }
        const rP = [P[i2 * 3], P[i2 * 3 + 1], P[i2 * 3 + 2]];
        const rN = [N[i2 * 3], N[i2 * 3 + 1], N[i2 * 3 + 2]];
        wallAlive[w] = false;
        unregisterWall(w);
        for (let m = 0; m < k; m++) {
          wallPos.push([...pts[m].p, ...pts[m + 1].p, ...rP]);
          wallNorm.push([...pts[m].n, ...pts[m + 1].n, ...rN]);
          wallAlive.push(true);
          registerWall(wallPos.length - 1);
        }
      }
    }
  };

  if (area > 0 && target < maxEdge) {
    const longEdges: Array<[number, number, number]> = [];
    constrained.forEach((key) => {
      const a = Math.floor(key / EDGE_KEY_BASE), b = key % EDGE_KEY_BASE;
      const len = Math.hypot(vx[a] - vx[b], vy[a] - vy[b], vz[a] - vz[b]);
      if (len > target * 1.5) longEdges.push([a, b, Math.ceil(len / target)]);
    });
    for (const [a, b, k] of longEdges) splitFixedEdge(a, b, k);
  }

  const cEdges: Array<[number, number]> = [];
  constrained.forEach((key) => cEdges.push([Math.floor(key / EDGE_KEY_BASE), key % EDGE_KEY_BASE]));

  if (area > 0 && target < maxEdge) {
    const rowStep = target * 0.866;
    const margin = target * 0.45; // evita fatias finas junto ao contorno
    let last = 0;
    let row = 0;
    for (let y = minY + rowStep * 0.5; y <= maxY; y += rowStep, row++) {
      const x0 = minX + (row % 2 === 0 ? target * 0.5 : target);
      for (let x = x0; x <= maxX; x += target) {
        const t = locate(x, y, last);
        if (t < 0) continue;
        last = t;
        if (distToConstrained(x, y, margin) < margin) continue;

        const a = ta[t], b = tb[t], c = tc[t];
        const den = (vy[b] - vy[c]) * (vx[a] - vx[c]) + (vx[c] - vx[b]) * (vy[a] - vy[c]);
        if (Math.abs(den) < 1e-12) continue;
        const l1 = ((vy[b] - vy[c]) * (x - vx[c]) + (vx[c] - vx[b]) * (y - vy[c])) / den;
        const l2 = ((vy[c] - vy[a]) * (x - vx[c]) + (vx[a] - vx[c]) * (y - vy[c])) / den;
        const l3 = 1 - l1 - l2;
        if (Math.min(l1, l2, l3) < 1e-4) continue; // sobre uma aresta: pula o ponto

        const p = vx.length;
        vx.push(x); vy.push(y);
        vz.push(l1 * vz[a] + l2 * vz[b] + l3 * vz[c]);
        vu.push(l1 * vu[a] + l2 * vu[b] + l3 * vu[c]);
        vv.push(l1 * vv[a] + l2 * vv[b] + l3 * vv[c]);
        vnx.push(l1 * vnx[a] + l2 * vnx[b] + l3 * vnx[c]);
        vny.push(l1 * vny[a] + l2 * vny[b] + l3 * vny[c]);
        vnz.push(l1 * vnz[a] + l2 * vnz[b] + l3 * vnz[c]);

        removeTri(t);
        const t1 = addTri(a, b, p), t2 = addTri(b, c, p), t3 = addTri(c, a, p);
        legalize(t1, a, b, p, 0);
        legalize(t2, b, c, p, 0);
        legalize(t3, c, a, p, 0);
        last = alive[t1] ? t1 : alive[t2] ? t2 : alive[t3] ? t3 : last;
      }
    }

    // passada final: Delaunay global (desfaz as agulhas que sobraram da triangulação original)
    const queue: Array<[number, number]> = [];
    edges.forEach((list, key) => {
      if (list.length === 2 && !constrained.has(key)) queue.push([Math.floor(key / EDGE_KEY_BASE), key % EDGE_KEY_BASE]);
    });
    let guard = queue.length * 30 + 1000;
    while (queue.length > 0 && guard-- > 0) {
      const [p, q] = queue.pop()!;
      const key = edgeKey(p, q);
      const list = edges.get(key);
      if (!list || list.length !== 2 || constrained.has(key)) continue;
      const [t, n] = list;
      const r = thirdVertex(t, p, q), s = thirdVertex(n, p, q);
      if (inCircle(p, q, r, s) <= 1e-9 || !isConvexQuad(p, q, r, s)) continue;
      // t = (.., p→q ..) ou (.., q→p ..): normaliza para a convenção de flip()
      const forward = (ta[t] === p && tb[t] === q) || (tb[t] === p && tc[t] === q) || (tc[t] === p && ta[t] === q);
      const [tt, nn, pp, qq, rr, ss] = forward ? [t, n, p, q, r, s] : [n, t, p, q, s, r];
      const [f1, f2] = flip(tt, nn, pp, qq, rr, ss);
      void f1; void f2;
      queue.push([pp, ss], [ss, qq], [qq, rr], [rr, pp]);
    }
  }

  // ---- 6. Saída: laterais/fundo originais + frente refinada ----
  const outPos: number[] = [];
  const outNorm: number[] = [];
  const outUv: number[] = [];

  for (let w = 0; w < wallPos.length; w++) {
    if (!wallAlive[w]) continue;
    for (let k = 0; k < 3; k++) {
      outPos.push(wallPos[w][k * 3], wallPos[w][k * 3 + 1], wallPos[w][k * 3 + 2]);
      outNorm.push(wallNorm[w][k * 3], wallNorm[w][k * 3 + 1], wallNorm[w][k * 3 + 2]);
      outUv.push(0, 0);
    }
  }
  for (let t = 0; t < ta.length; t++) {
    if (!alive[t]) continue;
    for (const v of [ta[t], tb[t], tc[t]]) {
      outPos.push(vx[v], vy[v], vz[v]);
      outNorm.push(vnx[v], vny[v], vnz[v]);
      outUv.push(vu[v], vv[v]);
    }
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.BufferAttribute(new Float32Array(outPos), 3));
  result.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(outNorm), 3));
  result.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(outUv), 2));
  result.computeVertexNormals();
  return result;
}
