import jsPDF from 'jspdf';
import { ModelLineart, ModelSettings, PrintEstimation } from '../types';

/**
 * Generates an A4 3D Printing Production & Specification Sheet PDF
 */
export function generateProductionReportPDF(
  model: ModelLineart,
  settings: ModelSettings,
  estimation: PrintEstimation
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  // Header Background Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'F');

  // Accent Color Bar
  doc.setFillColor(245, 158, 11); // amber-500
  doc.rect(margin, y + 23, contentWidth, 1.5, 'F');

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('COOKIE3D STUDIO - FICHA TÉCNICA DE PRODUÇÃO 3D', margin + 6, y + 9);

  // Header Subtitle & Job Metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text('Registro de Fatiamento, Consumo de Material e Parâmetros para Cortador & Carimbo', margin + 6, y + 16);
  doc.text(`Emissão: ${dateStr}`, margin + contentWidth - 46, y + 16);

  y += 32;

  // 1. DADOS DO MODELO E PROJETO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. IDENTIFICAÇÃO DO PRODUTO', margin, y);
  y += 3;

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Nome do Modelo:', margin + 4, y + 6);
  doc.text('Categoria:', margin + 4, y + 12);
  doc.text('Frase / Texto Gravado:', margin + 4, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(model.name, margin + 40, y + 6);
  doc.text(model.categoryLabel || 'Confeitaria', margin + 40, y + 12);
  doc.text(
    settings.customText && settings.customText.trim()
      ? `"${settings.customText}" (Fonte: ${settings.textFont || 'Padrão'})`
      : 'Nenhum (Apenas Ilustração)',
    margin + 40,
    y + 18
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Dimensões Alvo:', margin + 115, y + 6);
  doc.text('Malha 3D:', margin + 115, y + 12);
  doc.text('Status:', margin + 115, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${settings.targetWidth} × ${settings.targetHeight} mm`, margin + 145, y + 6);
  doc.text(`${estimation.trianglesCount.toLocaleString('pt-BR')} faces (Sólido)`, margin + 145, y + 12);
  doc.text('Aprovado para Fatiamento', margin + 145, y + 18);

  y += 26;

  // 2. CONSUMO DE FILAMENTO E TEMPO ESTIMADO (KPI CARDS)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. ESTIMATIVA DE CONSUMO E TEMPO DE PRODUÇÃO (FDM)', margin, y);
  y += 3;

  const cardW = (contentWidth - 6) / 3;
  const cardH = 22;

  // KPI 1: Peso Total
  doc.setFillColor(254, 243, 199); // amber-100
  doc.setDrawColor(251, 191, 36); // amber-400
  doc.roundedRect(margin, y, cardW, cardH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('PESO TOTAL ESTIMADO', margin + 4, y + 5);

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`~${estimation.totalWeightGrams} gramas`, margin + 4, y + 13);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Cortador: ${estimation.cutterWeightGrams}g | Carimbo: ${estimation.stampWeightGrams}g`, margin + 4, y + 18.5);

  // KPI 2: Metros de Filamento
  const kpi2X = margin + cardW + 3;
  doc.setFillColor(240, 249, 255); // sky-50
  doc.setDrawColor(186, 230, 253); // sky-200
  doc.roundedRect(kpi2X, y, cardW, cardH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(3, 105, 161); // sky-700
  doc.text('FILAMENTO NECESSÁRIO (1.75mm)', kpi2X + 4, y + 5);

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`${estimation.filamentMeters} metros`, kpi2X + 4, y + 13);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Preenchimento (Infill): ${settings.infillPercent}%`, kpi2X + 4, y + 18.5);

  // KPI 3: Tempo Estimado
  const kpi3X = kpi2X + cardW + 3;
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(187, 247, 208); // emerald-200
  doc.roundedRect(kpi3X, y, cardW, cardH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61); // emerald-700
  doc.text('TEMPO ESTIMADO DE MÁQUINA', kpi3X + 4, y + 5);

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  const hours = Math.floor(estimation.printTimeMinutes / 60);
  const mins = estimation.printTimeMinutes % 60;
  const timeFormatted = hours > 0 ? `${hours}h ${mins}min` : `${mins} minutos`;
  doc.text(`~${timeFormatted}`, kpi3X + 4, y + 13);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Velocidade base: 50 mm/s (0.20mm)', kpi3X + 4, y + 18.5);

  y += 28;

  // 3. PARÂMETROS DETALHADOS DE GEOMETRIA (TABELA DUPLA)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. ESPECIFICAÇÕES TÉCNICAS DO CONJUNTO', margin, y);
  y += 3;

  const colW = (contentWidth - 4) / 2;
  const tableH = 50;

  // Coluna Esquerda: CORTADOR
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, colW, tableH, 2, 2, 'FD');

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, colW, 7, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('PEÇA 1: CORTADOR (LÂMINA EXTERNA)', margin + 4, y + 5);

  const cutterRows = [
    ['Altura Total da Lâmina:', `${settings.bladeHeight} mm`],
    ['Espessura do Fio de Corte:', `${settings.bladeEdgeThickness} mm (Bevel Afiado)`],
    ['Espessura da Base da Lâmina:', `${settings.bladeBaseThickness} mm`],
    ['Largura da Aba de Apoio (Flange):', `${settings.lipWidth} mm (Conforto)`],
    ['Espessura da Aba de Apoio:', `${settings.lipThickness} mm`],
    ['Largura × Comprimento:', `${settings.targetWidth} × ${settings.targetHeight} mm`],
  ];

  let rowY = y + 12;
  cutterRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin + 4, rowY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(val, margin + colW - 4, rowY, { align: 'right' });
    rowY += 6.2;
  });

  // Coluna Direita: CARIMBO
  const col2X = margin + colW + 4;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(col2X, y, colW, tableH, 2, 2, 'FD');

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(col2X, y, colW, 7, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('PEÇA 2: CARIMBO (DEBOSSER / EMBOSSER)', col2X + 4, y + 5);

  const stampRows = [
    ['Profundidade do Relevo (Linhas):', `${settings.stampDepth} mm`],
    ['Espessura dos Traços de Detalhe:', `${settings.stampLineThickness} mm`],
    ['Espessura da Placa Base:', `${settings.stampPlateThickness} mm`],
    ['Folga de Encaixe (Clearance):', `${settings.stampClearance} mm (Suave)`],
    [
      'Tipo de Puxador Traseiro:',
      settings.handleType === 'knob' ? 'Botão Anatômico' : settings.handleType === 'bar' ? 'Barra Estriada' : 'Plano',
    ],
    ['Furos de Alívio de Ar:', settings.airReleaseHoles ? `Sim (${settings.airHoleDiameter} mm)` : 'Desativado'],
  ];

  rowY = y + 12;
  stampRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, col2X + 4, rowY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(val, col2X + colW - 4, rowY, { align: 'right' });
    rowY += 6.2;
  });

  y += tableH + 6;

  // 4. PARÂMETROS RECOMENDADOS PARA FATIAMENTO NO SLICER
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('4. CONFIGURAÇÕES RECOMENDADAS NO SLICER (CURA / BAMBU / ORCA / PRUSA)', margin, y);
  y += 3;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 30, 2, 2, 'FD');

  const slicerTips = [
    ['Altura de Camada (Layer Height):', '0.20 mm (ou 0.16 mm para carimbos de alta definição com frases finas).'],
    ['Paredes / Perímetros (Walls):', '4 a 5 perímetros sólidos (essencial para vedação e rigidez sem vazamento de massa).'],
    ['Camadas Superiores e Inferiores:', '5 camadas superiores e 4 inferiores (para base 100% lisa e plana).'],
    ['Preenchimento (Infill):', `${settings.infillPercent}% padrão (Padrão Giroide ou Grade para máxima rigidez mecânica).`],
    ['Material Recomendado:', 'PLA Food-Safe (certificado para alimentos) ou PETG virgem.'],
  ];

  rowY = y + 5;
  slicerTips.forEach(([param, desc]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`• ${param}`, margin + 4, rowY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(desc, margin + 64, rowY);
    rowY += 5.2;
  });

  y += 36;

  // 5. NORMAS DE SEGURANÇA ALIMENTAR E HIGIENIZAÇÃO
  doc.setFillColor(254, 242, 242); // red-50
  doc.setDrawColor(254, 202, 202); // red-200
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(153, 27, 27); // red-800
  doc.text('IMPORTANTE: CUIDADOS E SEGURANÇA ALIMENTAR (FOOD SAFETY)', margin + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(185, 28, 28); // red-700
  doc.text(
    '1. Lavar exclusivamente com água morna e sabão neutro (temperatura máxima 45°C). Não utilizar máquina de lavar louça para evitar empenamento térmico do PLA.',
    margin + 4,
    y + 9.5
  );
  doc.text(
    '2. Para contato prolongado com alimentos, recomenda-se aplicar spray selante impermeabilizante atóxico ou passar filme plástico fino sobre a massa antes de cortar.',
    margin + 4,
    y + 14
  );

  y += 24;

  // 6. CHECKLIST DE CONTROLE DE QUALIDADE E APROVAÇÃO
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('5. CONTROLE DE QUALIDADE E REGISTRO DE PRODUÇÃO', margin, y);
  y += 3;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('[  ] Lâmina externa sem rebarbas ou saliências afiadas', margin + 4, y + 6);
  doc.text('[  ] Teste de encaixe carimbo/cortador com deslizamento livre', margin + 4, y + 12);
  doc.text('[  ] Furos de ar limpos e desobstruídos', margin + 4, y + 18);
  doc.text('[  ] Higienização e pesagem real final conferida', margin + 4, y + 23);

  doc.line(margin + 105, y + 2, margin + 105, y + 24);

  doc.setFont('helvetica', 'bold');
  doc.text('Operador / Responsável:', margin + 110, y + 7);
  doc.text('Data de Impressão: _____/_____/2026', margin + 110, y + 13);
  doc.text('Lote / Cliente: _______________________', margin + 110, y + 19);

  // Bottom Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    'Cookie3D Studio · Software Especialista em Cortadores e Carimbos 3D · Documento gerado automaticamente para gestão de produção.',
    pageWidth / 2,
    290,
    { align: 'center' }
  );

  return doc;
}

/**
 * Direct download of the Production Sheet PDF file
 */
export function downloadProductionReportPDF(
  model: ModelLineart,
  settings: ModelSettings,
  estimation: PrintEstimation
) {
  const doc = generateProductionReportPDF(model, settings, estimation);
  const sanitizedName = model.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Ficha_Producao_${sanitizedName}_${settings.targetWidth}mm.pdf`);
}

/**
 * Returns raw Blob of the Production Sheet PDF file (useful for ZIP package bundle)
 */
export function getProductionReportPDFBlob(
  model: ModelLineart,
  settings: ModelSettings,
  estimation: PrintEstimation
): Blob {
  const doc = generateProductionReportPDF(model, settings, estimation);
  return doc.output('blob');
}
