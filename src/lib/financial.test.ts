import { describe, it, expect } from 'vitest';
import { calculatePMT, calcularPVReforco, calcularTotalPVReforcos } from './financial';
import type { Reforco } from '@/types/contract';

describe('calculatePMT', () => {
  it('sem juros, divide o PV igualmente', () => {
    expect(calculatePMT(12000, 0, 12)).toBeCloseTo(1000, 2);
  });

  it('com juros, parcela > PV/n (cobra juros)', () => {
    const pmt = calculatePMT(100000, 1, 12);
    expect(pmt).toBeGreaterThan(100000 / 12);
  });

  it('retorna 0 para entradas inválidas', () => {
    expect(calculatePMT(0, 1, 12)).toBe(0);
    expect(calculatePMT(100000, 1, 0)).toBe(0);
  });
});

/**
 * Valida a regra de negócio (pergunta do cliente):
 * quando um reforço é EXCLUÍDO, o valor dele volta para as parcelas normais.
 *
 * Mecânica no app (Step3):
 *   PV financiado = PV bruto − VP(reforços)
 *   parcela (PMT)  = calculatePMT(PV financiado, taxa, nº parcelas)
 *
 * Logo, ao remover um reforço o PV financiado sobe e a parcela sobe junto.
 */
describe('exclusão de reforço redistribui o valor nas parcelas', () => {
  const pvBruto = 100000;
  const taxa = 1; // % a.m.
  const n = 12;
  const baseDate = new Date(2026, 0, 1); // data da renegociação
  const reforco: Reforco = { id: 'r1', data: new Date(2026, 6, 1), valor: 10000 }; // ~6 meses depois

  it('com reforço a parcela é menor; sem reforço (excluído) a parcela é maior', () => {
    const vpReforco = calcularPVReforco(reforco, baseDate, taxa);
    expect(vpReforco).toBeGreaterThan(0);
    expect(vpReforco).toBeLessThan(reforco.valor); // descontado a valor presente

    // COM reforço: parte da dívida sai como pagamento avulso
    const pvComReforco = pvBruto - vpReforco;
    const pmtComReforco = calculatePMT(pvComReforco, taxa, n);

    // SEM reforço (usuário excluiu): nada é descontado
    const pmtSemReforco = calculatePMT(pvBruto, taxa, n);

    // A parcela SEM o reforço tem que ser MAIOR — o valor voltou para as parcelas
    expect(pmtSemReforco).toBeGreaterThan(pmtComReforco);
  });

  it('excluir o reforço volta exatamente à parcela do plano sem reforço (idempotente)', () => {
    const pmtBaseline = calculatePMT(pvBruto, taxa, n);

    // simula adicionar e depois remover o reforço
    let reforcos: Reforco[] = [];
    reforcos = [...reforcos, reforco];           // adiciona
    const pvComReforco = pvBruto - calcularTotalPVReforcos(reforcos, baseDate, taxa);
    expect(calculatePMT(pvComReforco, taxa, n)).toBeLessThan(pmtBaseline);

    reforcos = reforcos.filter(r => r.id !== 'r1'); // exclui
    const pvAposExcluir = pvBruto - calcularTotalPVReforcos(reforcos, baseDate, taxa);
    expect(calculatePMT(pvAposExcluir, taxa, n)).toBeCloseTo(pmtBaseline, 6);
  });
});
