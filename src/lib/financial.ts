import type { NovaParcela, Reforco } from '@/types/contract';
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

/**
 * Calcula o valor presente de um reforço.
 * Converte taxa mensal para diária: i_diária = (1+i_mensal)^(1/30) - 1
 * PV = valor / (1 + i_diária)^dias
 */
export function calcularPVReforco(reforco: Reforco, startDate: Date, monthlyRate: number): number {
  const diffMs = reforco.data.getTime() - startDate.getTime();
  const dias = Math.max(0, Math.round(diffMs / 86400000));
  if (monthlyRate === 0 || dias === 0) return reforco.valor;
  const iMensal = monthlyRate / 100;
  const iDiaria = Math.pow(1 + iMensal, 1 / 30) - 1;
  return reforco.valor / Math.pow(1 + iDiaria, dias);
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
