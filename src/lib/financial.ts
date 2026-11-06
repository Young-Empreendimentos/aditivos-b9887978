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

export function calcularTotalPVReforcos(reforcos: Reforco[], baseDate: Date, monthlyRate: number): number {
  return reforcos.reduce((sum, r) => sum + calcularPVReforco(r, baseDate, monthlyRate), 0);
}

/**
 * Capitaliza uma parcela vencida/a vencer até a data base da renegociação.
 * FV = saldoAtual × (1 + i_diária)^dias
 * Se a parcela é posterior à data base, desconta (dias negativo → divisão).
 */
export function capitalizarParcelaParaDataBase(
  saldoAtual: number,
  dataVencimento: Date,
  dataBase: Date,
  monthlyRate: number
): number {
  if (monthlyRate === 0 || saldoAtual === 0) return saldoAtual;
  const diffMs = dataBase.getTime() - dataVencimento.getTime();
  const dias = Math.round(diffMs / 86400000);
  if (dias === 0) return saldoAtual;
  const iMensal = monthlyRate / 100;
  const iDiaria = Math.pow(1 + iMensal, 1 / 30) - 1;
  return saldoAtual * Math.pow(1 + iDiaria, dias);
}

/**
 * Diluição de parcela(s) ADIADA(S) nas demais parcelas a vencer, COM juros.
 *
 * Caso de uso: o cliente não vai pagar uma parcela (ex.: reforço anual de 2026)
 * e quer jogar o valor dela nas parcelas seguintes, mantendo a estrutura (não vira
 * mensal). Regra financeira (Suelen): NÃO pode juros sobre juros — por isso:
 *   1. cada parcela adiada é trazida a VALOR PRESENTE na data base (tira o juro
 *      embutido), virando um valor "limpo" V0;
 *   2. V0 é dividido igualmente entre as parcelas que recebem;
 *   3. cada pedaço rende juros NOVOS da data base até a data da parcela que recebe
 *      (quanto mais pra frente, mais juros → a última fica a mais cara).
 *
 * A parcela adiada zera; cada recebedora = saldoAtual + incremento.
 * Devolve os incrementos e os valores finais, na ordem de `recebedoras`.
 */
export function diluirValorAdiado(
  adiadas: { saldoAtual: number; dataVencimento: Date }[],
  recebedoras: { saldoAtual: number; dataVencimento: Date }[],
  dataBase: Date,
  monthlyRate: number,
): { incrementos: number[]; valoresFinais: number[]; valorPresenteAdiado: number } {
  // 1. Traz cada parcela adiada a valor presente na data base (limpa o juro embutido).
  const vpAdiado = adiadas.reduce(
    (s, a) => s + capitalizarParcelaParaDataBase(a.saldoAtual, a.dataVencimento, dataBase, monthlyRate),
    0,
  );
  const n = recebedoras.length;
  if (n === 0) return { incrementos: [], valoresFinais: [], valorPresenteAdiado: vpAdiado };

  // 2. Divide igualmente o valor limpo entre as recebedoras.
  const share = vpAdiado / n;
  // 3. Aplica juros NOVOS da data base até a data de cada recebedora.
  const iMensal = monthlyRate / 100;
  const iDiaria = iMensal === 0 ? 0 : Math.pow(1 + iMensal, 1 / 30) - 1;
  const incrementos = recebedoras.map((r) => {
    const dias = Math.round((r.dataVencimento.getTime() - dataBase.getTime()) / 86400000);
    const fator = iDiaria === 0 || dias <= 0 ? 1 : Math.pow(1 + iDiaria, dias);
    return Math.round(share * fator * 100) / 100;
  });
  const valoresFinais = recebedoras.map((r, k) => Math.round((r.saldoAtual + incrementos[k]) * 100) / 100);
  return { incrementos, valoresFinais, valorPresenteAdiado: Math.round(vpAdiado * 100) / 100 };
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
