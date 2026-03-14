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

function buildQuadro1Text(parcelas: Parcela[]): string {
  const header = 'Nº Parcela | Data Vencimento | Valor Original';
  const separator = '-'.repeat(50);
  const rows = parcelas.map(
    (p) => `${String(p.numero).padStart(2, '0')} | ${formatDate(p.dataVencimento)} | ${formatCurrency(p.valorOriginal)}`
  );
  return [header, separator, ...rows].join('\n');
}

function buildQuadro2Text(parcelas: NovaParcela[]): string {
  const header = 'Nº Parcela | Data Vencimento | Valor | Tipo';
  const separator = '-'.repeat(60);
  const rows = parcelas.map(
    (p) => `${String(p.numero).padStart(2, '0')} | ${formatDate(p.dataVencimento)} | ${formatCurrency(p.valor)} | ${p.tipo === 'reforco' ? 'Reforço' : p.tipo === 'mantida' ? 'Mantida' : 'Nova'}`
  );
  return [header, separator, ...rows].join('\n');
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
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  });

  doc.render({
    QUADRO_1: buildQuadro1Text(selectedParcelas),
    QUADRO_2: buildQuadro2Text(novasParcelas),
    JUROS_ADOTADOS: `${taxaJuros.toFixed(2).replace('.', ',')}% a.m.`,
    CUSTOS_ADICIONAIS: formatCurrency(custosAdicionais),
    VALOR_TOTAL_RENEGOCIADO: formatCurrency(valorTotalRenegociado),
  });

  const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
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
