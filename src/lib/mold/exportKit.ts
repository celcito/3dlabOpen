import { zipSync } from 'fflate';
import type { BufferGeometry } from 'three';
import { exportToBinarySTL } from '../pencilTopper/stlExporter';
import { exportThermoform3MF, type Thermoform3MFItem } from '../thermoform/threeMfExporter';
import { MOLD_PART_LABELS, type MoldBuildResult, type MoldConfig } from '../../types/mold';
import { normalizeForPrint } from './generator';

const TYPE_LABEL: Record<MoldConfig['type'], string> = {
  single_open: 'Cavidade aberta',
  two_part: 'Bipartido',
  silicone_box: 'Caixa para silicone',
};

const FILE_BY_PART: Record<keyof typeof MOLD_PART_LABELS, string> = {
  single: 'molde',
  partA: 'molde_parte_A_base',
  partB: 'molde_parte_B_tampa',
};

function buildGuide(modelName: string, config: MoldConfig, build: MoldBuildResult): string {
  const partLines = build.parts
    .map((part) => ` - ${MOLD_PART_LABELS[part.id]}: ${FILE_BY_PART[part.id]}.stl`)
    .join('\n');

  return `GUIA DE IMPRESSÃO E USO DO MOLDE
Modelo: ${modelName}
Tipo: ${TYPE_LABEL[config.type]}
Caixa do molde: ${build.bounds.width} x ${build.bounds.height} x ${build.bounds.depth} mm
Triângulos: ${build.triangles}

ARQUIVOS
${partLines}

FATIAMENTO
 - Material: PETG (recomendado) ou PLA.
 - Altura de camada: 0.16 mm a 0.20 mm.
 - Paredes: 4 a 5 perímetros para o molde ficar estanque.
 - Camadas sólidas: 5 no topo e no fundo.
 - Preenchimento: 20% a 30% (giroide ou grade).
 - Suportes: desligados; as peças apoiam direto na mesa.

USO
 - Silicone RTV: aplique desmoldante na cavidade e vaze em fio fino pelo ponto mais fundo.
 - Chocolate, gesso, resina e sabonete: use filme / desmoldante se a peça for de PLA.
 - Molde bipartido: feche as metades com elástico ou sargento e injete pelo canal de despejo.

Gerado no 3D Lab Open — Criador de Moldes
`;
}

/** 3MF Bambu-compatível com um objeto por peça, cor e `extruder` por slot. */
export function exportMold3MF(
  modelName: string,
  config: MoldConfig,
  build: MoldBuildResult
): { blob: Blob; filename: string } {
  const colorByPart: Record<string, string> = {
    single: config.moldColor,
    partA: config.moldColor,
    partB: config.topColor,
  };

  const items: Thermoform3MFItem[] = build.parts
    .filter((part) => part.geoms.length > 0)
    .map((part) => ({
      geoms: part.geoms.map(normalizeForPrint),
      name: MOLD_PART_LABELS[part.id],
      color: colorByPart[part.id] ?? config.moldColor,
    }));

  const safeName = modelName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'modelo';

  return {
    blob: exportThermoform3MF(items, `Molde ${safeName}`),
    filename: `Molde_${safeName}.3mf`,
  };
}

/** Zip com um STL binário por peça + guia de impressão. */
export function exportMoldPackage(
  modelName: string,
  config: MoldConfig,
  build: MoldBuildResult
): { blob: Blob; filename: string } {
  const files: Record<string, Uint8Array> = {};

  for (const part of build.parts) {
    const geoms: BufferGeometry[] = part.geoms.map(normalizeForPrint);
    if (!geoms.length) continue;
    files[`${FILE_BY_PART[part.id]}.stl`] = new Uint8Array(exportToBinarySTL(geoms));
  }

  files['LEIA-ME_molde.txt'] = new TextEncoder().encode(buildGuide(modelName, config, build));

  const safeName = modelName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'modelo';
  const zipped = zipSync(files, { level: 6 });

  return {
    blob: new Blob([zipped], { type: 'application/zip' }),
    filename: `Molde_${safeName}.zip`,
  };
}
