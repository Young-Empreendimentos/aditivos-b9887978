import type { NovaParcela } from '@/types/contract';
import { addMonths } from 'date-fns';

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
    });
  }
  return parcelas;
}
