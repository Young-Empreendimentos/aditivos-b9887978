import * as XLSX from 'xlsx';
import type { Parcela } from '@/types/contract';

function excelDateToJS(serial: number): Date {
  const utc_days = Math.floor(serial - 25569);
  return new Date(utc_days * 86400 * 1000);
}

function parseDate(value: any): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return excelDateToJS(value);
  if (typeof value === 'string') {
    // Try dd/mm/yyyy
    const parts = value.split('/');
    if (parts.length === 3) {
      const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function parseReportFile(file: File): Promise<Parcela[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find header row by looking for "Data vencto" or similar
  let headerIdx = -1;
  let colMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;
    const cells = row.map((c: any) => String(c).toLowerCase().trim());

    const dataIdx = cells.findIndex((c: string) => c.includes('data vencto') || c.includes('data venc') || c.includes('data vcto') || c.includes('vencimento'));
    const parIdx = cells.findIndex((c: string) => c === 'par' || c.includes('parcela'));
    const tipoIdx = cells.findIndex((c: string) => c.includes('tipo cond') || c.includes('condição') || c.includes('condicao'));
    const vlrOrigIdx = cells.findIndex((c: string) => c.includes('valor original') || c.includes('vlr original') || c.includes('vl. original'));
    const saldoIdx = cells.findIndex((c: string) => c.includes('valor devido') || c.includes('saldo atual') || c.includes('saldo'));

    if (dataIdx >= 0 && saldoIdx >= 0) {
      headerIdx = i;
      colMap = {
        dataVencimento: dataIdx,
        par: parIdx >= 0 ? parIdx : -1,
        tipoCondicao: tipoIdx >= 0 ? tipoIdx : -1,
        valorOriginal: vlrOrigIdx >= 0 ? vlrOrigIdx : -1,
        saldoAtual: saldoIdx,
      };
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error('Não foi possível encontrar o cabeçalho do relatório. Verifique se as colunas "Data vencto" e "Saldo atual" existem.');
  }

  const parcelas: Parcela[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c: any) => c === '' || c === null || c === undefined)) continue;

    const dateVal = parseDate(row[colMap.dataVencimento]);
    if (!dateVal) continue;

    const saldo = parseNumber(row[colMap.saldoAtual]);
    const valorOrig = colMap.valorOriginal >= 0 ? parseNumber(row[colMap.valorOriginal]) : 0;

    parcelas.push({
      rowIndex: i,
      numero: 0, // will be assigned after sorting
      dataVencimento: dateVal,
      parcelaOriginal: colMap.par >= 0 ? String(row[colMap.par]) : '',
      tipoCondicao: colMap.tipoCondicao >= 0 ? String(row[colMap.tipoCondicao]) : '',
      valorOriginal: valorOrig,
      saldoAtual: saldo,
      isEntrada: false,
    });
  }

  // Sort by date
  parcelas.sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime());

  // Mark first as entrada, renumber rest starting from 1
  if (parcelas.length > 0) {
    parcelas[0].isEntrada = true;
    parcelas[0].numero = 0;
    let num = 1;
    for (let i = 1; i < parcelas.length; i++) {
      parcelas[i].numero = num++;
    }
  }

  return parcelas;
}
