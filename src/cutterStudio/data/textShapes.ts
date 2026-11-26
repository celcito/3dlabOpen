import { ModelLineart, Path2D, Point2D } from '../types';

function makeCircle(cx: number, cy: number, r: number, steps: number = 36): Path2D {
  const pts: Point2D[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([
      Math.round((cx + Math.cos(a) * r) * 10) / 10,
      Math.round((cy + Math.sin(a) * r) * 10) / 10,
    ]);
  }
  return pts;
}

function makeHeart(cx: number, cy: number, scale: number, steps: number = 48): Path2D {
  const pts: Point2D[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([
      Math.round((cx + (x * scale) / 16) * 10) / 10,
      Math.round((cy + (y * scale) / 16) * 10) / 10,
    ]);
  }
  return pts;
}

function makeStar(cx: number, cy: number, rOuter: number, rInner: number, points: number = 5): Path2D {
  const pts: Point2D[] = [];
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const a = (i / total) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push([
      Math.round((cx + Math.cos(a) * r) * 10) / 10,
      Math.round((cy + Math.sin(a) * r) * 10) / 10,
    ]);
  }
  return pts;
}

function makePolygon(cx: number, cy: number, r: number, sides: number): Path2D {
  const pts: Point2D[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push([
      Math.round((cx + Math.cos(a) * r) * 10) / 10,
      Math.round((cy + Math.sin(a) * r) * 10) / 10,
    ]);
  }
  return pts;
}

export interface TextShapePreset {
  id: string;
  name: string;
  categoryLabel: string;
  description: string;
  iconSvg: string; // Compact path string for preview
  model: ModelLineart;
}

export const PREDEFINED_TEXT_SHAPES: TextShapePreset[] = [
  {
    id: 'scalloped_plaque',
    name: 'Festonado / Flor',
    categoryLabel: 'Moldura Ondulada',
    description: 'Borda com 12 pétalas onduladas clássicas de confeitaria com moldura circular interna.',
    iconSvg: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10',
    model: {
      id: 'scalloped_plaque',
      name: 'Placa Festonada / Flor',
      category: 'frames',
      categoryLabel: 'Molduras para Texto',
      description: 'Cortador e carimbo com borda ondulada festonada para textos e mensagens.',
      iconName: 'Sparkles',
      outerPerimeter: (() => {
        const pts: Point2D[] = [];
        const total = 48;
        for (let i = 0; i < total; i++) {
          const a = (i / total) * Math.PI * 2;
          const wave = (Math.cos(a * 12) + 1) / 2;
          const r = 38 + wave * 8;
          pts.push([
            Math.round((50 + Math.cos(a) * r) * 10) / 10,
            Math.round((50 + Math.sin(a) * r) * 10) / 10,
          ]);
        }
        return pts;
      })(),
      innerDetails: [
        makeCircle(50, 50, 32, 32),
      ],
    },
  },
  {
    id: 'circle_plaque',
    name: 'Círculo Clássico',
    categoryLabel: 'Círculo',
    description: 'Forma circular perfeita para carimbos de nomes, monogramas e idades.',
    iconSvg: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10',
    model: {
      id: 'circle_plaque',
      name: 'Placa Redonda Clássica',
      category: 'frames',
      categoryLabel: 'Molduras para Texto',
      description: 'Cortador circular com moldura concêntrica para texto personalizado.',
      iconName: 'Circle',
      outerPerimeter: makeCircle(50, 50, 44, 36),
      innerDetails: [
        makeCircle(50, 50, 38, 36),
      ],
    },
  },
  {
    id: 'heart_plaque',
    name: 'Coração Romântico',
    categoryLabel: 'Coração',
    description: 'Coração com curvas suaves, perfeito para casamentos, datas de namoro e carinho.',
    iconSvg: 'M 50 25 C 50 25 35 10 20 25 C 5 40 50 85 50 85 C 50 85 95 40 80 25 C 65 10 50 25 50 25',
    model: {
      id: 'heart_plaque',
      name: 'Placa Coração Romântico',
      category: 'frames',
      categoryLabel: 'Molduras para Texto',
      description: 'Cortador de coração com filete interno para frases carinhosas.',
      iconName: 'Heart',
      outerPerimeter: makeHeart(50, 48, 46, 48),
      innerDetails: [
        makeHeart(50, 48, 36, 40),
      ],
    },
  },
  {
    id: 'rounded_rect_plaque',
    name: 'Placa Retangular',
    categoryLabel: 'Retângulo Suave',
    description: 'Etiqueta com cantos arredondados, excelente para frases longas de 2 ou 3 linhas.',
    iconSvg: 'M 15 25 H 85 Q 92 25 92 32 V 68 Q 92 75 85 75 H 15 Q 8 75 8 68 V 32 Q 8 25 15 25',
    model: {
      id: 'rounded_rect_plaque',
      name: 'Placa Retangular Suave',
      category: 'frames',
      categoryLabel: 'Molduras para Texto',
      description: 'Cortador retangular com cantos suaves e moldura dupla para frases e nomes.',
      iconName: 'Square',
      outerPerimeter: [
        [18, 24], [82, 24], [90, 30], [92, 40], [92, 60], [90, 70],
        [82, 76], [18, 76], [10, 70], [8, 60], [8, 40], [10, 30],
      ],
      innerDetails: [
        [
          [20, 30], [80, 30], [86, 35], [86, 65], [80, 70],
          [20, 70], [14, 65], [14, 35], [20, 30],
        ],
      ],
    },
  },
  {
    id: 'oval_plaque',
    name: 'Oval Elegante',
    categoryLabel: 'Oval Confeiteiro',
    description: 'Oval proporcional clássico de doces finos com filete interno.',
    iconSvg: 'M 50 18 C 75 18 92 32 92 50 C 92 68 75 82 50 82 C 25 82 8 68 8 50 C 8 32 25 18 50 18',
    model: {
      id: 'oval_plaque',
      name: 'Placa Oval Elegante',
      category: 'frames',
      categoryLabel: 'Molduras para Texto',
      description: 'Cortador oval clássico para batizados, aniversários e doces finos.',
      iconName: 'Disc',
      outerPerimeter: (() => {
        const pts: Point2D[] = [];
        for (let i = 0; i < 36; i++) {
          const a = (i / 36) * Math.PI * 2;
          pts.push([
            Math.round((50 + Math.cos(a) * 44) * 10) / 10,
            Math.round((50 + Math.sin(a) * 33) * 10) / 10,
          ]);
        }
        return pts;
      })(),
      innerDetails: [
        (() => {
          const pts: Point2D[] = [];
          for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            pts.push([
              Math.round((50 + Math.cos(a) * 38) * 10) / 10,
              Math.round((50 + Math.sin(a) * 27) * 10) / 10,
            ]);
          }
          return pts;
        })(),
      ],
    },
  },
  {
    id: 'star_plaque',
    name: 'Estrela Festiva',
    categoryLabel: 'Estrela',
    description: 'Estrela de 5 pontas harmoniosa com área ampla central para texto.',
    iconSvg: 'M 50 10 L 62 38 L 92 38 L 68 56 L 77 84 L 50 66 L 23 84 L 32 56 L 8 38 L 38 38 Z',
    model: {
      id: 'star_plaque',
      name: 'Placa Estrela Festiva',
      category: 'frames',
      categoryLabel: 'Molduras para Texto',
      description: 'Cortador em formato de estrela para carimbar nomes e votos natalinos.',
      iconName: 'Star',
      outerPerimeter: makeStar(50, 50, 46, 23, 5),
      innerDetails: [
        makeStar(50, 50, 36, 18, 5),
      ],
    },
  },
  {
    id: 'cloud_plaque',
    name: 'Nuvem Delicada',
    categoryLabel: 'Nuvem',
    description: 'Nuvem fofinha e alegre, muito usada em chás de bebê e temas infantis.',
    iconSvg: 'M 25 70 H 75 C 88 70 92 50 82 40 C 82 25 60 20 50 25 C 40 15 18 25 18 40 C 8 50 12 70 25 70',
    model: {
      id: 'cloud_plaque',
      name: 'Placa Nuvem Delicada',
      category: 'frames',
      categoryLabel: 'Molduras para Texto',
      description: 'Cortador em formato de nuvem com amplo espaço central para nomes infantis.',
      iconName: 'Cloud',
      outerPerimeter: [
        [22, 76], [78, 76], [88, 72], [94, 60], [88, 48], [84, 40],
        [78, 32], [66, 30], [58, 22], [50, 18], [42, 22], [36, 30],
        [26, 32], [18, 40], [14, 48], [8, 60], [14, 72],
      ],
      innerDetails: [
        [[26, 70], [74, 70]],
      ],
    },
  },
  {
    id: 'hexagon_plaque',
    name: 'Hexágono Moderno',
    categoryLabel: 'Hexágono',
    description: 'Geometria contemporânea inspirada em favo de mel, limpa e sofisticada.',
    iconSvg: 'M 50 8 L 88 28 L 88 72 L 50 92 L 12 72 L 12 28 Z',
    model: {
      id: 'hexagon_plaque',
      name: 'Placa Hexágono Moderno',
      category: 'frames',
      categoryLabel: 'Molduras para Texto',
      description: 'Cortador hexagonal geométrico moderno para casamentos e cafés.',
      iconName: 'Hexagon',
      outerPerimeter: makePolygon(50, 50, 44, 6),
      innerDetails: [
        makePolygon(50, 50, 38, 6),
      ],
    },
  },
  {
    id: 'banner_plaque',
    name: 'Flâmula / Bandeirola',
    categoryLabel: 'Flâmula',
    description: 'Bandeira recortada estilo pennant com carimbo de borda decorativa.',
    iconSvg: 'M 15 22 H 85 V 72 L 50 58 L 15 72 Z',
    model: {
      id: 'banner_plaque',
      name: 'Placa Flâmula / Bandeirola',
      category: 'frames',
      categoryLabel: 'Molduras para Texto',
      description: 'Cortador tipo bandeirola de festa para nomes e mensagens de comemoração.',
      iconName: 'Bookmark',
      outerPerimeter: [
        [15, 22], [85, 22], [85, 78], [50, 62], [15, 78],
      ],
      innerDetails: [
        [
          [20, 28], [80, 28], [80, 71], [50, 57], [20, 71], [20, 28],
        ],
      ],
    },
  },
  {
    id: 'shield_plaque',
    name: 'Escudo Imperial',
    categoryLabel: 'Escudo',
    description: 'Escudo medieval de brasão, excelente para formaturas, brasões e super-heróis.',
    iconSvg: 'M 20 18 H 80 V 50 C 80 72 50 86 50 86 C 50 86 20 72 20 50 Z',
    model: {
      id: 'shield_plaque',
      name: 'Placa Escudo Imperial',
      category: 'frames',
      categoryLabel: 'Molduras para Texto',
      description: 'Cortador em formato de brasão / escudo para iniciais, brasões e nomes fortes.',
      iconName: 'Shield',
      outerPerimeter: [
        [20, 18], [80, 18], [84, 52], [68, 72], [50, 88], [32, 72], [16, 52],
      ],
      innerDetails: [
        [
          [25, 24], [75, 24], [78, 50], [64, 68], [50, 81], [36, 68], [22, 50], [25, 24],
        ],
      ],
    },
  },
];
