import { describe, it, expect } from 'vitest';
import { calculatePMT, calcularPVReforco, calcularTotalPVReforcos, diluirValorAdiado, calcularParcelaPorData } from './financial';
import type { Reforco } from '@/types/contract';

describe('calcularParcelaPorData (modelo oficial G20 — parcela depende da data de início)', () => {
  const base = new Date(2026, 10, 9); // 09/11/2026
  const fin = 3464.92;

  it('parcelas iguais, mas quanto mais longe a 1ª, maior o valor', () => {
    const prox = calcularParcelaPorData(fin, 1, 5, new Date(2026, 11, 15), base); // 15/12
    const jan = calcularParcelaPorData(fin, 1, 5, new Date(2027, 0, 15), base);   // 15/01
    const mar = calcularParcelaPorData(fin, 1, 5, new Date(2027, 2, 15), base);   // 15/03
    expect(prox).toBeLessThan(jan);
    expect(jan).toBeLessThan(mar);
    // bate com a planilha (~722,5 em 15/01)
    expect(jan).toBeCloseTo(722.49, 0);
  });

  it('1ª parcela 1 mês após a base = PMT simples (sem capitalização extra)', () => {
    const p = calcularParcelaPorData(fin, 1, 5, new Date(2026, 11, 9), base); // base + 1 mês
    expect(p).toBeCloseTo(calculatePMT(fin, 1, 5), 2);
  });
});

describe('diluirValorAdiado (parcela adiada diluída nas demais, com juros)', () => {
  const dataBase = new Date(2026, 10, 6); // ~ data da renegociação
  // Caso Vagner (simplificado): reforço 2026 adiado, recebe nos anos 2027..2032.
  const adiada = [{ saldoAtual: 15214.26, dataVencimento: new Date(2026, 11, 5) }];
  const recebedoras = [2027, 2028, 2029, 2030, 2031, 2032].map((ano) => ({
    saldoAtual: 15214.26,
    dataVencimento: new Date(ano, 11, 5),
  }));

  it('sem juros: divide o valor igualmente, sem acréscimo', () => {
    const r = diluirValorAdiado(adiada, recebedoras, dataBase, 0);
    // valor presente = saldo (taxa 0 não desconta)
    expect(r.valorPresenteAdiado).toBeCloseTo(15214.26, 2);
    // cada incremento = 15214.26 / 6
    r.incrementos.forEach((inc) => expect(inc).toBeCloseTo(15214.26 / 6, 1));
  });

  it('com juros: a última parcela recebe o maior incremento', () => {
    const r = diluirValorAdiado(adiada, recebedoras, dataBase, 1); // 1% a.m.
    // incrementos estritamente crescentes (mais longe = mais juros)
    for (let k = 1; k < r.incrementos.length; k++) {
      expect(r.incrementos[k]).toBeGreaterThan(r.incrementos[k - 1]);
    }
    // soma diluída > valor adiado (juros do adiamento foram cobrados)
    const somaInc = r.incrementos.reduce((s, x) => s + x, 0);
    expect(somaInc).toBeGreaterThan(r.valorPresenteAdiado);
  });

  it('traz a valor presente antes (não usa o saldo cheio): adiada futura é limpa', () => {
    // Uma adiada bem no futuro deve entrar por MENOS que o saldo (VP < saldo).
    const adiadaFutura = [{ saldoAtual: 10000, dataVencimento: new Date(2030, 0, 1) }];
    const rec = [{ saldoAtual: 5000, dataVencimento: new Date(2031, 0, 1) }];
    const r = diluirValorAdiado(adiadaFutura, rec, dataBase, 1);
    expect(r.valorPresenteAdiado).toBeLessThan(10000);
  });
});

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
