import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Parcela, NovaParcela } from '@/types/contract';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
}

function ooCell(text: string, bold = false, align: 'left' | 'center' | 'right' = 'left'): string {
  const jc = align === 'right' ? 'end' : align === 'center' ? 'center' : 'start';
  const rPr = bold ? '<w:rPr><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>' : '<w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>';
  return `<w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:jc w:val="${jc}"/></w:pPr><w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;
}

function ooRow(cells: string[], isHeader = false): string {
  return `<w:tr>${isHeader ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.join('')}</w:tr>`;
}

function buildQuadro1Xml(parcelas: Parcela[]): string {
  const headerRow = ooRow([
    ooCell('Nº Parcela', true, 'center'),
    ooCell('Data Vencimento', true, 'center'),
    ooCell('Valor Original', true, 'center'),
  ], true);

  const dataRows = parcelas.map(p => ooRow([
    ooCell(String(p.numero).padStart(2, '0'), false, 'center'),
    ooCell(formatDate(p.dataVencimento), false, 'center'),
    ooCell(formatCurrency(p.valorOriginal), false, 'right'),
  ]));

  const total = parcelas.reduce((s, p) => s + p.valorOriginal, 0);
  const totalRow = ooRow([ooCell('Total', true, 'center'), ooCell('', false, 'center'), ooCell(formatCurrency(total), true, 'right')]);
  const tblBorders = '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="999999"/></w:tblBorders>';
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/>${tblBorders}</w:tblPr>${headerRow}${dataRows.join('')}${totalRow}</w:tbl>`;
}

function buildQuadro2Xml(parcelas: NovaParcela[]): string {
  const headerRow = ooRow([
    ooCell('Nº Parcela', true, 'center'),
    ooCell('Data Vencimento', true, 'center'),
    ooCell('Valor', true, 'center'),
  ], true);
  const dataRows = parcelas.map(p => ooRow([
    ooCell(String(p.numero).padStart(2, '0'), false, 'center'),
    ooCell(formatDate(p.dataVencimento), false, 'center'),
    ooCell(formatCurrency(p.valor), false, 'right'),
  ]));
  const total = parcelas.reduce((s, p) => s + p.valor, 0);
  const totalRow = ooRow([ooCell('Total', true, 'center'), ooCell('', false, 'center'), ooCell(formatCurrency(total), true, 'right')]);
  const tblBorders = '<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="999999"/></w:tblBorders>';
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/>${tblBorders}</w:tblPr>${headerRow}${dataRows.join('')}${totalRow}</w:tbl>`;
}

export async function generateDocx(
  templateFile: File,
  selectedParcelas: Parcela[],
  novasParcelas: NovaParcela[],
  taxaJuros: number,
  custosAdicionais: number,
  valorTotalRenegociado: number
): Promise<Blob> {
  const arrayBuffer = await templateFile.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  // First pass: render simple text placeholders with docxtemplater
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });

  doc.render({
    QUADRO_1: '___QUADRO1_PLACEHOLDER___',
    QUADRO_2: '___QUADRO2_PLACEHOLDER___',
    JUROS_ADOTADOS: `${taxaJuros.toFixed(2).replace('.', ',')}% a.m.`,
    CUSTOS_ADICIONAIS: formatCurrency(custosAdicionais),
    VALOR_TOTAL_RENEGOCIADO: formatCurrency(valorTotalRenegociado),
  });

  // Second pass: replace placeholder paragraphs with actual OOXML tables
  const processedZip = doc.getZip();
  let docXml = processedZip.file('word/document.xml')!.asText();

  // Replace the paragraph containing the placeholder with the table XML
  const replacePlaceholder = (xml: string, placeholder: string, tableXml: string): string => {
    // Match the entire <w:p> element containing our placeholder text
    const escapedPh = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`<w:p[^>]*>(?:(?!<w:p[ >]).)*?${escapedPh}.*?</w:p>`, 's');
    return xml.replace(regex, tableXml);
  };

  docXml = replacePlaceholder(docXml, '___QUADRO1_PLACEHOLDER___', buildQuadro1Xml(selectedParcelas));
  docXml = replacePlaceholder(docXml, '___QUADRO2_PLACEHOLDER___', buildQuadro2Xml(novasParcelas));

  processedZip.file('word/document.xml', docXml);

  const out = processedZip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return out;
}

export function downloadDocx(blob: Blob, filename: string) {
  saveAs(blob, filename);
}

export async function generateAndDownloadPdf(
  selectedParcelas: Parcela[],
  novasParcelas: NovaParcela[],
  taxaJuros: number,
  custosAdicionais: number,
  valorTotalRenegociado: number,
  pvTotal: number,
  filename: string
) {
  // Dynamic import for html2pdf (it expects a DOM element)
  const html2pdf = (await import('html2pdf.js')).default;

  const container = document.createElement('div');
  container.style.padding = '40px';
  container.style.fontFamily = 'Inter, Arial, sans-serif';
  container.style.fontSize = '12px';
  container.style.color = '#1a1a2e';
  container.style.maxWidth = '800px';

  container.innerHTML = `
    <h1 style="font-size:18px;margin-bottom:20px;color:#1a1a2e;">Aditivo Contratual — Reparcelamento</h1>
    
    <h2 style="font-size:14px;margin-bottom:8px;">Resumo Financeiro</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:4px 8px;border:1px solid #ddd;">Taxa de Juros</td><td style="padding:4px 8px;border:1px solid #ddd;">${taxaJuros.toFixed(2).replace('.', ',')}% a.m.</td></tr>
      <tr><td style="padding:4px 8px;border:1px solid #ddd;">Custos Adicionais</td><td style="padding:4px 8px;border:1px solid #ddd;">${formatCurrency(custosAdicionais)}</td></tr>
      <tr><td style="padding:4px 8px;border:1px solid #ddd;">Valor Presente (PV)</td><td style="padding:4px 8px;border:1px solid #ddd;">${formatCurrency(pvTotal)}</td></tr>
      <tr><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">Valor Total Renegociado</td><td style="padding:4px 8px;border:1px solid #ddd;font-weight:bold;">${formatCurrency(valorTotalRenegociado)}</td></tr>
    </table>

    <h2 style="font-size:14px;margin-bottom:8px;">Quadro 1 — Parcelas Originais Selecionadas</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead><tr style="background:#f0f0f5;">
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Nº</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Data Vencimento</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Valor Original</th>
      </tr></thead>
      <tbody>${selectedParcelas.map(p => `<tr>
        <td style="padding:4px 8px;border:1px solid #ddd;">${String(p.numero).padStart(2, '0')}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;">${formatDate(p.dataVencimento)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right;">${formatCurrency(p.valorOriginal)}</td>
      </tr>`).join('')}</tbody>
    </table>

    <h2 style="font-size:14px;margin-bottom:8px;">Quadro 2 — Novo Plano de Parcelas</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="background:#f0f0f5;">
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Nº</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Data Vencimento</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Valor</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Tipo</th>
      </tr></thead>
      <tbody>${novasParcelas.map(p => `<tr>
        <td style="padding:4px 8px;border:1px solid #ddd;">${String(p.numero).padStart(2, '0')}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;">${formatDate(p.dataVencimento)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;text-align:right;">${formatCurrency(p.valor)}</td>
        <td style="padding:4px 8px;border:1px solid #ddd;">${p.tipo === 'reforco' ? 'Reforço' : p.tipo === 'mantida' ? 'Mantida' : 'Nova'}</td>
      </tr>`).join('')}</tbody>
    </table>
  `;

  await html2pdf().set({
    margin: 10,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  }).from(container).save();
}
