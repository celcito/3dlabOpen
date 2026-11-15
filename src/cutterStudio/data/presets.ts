import { ModelLineart, Point2D, Path2D } from '../types';

/**
 * High-precision parametric geometry generators for bakery-grade 3D cookie cutters
 */

// Helper to generate smooth circle points
function makeCircle(cx: number, cy: number, r: number, steps: number = 36): Path2D {
  const pts: Point2D[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([
      Math.round((cx + Math.cos(a) * r) * 100) / 100,
      Math.round((cy + Math.sin(a) * r) * 100) / 100,
    ]);
  }
  return pts;
}

// Helper to generate smooth ellipse
function makeEllipse(cx: number, cy: number, rx: number, ry: number, steps: number = 36): Path2D {
  const pts: Point2D[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([
      Math.round((cx + Math.cos(a) * rx) * 100) / 100,
      Math.round((cy + Math.sin(a) * ry) * 100) / 100,
    ]);
  }
  return pts;
}

// Helper to generate smooth arc
function makeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, steps: number = 18): Path2D {
  const pts: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (i / steps) * (endAngle - startAngle);
    pts.push([
      Math.round((cx + Math.cos(a) * r) * 100) / 100,
      Math.round((cy + Math.sin(a) * r) * 100) / 100,
    ]);
  }
  return pts;
}

// Helper to generate mathematical cardioid heart with smooth continuous curvature
function makeSmoothHeart(cx: number, cy: number, scale: number, steps: number = 64): Path2D {
  const pts: Point2D[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([
      Math.round((cx + (x * scale) / 16) * 100) / 100,
      Math.round((cy + (y * scale) / 16) * 100) / 100,
    ]);
  }
  return pts;
}

// Helper to generate smooth scalloped flower
function makeSmoothFlower(cx: number, cy: number, innerR: number, outerR: number, petals: number, steps: number = 72): Path2D {
  const pts: Point2D[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wave = (Math.cos(a * petals) + 1) / 2;
    const r = innerR + Math.pow(wave, 0.8) * (outerR - innerR);
    pts.push([
      Math.round((cx + Math.cos(a) * r) * 100) / 100,
      Math.round((cy + Math.sin(a) * r) * 100) / 100,
    ]);
  }
  return pts;
}

// Helper for smooth 5-pointed star with filleted rounded tips and rounded valleys
function makeSmoothStar(cx: number, cy: number, rOuter: number, rInner: number, points: number = 5, steps: number = 60): Path2D {
  const pts: Point2D[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    // Harmonic smoothing between outer and inner radius
    const wave = (Math.cos(a * points) + 1) / 2;
    const smoothWave = 0.5 - 0.5 * Math.cos(wave * Math.PI);
    const r = rInner + smoothWave * (rOuter - rInner);
    pts.push([
      Math.round((cx + Math.cos(a) * r) * 100) / 100,
      Math.round((cy + Math.sin(a) * r) * 100) / 100,
    ]);
  }
  return pts;
}

// Cubic Bézier curve generator between 4 control points
function cubicBezier(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, steps: number = 10): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    const x = uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0];
    const y = uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1];
    pts.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
  }
  return pts;
}

// Builds a closed path by connecting cubic Bézier segment tuples [P0, P1, P2, P3]
function makeBezierContour(segments: [Point2D, Point2D, Point2D, Point2D][], stepsPerSegment: number = 8): Path2D {
  const pts: Point2D[] = [];
  for (let s = 0; s < segments.length; s++) {
    const [p0, p1, p2, p3] = segments[s];
    const segPts = cubicBezier(p0, p1, p2, p3, stepsPerSegment);
    if (s > 0) segPts.shift(); // avoid duplicate seam
    pts.push(...segPts);
  }
  return pts;
}

export const PRESET_MODELS: ModelLineart[] = [
  // 1. CUPCAKE CONFEITARIA
  {
    id: 'cupcake',
    name: 'Cupcake Confeitaria',
    category: 'confectionery',
    categoryLabel: 'Confeitaria',
    description: 'Cupcake clássico com forminha frisada, cobertura espiralada em 3 níveis e cereja no topo.',
    iconName: 'Cake',
    outerPerimeter: makeBezierContour([
      // Bottom liner
      [[26, 92], [38, 93], [62, 93], [74, 92]],
      // Liner right wall
      [[74, 92], [80, 75], [84, 58], [86, 52]],
      // Bottom swirl right
      [[86, 52], [93, 49], [92, 38], [82, 36]],
      // Middle swirl right
      [[82, 36], [87, 28], [78, 20], [68, 17]],
      // Top swirl to cherry
      [[68, 17], [64, 12], [57, 6], [50, 5]],
      // Top swirl left
      [[50, 5], [43, 6], [36, 12], [32, 17]],
      // Middle swirl left
      [[32, 17], [22, 20], [13, 28], [18, 36]],
      // Bottom swirl left
      [[18, 36], [8, 38], [7, 49], [14, 52]],
      // Liner left wall
      [[14, 52], [16, 58], [20, 75], [26, 92]],
    ], 10),
    innerDetails: [
      // Cherry top dome
      makeCircle(50, 13, 5.5, 24),
      // Cherry stem
      [[50, 7.5], [54, 5], [58, 6.5]],
      // Frosting tier 1 (top swirl)
      [[36, 22], [44, 20], [56, 20], [64, 22]],
      // Frosting tier 2 (mid swirl)
      [[25, 33], [36, 30], [50, 29], [64, 30], [75, 33]],
      // Frosting tier 3 (bottom swirl above liner)
      [[18, 48], [32, 45], [50, 44], [68, 45], [82, 48]],
      // Liner top rim
      [[17, 53], [33, 53], [50, 53], [67, 53], [83, 53]],
      // Vertical liner flutes (firmly anchored inside the cup)
      [[26, 54], [31, 91]],
      [[38, 54], [40, 91]],
      [[50, 54], [50, 91]],
      [[62, 54], [60, 91]],
      [[74, 54], [69, 91]],
    ],
  },

  // 2. BONECO DE GENGIBRE
  {
    id: 'gingerbread',
    name: 'Boneco de Gengibre',
    category: 'holidays',
    categoryLabel: 'Datas Comemorativas',
    description: 'Clássico biscoito de Natal com cabeça arredondada, gravatinha borboleta, botões e glacê nas mangas.',
    iconName: 'Gift',
    outerPerimeter: makeBezierContour([
      // Head right
      [[50, 6], [62, 6], [68, 16], [67, 26]],
      // Neck right to shoulder
      [[67, 26], [64, 30], [68, 34], [74, 36]],
      // Right arm top
      [[74, 36], [84, 42], [91, 46], [93, 52]],
      // Right hand rounded
      [[93, 52], [93, 59], [86, 61], [81, 56]],
      // Right arm bottom to waist
      [[81, 56], [74, 51], [67, 49], [64, 56]],
      // Right waist to right leg
      [[64, 56], [63, 68], [73, 80], [77, 87]],
      // Right foot rounded
      [[77, 87], [78, 93], [68, 94], [62, 89]],
      // Inseam crotch
      [[62, 89], [56, 81], [50, 74], [44, 81]],
      // Left foot rounded
      [[44, 81], [38, 89], [32, 94], [23, 93]],
      // Left leg to waist
      [[23, 93], [27, 87], [37, 80], [36, 56]],
      // Left waist to left arm bottom
      [[36, 56], [33, 49], [26, 51], [19, 56]],
      // Left hand rounded
      [[19, 56], [14, 61], [7, 59], [7, 52]],
      // Left arm top to shoulder
      [[7, 52], [9, 46], [16, 42], [26, 36]],
      // Left shoulder to neck
      [[26, 36], [32, 34], [36, 30], [33, 26]],
      // Left head to top
      [[33, 26], [32, 16], [38, 6], [50, 6]],
    ], 10),
    innerDetails: [
      // Eyes
      makeCircle(43, 17, 2.6, 16),
      makeCircle(57, 17, 2.6, 16),
      // Cheerful smile
      makeArc(50, 21, 5, 0.3 * Math.PI, 0.7 * Math.PI, 12),
      // Bowtie center knot & wings
      makeCircle(50, 31, 2.4, 12),
      [[50, 31], [42, 28], [42, 34], [50, 31]],
      [[50, 31], [58, 28], [58, 34], [50, 31]],
      // Buttons on tummy
      makeCircle(50, 43, 3.2, 16),
      makeCircle(50, 55, 3.2, 16),
      // Wrist frosting wave left
      [[14, 49], [17, 54], [21, 48], [24, 53]],
      // Wrist frosting wave right
      [[86, 49], [83, 54], [79, 48], [76, 53]],
      // Ankle frosting wave left
      [[28, 87], [32, 83], [36, 87], [40, 83]],
      // Ankle frosting wave right
      [[72, 87], [68, 83], [64, 87], [60, 83]],
    ],
  },

  // 3. PATINHA PET
  {
    id: 'paw',
    name: 'Patinha Pet',
    category: 'animals',
    categoryLabel: 'Animais & Pets',
    description: 'Patinha de cachorro ou gato com almofadinha anatômica central e 4 dedinhos arredondados.',
    iconName: 'Footprints',
    outerPerimeter: makeBezierContour([
      // Base pad bottom
      [[32, 92], [50, 95], [68, 92], [80, 82]],
      // Right cheek
      [[80, 82], [88, 70], [88, 52], [82, 42]],
      // Right toe 4
      [[82, 42], [91, 35], [91, 20], [80, 16]],
      // Valley toe 4 to 3
      [[80, 16], [73, 16], [71, 24], [67, 18]],
      // Center-right toe 3
      [[67, 18], [69, 7], [56, 5], [52, 15]],
      // Valley toe 3 to 2
      [[52, 15], [50, 20], [48, 15], [48, 15]],
      // Center-left toe 2
      [[48, 15], [44, 5], [31, 7], [33, 18]],
      // Valley toe 2 to 1
      [[33, 18], [29, 24], [27, 16], [20, 16]],
      // Left toe 1
      [[20, 16], [9, 20], [9, 35], [18, 42]],
      // Left cheek
      [[18, 42], [12, 52], [12, 70], [20, 82]],
      // Left cheek to bottom
      [[20, 82], [24, 88], [28, 91], [32, 92]],
    ], 10),
    innerDetails: [
      // Central heart-shaped main pad
      makeBezierContour([
        [[50, 86], [62, 86], [72, 78], [72, 65]],
        [[72, 65], [72, 55], [62, 49], [50, 55]],
        [[50, 55], [38, 49], [28, 55], [28, 65]],
        [[28, 65], [28, 78], [38, 86], [50, 86]],
      ], 8),
      // 4 Toe pads
      makeEllipse(21, 29, 6.5, 7.5, 24),
      makeEllipse(39, 18, 7.5, 9.0, 24),
      makeEllipse(61, 18, 7.5, 9.0, 24),
      makeEllipse(79, 29, 6.5, 7.5, 24),
    ],
  },

  // 4. GATINHO KAWAII
  {
    id: 'cat_face',
    name: 'Gatinho Kawaii',
    category: 'animals',
    categoryLabel: 'Animais & Pets',
    description: 'Rostinho de gatinho meigo com bochechas fofas, olhinhos sorridentes, focinho de coração e bigodes.',
    iconName: 'Cat',
    outerPerimeter: makeBezierContour([
      // Top between ears
      [[40, 20], [50, 21], [60, 20], [68, 17]],
      // Right ear up
      [[68, 17], [78, 12], [84, 7], [85, 12]],
      // Right ear down to cheek
      [[85, 12], [86, 24], [83, 33], [87, 40]],
      // Right cheek round
      [[87, 40], [95, 54], [92, 72], [78, 84]],
      // Chin
      [[78, 84], [66, 91], [50, 92], [34, 91]],
      // Left cheek round
      [[34, 91], [22, 84], [8, 72], [5, 54]],
      // Left cheek to ear
      [[5, 54], [9, 40], [13, 33], [15, 24]],
      // Left ear up
      [[15, 24], [16, 12], [22, 7], [32, 17]],
      // Left ear to top
      [[32, 17], [35, 19], [38, 20], [40, 20]],
    ], 10),
    innerDetails: [
      // Right ear inner fold
      [[70, 21], [78, 15], [80, 29], [70, 21]],
      // Left ear inner fold
      [[30, 21], [22, 15], [20, 29], [30, 21]],
      // Cute smiling arched eyes
      makeArc(33, 49, 6.5, 1.15 * Math.PI, 1.85 * Math.PI, 16),
      makeArc(67, 49, 6.5, 1.15 * Math.PI, 1.85 * Math.PI, 16),
      // Eyelashes
      [[27, 45], [24, 43]],
      [[73, 45], [76, 43]],
      // Heart nose
      makeSmoothHeart(50, 58, 7.5, 24),
      // Mouth curves
      [[50, 62], [50, 66]],
      [[50, 66], [44, 71], [38, 68]],
      [[50, 66], [56, 71], [62, 68]],
      // Whiskers left (firmly inside cheeks)
      [[32, 62], [14, 60]],
      [[32, 67], [16, 70]],
      // Whiskers right (firmly inside cheeks)
      [[68, 62], [86, 60]],
      [[68, 67], [84, 70]],
    ],
  },

  // 5. ÁRVORE DE NATAL
  {
    id: 'christmas_tree',
    name: 'Árvore de Natal',
    category: 'holidays',
    categoryLabel: 'Datas Comemorativas',
    description: 'Pinheiro natalino com estrela no topo, 3 andares de ramos arredondados, guirlandas e bolas.',
    iconName: 'Sparkles',
    outerPerimeter: makeBezierContour([
      // Star top
      [[50, 4], [53, 10], [60, 11], [55, 16]],
      [[55, 16], [57, 22], [50, 19], [43, 22]],
      [[43, 22], [45, 16], [40, 11], [47, 10]],
      [[47, 10], [50, 4], [50, 4], [52, 22]],
      // Top branch tier right
      [[52, 22], [60, 32], [67, 39], [62, 42]],
      // Mid branch tier right
      [[62, 42], [72, 50], [79, 58], [72, 61]],
      // Bottom branch tier right
      [[72, 61], [82, 70], [89, 78], [68, 78]],
      // Trunk right & bottom
      [[68, 78], [66, 86], [66, 93], [50, 93]],
      // Trunk left & bottom
      [[50, 93], [34, 93], [34, 86], [32, 78]],
      // Bottom branch tier left
      [[32, 78], [11, 78], [18, 70], [28, 61]],
      // Mid branch tier left
      [[28, 61], [21, 58], [28, 50], [38, 42]],
      // Top branch tier left
      [[38, 42], [33, 39], [40, 32], [48, 22]],
    ], 8),
    innerDetails: [
      // Star inner facets
      [[50, 6], [50, 18]],
      [[44, 12], [56, 12]],
      // Garland tier 1
      makeArc(50, 27, 14, 0.25 * Math.PI, 0.75 * Math.PI, 14),
      // Garland tier 2
      makeArc(50, 44, 21, 0.2 * Math.PI, 0.8 * Math.PI, 18),
      // Garland tier 3
      makeArc(50, 61, 28, 0.18 * Math.PI, 0.82 * Math.PI, 22),
      // Ornaments (baubles)
      makeCircle(48, 38, 2.8, 14),
      makeCircle(38, 56, 3.2, 14),
      makeCircle(62, 56, 3.2, 14),
      makeCircle(29, 74, 3.5, 14),
      makeCircle(50, 75, 3.5, 14),
      makeCircle(71, 74, 3.5, 14),
      // Trunk vertical lines
      [[42, 80], [42, 92]],
      [[50, 80], [50, 92]],
      [[58, 80], [58, 92]],
    ],
  },

  // 6. BOLO DE ANIVERSÁRIO
  {
    id: 'birthday_cake',
    name: 'Bolo de Aniversário',
    category: 'confectionery',
    categoryLabel: 'Confeitaria',
    description: 'Bolo festivo com 2 andares, calda escorrendo, prato trabalhado e 3 velas acesas com chamas.',
    iconName: 'Cake',
    outerPerimeter: makeBezierContour([
      // Plate base bottom
      [[14, 91], [30, 95], [70, 95], [86, 91]],
      // Plate right edge
      [[86, 91], [89, 87], [85, 84], [81, 84]],
      // Bottom layer right wall
      [[81, 84], [81, 62], [76, 58], [74, 58]],
      // Top layer right wall
      [[74, 58], [74, 37], [68, 35], [66, 35]],
      // Right candle
      [[66, 35], [66, 21], [63, 11], [60, 21]],
      [[60, 21], [60, 35], [54, 35], [54, 35]],
      // Middle candle
      [[54, 35], [54, 18], [50, 8], [46, 18]],
      [[46, 18], [46, 35], [40, 35], [40, 35]],
      // Left candle
      [[40, 35], [40, 21], [37, 11], [34, 21]],
      [[34, 21], [34, 35], [32, 35], [26, 37]],
      // Top layer left wall
      [[26, 37], [26, 58], [24, 58], [19, 62]],
      // Bottom layer left wall
      [[19, 62], [19, 84], [15, 84], [11, 87]],
      // Plate left edge to bottom
      [[11, 87], [11, 91], [14, 91], [14, 91]],
    ], 10),
    innerDetails: [
      // Candle flames
      makeSmoothHeart(37, 16, 3.5, 14),
      makeSmoothHeart(50, 13, 3.5, 14),
      makeSmoothHeart(63, 16, 3.5, 14),
      // Top layer frosting drips
      [[27, 44], [34, 48], [42, 42], [50, 49], [58, 43], [66, 48], [73, 44]],
      // Top layer base line
      [[26, 58], [74, 58]],
      // Bottom layer frosting drips
      [[20, 68], [29, 74], [40, 66], [51, 75], [62, 67], [71, 74], [80, 68]],
      // Bottom layer base line
      [[19, 84], [81, 84]],
      // Decorative rosettes
      makeCircle(32, 54, 2.2, 12),
      makeCircle(50, 54, 2.2, 12),
      makeCircle(68, 54, 2.2, 12),
      makeCircle(28, 79, 2.2, 12),
      makeCircle(50, 79, 2.2, 12),
      makeCircle(72, 79, 2.2, 12),
    ],
  },

  // 7. CORAÇÃO ROMÂNTICO
  {
    id: 'heart_romantic',
    name: 'Coração Romântico',
    category: 'holidays',
    categoryLabel: 'Datas Comemorativas',
    description: 'Coração refinado com curvatura perfeita, borda concêntrica interna e arabescos florais.',
    iconName: 'Heart',
    outerPerimeter: makeSmoothHeart(50, 48, 48, 64),
    innerDetails: [
      // Concentric inner heart border (safe 5mm margin)
      makeSmoothHeart(50, 49, 36, 54),
      // Third mini decorative heart in center
      makeSmoothHeart(50, 53, 14, 32),
      // Elegant center vertical axis line
      [[50, 26], [50, 42]],
      [[50, 62], [50, 76]],
      // Left filigree scroll
      [[42, 38], [34, 42], [32, 50], [40, 52], [46, 48]],
      // Right filigree scroll
      [[58, 38], [66, 42], [68, 50], [60, 52], [54, 48]],
    ],
  },

  // 8. COELHINHO DA PÁSCOA
  {
    id: 'easter_bunny',
    name: 'Coelhinho da Páscoa',
    category: 'animals',
    categoryLabel: 'Animais & Pets',
    description: 'Coelhinho com orelhas compridas arredondadas, bochechas fofas, dentes da frente e bigodinhos.',
    iconName: 'Smile',
    outerPerimeter: makeBezierContour([
      // Chin bottom
      [[36, 88], [50, 92], [64, 88], [76, 81]],
      // Right cheek
      [[76, 81], [86, 70], [86, 52], [77, 42]],
      // Right ear outer
      [[77, 42], [82, 22], [80, 6], [69, 6]],
      // Right ear inner to head
      [[69, 6], [62, 18], [58, 36], [54, 38]],
      // Head between ears
      [[54, 38], [50, 39], [46, 38], [46, 38]],
      // Left ear inner to tip
      [[46, 38], [42, 36], [38, 18], [31, 6]],
      // Left ear outer
      [[31, 6], [20, 6], [18, 22], [23, 42]],
      // Left cheek
      [[23, 42], [14, 52], [14, 70], [24, 81]],
      // Left cheek to chin
      [[24, 81], [30, 86], [36, 88], [36, 88]],
    ], 10),
    innerDetails: [
      // Ear inner grooves
      makeBezierContour([
        [[28, 11], [32, 11], [32, 30], [26, 30]],
        [[26, 30], [22, 24], [24, 11], [28, 11]],
      ], 6),
      makeBezierContour([
        [[72, 11], [76, 11], [78, 24], [74, 30]],
        [[74, 30], [68, 30], [68, 11], [72, 11]],
      ], 6),
      // Big expressive cartoon eyes
      makeEllipse(36, 54, 4.5, 5.5, 20),
      makeEllipse(64, 54, 4.5, 5.5, 20),
      // Eye sparkles
      makeCircle(37.5, 52.5, 1.6, 12),
      makeCircle(65.5, 52.5, 1.6, 12),
      // Heart nose
      makeSmoothHeart(50, 65, 4.8, 18),
      // Buck teeth
      [[50, 68], [50, 78]],
      [[45, 72], [55, 72]],
      [[46, 72], [46, 78], [50, 78]],
      [[50, 78], [54, 78], [54, 72]],
      // Cheeks & Whiskers (safely inset)
      [[33, 67], [20, 65]],
      [[33, 71], [19, 73]],
      [[67, 67], [80, 65]],
      [[67, 71], [81, 73]],
    ],
  },

  // 9. ABÓBORA DE HALLOWEEN
  {
    id: 'pumpkin_halloween',
    name: 'Abóbora Jack-o\'-lantern',
    category: 'holidays',
    categoryLabel: 'Datas Comemorativas',
    description: 'Abóbora de Halloween clássica com gomos arredondados, talo curvo e carimbo assustador de olhos e dentes.',
    iconName: 'Ghost',
    outerPerimeter: makeBezierContour([
      // Stem
      [[47, 18], [47, 8], [53, 5], [57, 7]],
      [[57, 7], [56, 15], [53, 18], [53, 18]],
      // Right upper lobe
      [[53, 18], [68, 16], [84, 24], [92, 40]],
      // Right lower lobe
      [[92, 40], [97, 60], [89, 78], [75, 88]],
      // Center bottom notch
      [[75, 88], [63, 93], [50, 91], [37, 93]],
      // Left lower lobe
      [[37, 93], [25, 88], [11, 78], [8, 60]],
      // Left upper lobe
      [[8, 60], [16, 40], [32, 24], [47, 18]],
    ], 10),
    innerDetails: [
      // Vertical lobe ribs (giving 3D gourd volume)
      makeArc(35, 54, 38, 0.65 * Math.PI, 1.35 * Math.PI, 16),
      makeArc(65, 54, 38, -0.35 * Math.PI, 0.35 * Math.PI, 16),
      [[50, 20], [48, 50], [50, 90]],
      // Triangle eyes
      [[31, 42], [43, 42], [37, 32], [31, 42]],
      [[57, 42], [69, 42], [63, 32], [57, 42]],
      // Triangle nose
      [[46, 52], [54, 52], [50, 46], [46, 52]],
      // Wide Jack-o'-lantern smile with carved teeth
      [
        [24, 63], [32, 67], [36, 61], [42, 67], [50, 62],
        [58, 67], [64, 61], [68, 67], [76, 63],
        [71, 76], [61, 78], [57, 71], [50, 77], [43, 71], [39, 78], [29, 76], [24, 63]
      ],
    ],
  },

  // 10. COSTELA DE ADÃO
  {
    id: 'monstera_leaf',
    name: 'Costela de Adão',
    category: 'botanical',
    categoryLabel: 'Botânica',
    description: 'Folha tropical com recortes laterais característicos, nervura central e furos anatômicos internos.',
    iconName: 'Leaf',
    outerPerimeter: makeBezierContour([
      // Leaf tip
      [[50, 4], [57, 12], [66, 15], [62, 23]],
      // Right cutout 1
      [[62, 23], [76, 23], [72, 33], [84, 37]],
      // Right cutout 2
      [[84, 37], [76, 47], [85, 54], [75, 65]],
      // Right cutout 3 & base
      [[75, 65], [78, 73], [67, 80], [56, 86]],
      // Stem
      [[56, 86], [55, 96], [45, 96], [44, 86]],
      // Left cutout 3 & base
      [[44, 86], [33, 80], [22, 73], [25, 65]],
      // Left cutout 2
      [[25, 65], [15, 54], [24, 47], [16, 37]],
      // Left cutout 1
      [[16, 37], [28, 33], [24, 23], [38, 23]],
      // Back to tip
      [[38, 23], [34, 15], [43, 12], [50, 4]],
    ], 10),
    innerDetails: [
      // Main central vein
      [[50, 8], [50, 86]],
      // Right branch veins
      [[50, 22], [63, 19]],
      [[50, 34], [71, 30]],
      [[50, 48], [76, 43]],
      [[50, 62], [73, 60]],
      [[50, 74], [65, 75]],
      // Left branch veins
      [[50, 22], [37, 19]],
      [[50, 34], [29, 30]],
      [[50, 48], [24, 43]],
      [[50, 62], [27, 60]],
      [[50, 74], [35, 75]],
      // Internal leaf fenestrations (oval openings)
      makeEllipse(44, 36, 2.5, 4.5, 16),
      makeEllipse(56, 42, 2.5, 5.0, 16),
      makeEllipse(43, 54, 2.8, 5.5, 16),
      makeEllipse(57, 58, 2.8, 5.5, 16),
    ],
  },

  // 11. FLOR MARGARIDA
  {
    id: 'flower_daisy',
    name: 'Flor Margarida / Girassol',
    category: 'botanical',
    categoryLabel: 'Botânica',
    description: 'Margarida com 12 pétalas arredondadas simétricas, miolo duplo e nervuras radiais.',
    iconName: 'Sun',
    outerPerimeter: makeSmoothFlower(50, 50, 33, 48, 12, 72),
    innerDetails: [
      // Outer seed disc ring
      makeCircle(50, 50, 16, 32),
      // Inner concentric disc
      makeCircle(50, 50, 9, 24),
      // Center dot
      makeCircle(50, 50, 3.5, 12),
      // Radial petal separation lines
      [[50, 34], [50, 46]],
      [[50, 54], [50, 66]],
      [[34, 50], [46, 50]],
      [[54, 50], [66, 50]],
      [[39, 39], [46, 46]],
      [[54, 54], [61, 61]],
      [[61, 39], [54, 46]],
      [[46, 54], [39, 61]],
    ],
  },

  // 12. PLACA PROVENÇAL / MOLDURA VINTAGE
  {
    id: 'vintage_frame',
    name: 'Placa Provençal / Vitoriana',
    category: 'frames',
    categoryLabel: 'Molduras & Placas',
    description: 'Moldura barroca clássica com cantos recortados em arabesco, perfeita para casamentos e frases.',
    iconName: 'Square',
    outerPerimeter: makeBezierContour([
      // Top crest
      [[18, 18], [32, 13], [44, 18], [50, 12]],
      [[50, 12], [56, 18], [68, 13], [82, 18]],
      // Right edge lobe
      [[82, 18], [88, 26], [85, 38], [92, 50]],
      [[92, 50], [85, 62], [88, 74], [82, 82]],
      // Bottom crest
      [[82, 82], [68, 87], [56, 82], [50, 88]],
      [[50, 88], [44, 82], [32, 87], [18, 82]],
      // Left edge lobe
      [[18, 82], [12, 74], [15, 62], [8, 50]],
      [[8, 50], [15, 38], [12, 26], [18, 18]],
    ], 10),
    innerDetails: [
      // Concentric inner bevel frame (uniform 5mm inset for lettering or stamping)
      makeBezierContour([
        [[23, 23], [34, 19], [44, 23], [50, 18]],
        [[50, 18], [56, 23], [66, 19], [77, 23]],
        [[77, 23], [82, 30], [79, 40], [85, 50]],
        [[85, 50], [79, 60], [82, 70], [77, 77]],
        [[77, 77], [66, 81], [56, 77], [50, 82]],
        [[50, 82], [44, 77], [34, 81], [23, 77]],
        [[23, 77], [18, 70], [21, 60], [15, 50]],
        [[15, 50], [21, 40], [18, 30], [23, 23]],
      ], 8),
      // Corner filigree accents
      [[27, 27], [35, 35]],
      [[73, 27], [65, 35]],
      [[27, 73], [35, 65]],
      [[73, 73], [65, 65]],
    ],
  },

  // 13. DONUT GLACEADO
  {
    id: 'donut',
    name: 'Donut Glaceado',
    category: 'confectionery',
    categoryLabel: 'Confeitaria',
    description: 'Donut americano clássico com furo central, cobertura ondulada e confeitos divertidos.',
    iconName: 'Disc',
    outerPerimeter: makeCircle(50, 50, 44, 48),
    innerDetails: [
      // Donut center hole ring (firm 2mm thickness)
      makeCircle(50, 50, 15, 32),
      // Wavy melting glaze drip line
      makeBezierContour([
        [[88, 50], [86, 62], [76, 68], [78, 76]],
        [[78, 76], [71, 83], [58, 80], [50, 85]],
        [[50, 85], [38, 81], [32, 85], [23, 76]],
        [[23, 76], [16, 68], [22, 57], [14, 48]],
        [[14, 48], [19, 34], [30, 24], [42, 27]],
        [[42, 27], [52, 17], [66, 21], [77, 28]],
        [[77, 28], [84, 38], [88, 50], [88, 50]],
      ], 8),
      // Sprinkles (confeitos) - well spaced and fully supported
      makeEllipse(33, 34, 2.2, 4.2, 12),
      makeEllipse(63, 25, 4.2, 2.2, 12),
      makeEllipse(75, 41, 2.2, 4.2, 12),
      makeEllipse(27, 56, 4.2, 2.2, 12),
      makeEllipse(70, 64, 4.2, 2.2, 12),
      makeEllipse(41, 72, 4.2, 2.2, 12),
      makeEllipse(59, 74, 2.2, 4.2, 12),
      makeEllipse(28, 43, 2.2, 4.2, 12),
    ],
  },

  // 14. ESTRELA MÁGICA
  {
    id: 'star_faceted',
    name: 'Estrela Mágica',
    category: 'holidays',
    categoryLabel: 'Datas Comemorativas',
    description: 'Estrela de 5 pontas com curvas suaves nas pontas e vales para impressão perfeita, com facetas 3D.',
    iconName: 'Star',
    outerPerimeter: makeSmoothStar(50, 50, 46, 21, 5, 60),
    innerDetails: [
      // 10 Facet lines converging at center hub (50, 50)
      [[50, 4], [50, 50]],
      [[77, 24], [50, 50]],
      [[94, 36], [50, 50]],
      [[69, 58], [50, 50]],
      [[77, 87], [50, 50]],
      [[50, 71], [50, 50]],
      [[23, 87], [50, 50]],
      [[31, 58], [50, 50]],
      [[6, 36], [50, 50]],
      [[23, 24], [50, 50]],
      // Central concentric mini-star
      makeSmoothStar(50, 50, 11, 5.5, 5, 30),
    ],
  },

  // 15. URSINHO TEDDY
  {
    id: 'teddy_bear',
    name: 'Ursinho Teddy',
    category: 'animals',
    categoryLabel: 'Animais & Pets',
    description: 'Ursinho meigo com orelhas arredondadas, focinho carinhoso, olhos vivos e bochechas doces.',
    iconName: 'Smile',
    outerPerimeter: makeBezierContour([
      // Top between ears
      [[42, 21], [50, 22], [58, 21], [64, 18]],
      // Right ear
      [[64, 18], [74, 12], [84, 19], [84, 32]],
      // Right cheek
      [[84, 32], [76, 38], [86, 52], [88, 68]],
      // Chin
      [[88, 68], [80, 84], [64, 91], [50, 92]],
      // Left cheek
      [[50, 92], [36, 91], [20, 84], [12, 68]],
      // Left ear
      [[12, 68], [14, 52], [24, 38], [16, 32]],
      // Left ear to top
      [[16, 32], [16, 19], [26, 12], [36, 18]],
      [[36, 18], [42, 21], [42, 21], [42, 21]],
    ], 10),
    innerDetails: [
      // Ear inner circles
      makeCircle(25, 27, 5.5, 20),
      makeCircle(75, 27, 5.5, 20),
      // Big expressive eyes
      makeCircle(36, 48, 3.8, 16),
      makeCircle(64, 48, 3.8, 16),
      // Eye catchlights
      makeCircle(37, 47, 1.2, 8),
      makeCircle(65, 47, 1.2, 8),
      // Snout patch
      makeEllipse(50, 68, 14, 11, 24),
      // Heart nose
      makeSmoothHeart(50, 64, 5.0, 16),
      // Warm smile
      [[50, 67], [50, 73]],
      [[50, 73], [44, 76]],
      [[50, 73], [56, 76]],
    ],
  },

  // 16. NUVEM KAWAII
  {
    id: 'cloud_kawaii',
    name: 'Nuvem Kawaii',
    category: 'frames',
    categoryLabel: 'Molduras & Placas',
    description: 'Nuvem fofinha em 5 gomos arredondados com olhinhos fechados, bochechas rosadas e sorriso meigo.',
    iconName: 'Cloud',
    outerPerimeter: makeBezierContour([
      // Flat soft bottom
      [[22, 78], [50, 79], [78, 78], [84, 76]],
      // Right bottom puff
      [[84, 76], [94, 70], [95, 56], [88, 47]],
      // Right top puff
      [[88, 47], [85, 36], [75, 30], [66, 32]],
      // Center tall puff
      [[66, 32], [58, 18], [42, 18], [34, 32]],
      // Left top puff
      [[34, 32], [25, 30], [15, 36], [12, 47]],
      // Left bottom puff
      [[12, 47], [5, 56], [6, 70], [16, 76]],
      // Back to bottom
      [[16, 76], [18, 77], [20, 78], [22, 78]],
    ], 10),
    innerDetails: [
      // Smiling closed eye arches with lashes
      makeArc(36, 52, 6.0, 1.15 * Math.PI, 1.85 * Math.PI, 16),
      makeArc(64, 52, 6.0, 1.15 * Math.PI, 1.85 * Math.PI, 16),
      [[30, 48], [27, 45]],
      [[70, 48], [73, 45]],
      // Rosy blush cheeks
      makeCircle(27, 59, 3.8, 16),
      makeCircle(73, 59, 3.8, 16),
      // Open joyful smile
      makeArc(50, 60, 4.5, 0.15 * Math.PI, 0.85 * Math.PI, 14),
    ],
  },

  // 17. DINOSSAURO BABY (NOVO)
  {
    id: 'dino_baby',
    name: 'Dinossauro Baby',
    category: 'animals',
    categoryLabel: 'Animais & Pets',
    description: 'Dino fofinho estilo cartoon com pescoço longo, barriguinha redonda, cristas dorsais e carinha feliz.',
    iconName: 'Smile',
    outerPerimeter: makeBezierContour([
      // Head top & snout
      [[28, 12], [36, 12], [42, 18], [42, 26]],
      // Snout to neck
      [[42, 26], [38, 32], [36, 36], [36, 46]],
      // Chest to front foot
      [[36, 46], [38, 62], [36, 78], [34, 88]],
      // Front foot base
      [[34, 88], [38, 92], [46, 92], [46, 85]],
      // Belly between legs
      [[46, 85], [48, 80], [54, 80], [56, 85]],
      // Back foot
      [[56, 85], [56, 92], [66, 92], [68, 84]],
      // Rump to tail tip
      [[68, 84], [78, 80], [92, 70], [94, 60]],
      // Tail inner to back
      [[94, 60], [86, 60], [74, 52], [66, 44]],
      // Back to neck
      [[66, 44], [58, 38], [48, 34], [44, 24]],
      // Back of head
      [[44, 24], [40, 16], [34, 12], [28, 12]],
    ], 10),
    innerDetails: [
      // Friendly cartoon eye
      makeCircle(34, 20, 3.2, 16),
      makeCircle(35, 19, 1.2, 8),
      // Smile
      makeArc(36, 26, 3.5, 0.2 * Math.PI, 0.8 * Math.PI, 12),
      // Belly contour line
      makeArc(52, 60, 18, 0.4 * Math.PI, 0.95 * Math.PI, 16),
      // Dorsal soft ridges (placas nas costas)
      makeArc(56, 37, 3.5, 1.1 * Math.PI, 1.9 * Math.PI, 10),
      makeArc(65, 43, 3.5, 1.1 * Math.PI, 1.9 * Math.PI, 10),
      makeArc(75, 52, 3.5, 1.1 * Math.PI, 1.9 * Math.PI, 10),
      // Cute spots on back
      makeCircle(56, 52, 2.5, 12),
      makeCircle(64, 60, 2.0, 12),
    ],
  },

  // 18. UNICÓRNIO MÁGICO (NOVO)
  {
    id: 'unicorn_head',
    name: 'Unicórnio Mágico',
    category: 'confectionery',
    categoryLabel: 'Confeitaria',
    description: 'Perfil de unicórnio encantado com chifre espiralado, crina ondulada e olho com cílios meigos.',
    iconName: 'Sparkles',
    outerPerimeter: makeBezierContour([
      // Horn tip to base
      [[62, 5], [58, 16], [54, 24], [50, 28]],
      // Forehead to snout
      [[50, 28], [42, 34], [34, 46], [22, 54]],
      // Muzzle round
      [[22, 54], [16, 60], [18, 70], [28, 72]],
      // Jaw to throat
      [[28, 72], [36, 70], [42, 62], [46, 62]],
      // Neck front to chest
      [[46, 62], [52, 74], [58, 86], [66, 92]],
      // Chest base to mane back
      [[66, 92], [76, 92], [84, 82], [82, 70]],
      // Mane locks 1
      [[82, 70], [86, 62], [80, 52], [78, 44]],
      // Mane locks 2 & ear
      [[78, 44], [82, 32], [76, 24], [70, 24]],
      // Ear front to horn base
      [[70, 24], [64, 24], [60, 26], [62, 5]],
    ], 10),
    innerDetails: [
      // Horn spiral grooves
      [[52, 23], [57, 18]],
      [[54, 18], [59, 13]],
      [[57, 12], [61, 8]],
      // Ear inner triangle
      [[66, 25], [74, 25], [70, 36], [66, 25]],
      // Closed peaceful eye with long eyelashes
      makeArc(38, 48, 5.0, 1.15 * Math.PI, 1.85 * Math.PI, 16),
      [[34, 45], [31, 41]],
      [[38, 43], [37, 39]],
      [[42, 44], [44, 40]],
      // Nostril & smile
      makeCircle(25, 62, 1.5, 10),
      makeArc(28, 66, 2.5, 0.2 * Math.PI, 0.8 * Math.PI, 10),
      // Flowing mane lines
      [[58, 38], [68, 44], [74, 56]],
      [[62, 52], [70, 62], [78, 74]],
    ],
  },

  // 19. BORBOLETA MONARCA (NOVO)
  {
    id: 'butterfly',
    name: 'Borboleta Monarca',
    category: 'botanical',
    categoryLabel: 'Botânica',
    description: 'Borboleta simétrica com asas duplas elegantes, corpo central anatômico e filigranas de asas.',
    iconName: 'Sun',
    outerPerimeter: makeBezierContour([
      // Head & Right antenna
      [[50, 16], [54, 10], [60, 7], [63, 10]],
      // Right upper wing top
      [[63, 10], [74, 12], [88, 20], [94, 34]],
      // Right upper wing lobe
      [[94, 34], [94, 46], [82, 54], [76, 56]],
      // Right lower wing
      [[76, 56], [86, 68], [80, 84], [68, 88]],
      // Right lower wing to tail
      [[68, 88], [58, 86], [52, 82], [50, 88]],
      // Tail to left lower wing
      [[50, 88], [48, 82], [42, 86], [32, 88]],
      // Left lower wing
      [[32, 88], [20, 84], [14, 68], [24, 56]],
      // Left upper wing lobe
      [[24, 56], [18, 54], [6, 46], [6, 34]],
      // Left upper wing top
      [[6, 34], [12, 20], [26, 12], [37, 10]],
      // Left antenna to head
      [[37, 10], [40, 7], [46, 10], [50, 16]],
    ], 10),
    innerDetails: [
      // Central body (tórax e abdômen)
      makeEllipse(50, 50, 3.2, 22, 24),
      // Head circle
      makeCircle(50, 24, 3.2, 14),
      // Right wing cell arcs
      makeArc(68, 36, 15, 0.8 * Math.PI, 1.8 * Math.PI, 16),
      [[54, 38], [76, 34]],
      [[54, 46], [82, 48]],
      [[54, 60], [74, 72]],
      // Left wing cell arcs
      makeArc(32, 36, 15, -0.8 * Math.PI, 0.2 * Math.PI, 16),
      [[46, 38], [24, 34]],
      [[46, 46], [18, 48]],
      [[46, 60], [26, 72]],
      // Wing spot accents
      makeCircle(84, 32, 2.5, 12),
      makeCircle(16, 32, 2.5, 12),
    ],
  },

  // 20. XÍCARA DE CAFÉ / CHÁ (NOVO)
  {
    id: 'coffee_cup',
    name: 'Xícara de Café Quentinho',
    category: 'confectionery',
    categoryLabel: 'Confeitaria',
    description: 'Xícara de café ou chá aconchegante com alça arredondada, pires e vapor em formato de coração.',
    iconName: 'Cake',
    outerPerimeter: makeBezierContour([
      // Steam heart top
      [[50, 6], [58, 4], [64, 12], [58, 20]],
      [[58, 20], [50, 26], [42, 20], [36, 12]],
      [[36, 12], [42, 4], [50, 6], [50, 6]],
      // Top rim of mug right
      [[50, 28], [66, 28], [72, 30], [72, 36]],
      // Handle outer loop
      [[72, 36], [88, 38], [92, 54], [84, 68]],
      // Handle inner return to mug body
      [[84, 68], [74, 70], [70, 64], [70, 64]],
      // Mug body right to saucer
      [[70, 64], [68, 76], [74, 82], [82, 85]],
      // Saucer bottom
      [[82, 85], [78, 92], [22, 92], [18, 85]],
      // Saucer left to mug body
      [[18, 85], [26, 82], [32, 76], [30, 64]],
      // Mug body left to rim
      [[30, 64], [28, 50], [28, 36], [28, 30]],
      // Top rim left to center
      [[28, 30], [34, 28], [50, 28], [50, 28]],
    ], 10),
    innerDetails: [
      // Saucer rim line
      [[20, 87], [80, 87]],
      // Mug upper rim oval
      makeEllipse(50, 34, 20, 4.5, 24),
      // Handle hollow inside
      makeEllipse(77, 52, 4.5, 7.5, 18),
      // Embossed Heart badge on center of mug
      makeSmoothHeart(50, 56, 9.0, 24),
      // Steam swirls
      [[46, 16], [50, 12], [54, 16]],
    ],
  },
];
