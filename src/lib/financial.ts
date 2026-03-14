import type { NovaParcela, Reforco } from '@/types/contract';
import { addMonths, differenceInMonths } from 'date-fns';

/**
 * PMT = PV × [i(1+i)^n] / [(1+i)^n - 1]
 */
export function calculatePMT(pv: number, monthlyRate: number, n: number): number {
  if (n <= 0 || pv <= 0) return 0;
  if (monthlyRate === 0) return pv / n;

  const i = monthlyRate / 100;
  const factor = Math.pow(1 + i, n);
  return pv * (i * factor) / (factor - 1);
}

/**
 * Calcula o valor presente de um reforço.
 * PV_reforço = valor / (1+i)^t, onde t = meses (fracionário) entre startDate e data do reforço
 */
export function calcularPVReforco(reforco: Reforco, startDate: Date, monthlyRate: number): number {
  const diffMs = reforco.data.getTime() - startDate.getTime();
  const t = Math.max(0, diffMs / (30.4375 * 86400000)); // meses fracionários
  if (monthlyRate === 0 || t === 0) return reforco.valor;
  const i = monthlyRate / 100;
  return reforco.valor / Math.pow(1 + i, t);
}

export function calcularTotalPVReforcos(reforcos: Reforco[], startDate: Date, monthlyRate: number): number {
  return reforcos.reduce((sum, r) => sum + calcularPVReforco(r, startDate, monthlyRate), 0);
}

export function generateNovasParcelas(
  pmt: number,
  n: number,
  startDate: Date
): NovaParcela[] {
  const parcelas: NovaParcela[] = [];
  for (let k = 0; k < n; k++) {
    parcelas.push({
      numero: k + 1,
      dataVencimento: addMonths(startDate, k),
      valor: Math.round(pmt * 100) / 100,
      tipo: 'nova',
    });
  }
  return parcelas;
}
