import type { Empreendimento } from './empreendimentos';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ParcelaQuitacaoInput {
  numero: number;
  dataVencimento: Date;
  valorAtual: number;    // VF — saldo corrigido com tudo (current_balance_with_addition)
  valorCorrigido: number; // saldo com correção monetária, SEM juros/multa de atraso (corrected_balance_amount)
}

export interface ParcelaQuitacaoResult {
  numero: number;
  dataVencimento: Date;
  valorAtual: number;        // VF
  valorComDesconto: number;  // VP calculado
  dias: number;              // + futuro / - vencida
}

export interface ResultadoQuitacao {
  parcelas: ParcelaQuitacaoResult[];
  totalQuitacao: number;
  taxaAplicada: number;    // % a.m. decimal (0.0053)
  taxaPercent: number;     // % a.m. display (0.53)
  regraDescricao: string;
  percentualPago: number;
  dataBase: Date;
}

// ─── Validação de data ───────────────────────────────────────────────────────

/** Impede data posterior ao último dia do mês atual */
export function validarDataBase(data: Date): boolean {
  const hoje = new Date();
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  ultimoDiaMes.setHours(23, 59, 59, 999);
  return data <= ultimoDiaMes;
}

/** Retorna o último dia do mês atual no formato YYYY-MM-DD (para input[type=date] max) */
export function ultimoDiaMesAtual(): string {
  const hoje = new Date();
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return ultimo.toISOString().split('T')[0];
}

// ─── Cálculo ─────────────────────────────────────────────────────────────────

/** Dias inteiros entre dataBase e dataParcela (positivo = futuro, negativo = vencida) */
function diasEntre(dataBase: Date, dataParcela: Date): number {
  return Math.round((dataParcela.getTime() - dataBase.getTime()) / 86400000);
}

/**
 * VP = VF / (1 + iDiaria)^dias
 * iDiaria = (1 + iMensal)^(1/30) - 1
 *
 * dias > 0 → VP < VF (desconto — parcela futura)
 * dias = 0 → VP = VF
 *
 * Nota: esta função NÃO é chamada para parcelas em atraso (dias < 0).
 * Nesses casos, o valor do banco (current_balance_with_addition) já inclui
 * os acréscimos devidos e é usado diretamente em calcularQuitacao.
 *
 * Idêntico à fórmula Excel:
 *   =-VP((1+(($D$13+1)^(1/12)-1))^(1/30)-1; dias; ; VF)
 */
function calcVP(vf: number, taxaMensalDecimal: number, dias: number): number {
  if (taxaMensalDecimal === 0) return vf;
  const iDiaria = Math.pow(1 + taxaMensalDecimal, 1 / 30) - 1;
  return vf / Math.pow(1 + iDiaria, dias);
}

// ─── Motor de regras ─────────────────────────────────────────────────────────

/**
 * Busca a taxa aplicável seguindo a hierarquia:
 * 1. Regra específica que bata em todos os critérios configurados
 * 2. Taxa padrão do empreendimento (fallback obrigatório)
 *
 * Critérios disponíveis por regra: is_registrado, % pago, data_contrato_min/max
 */
export function buscarTaxa(
  emp: Empreendimento,
  isRegistrado: boolean,
  percentualPago: number,
  dataContrato?: Date | null,
): { taxa: number; taxaPercent: number; descricao: string } {
  for (const r of emp.regrasQuitacao ?? []) {
    // Critério: status de registro
    if (r.is_registrado !== null && r.is_registrado !== isRegistrado) continue;
    // Critério: % pago
    const min = r.pago_min ?? 0;
    const max = r.pago_max ?? 100;
    if (percentualPago < min || percentualPago > max) continue;
    // Critério: data de emissão do contrato
    if (r.data_contrato_min || r.data_contrato_max) {
      // Se não soubermos a data do contrato, não aplicamos a regra
      if (!dataContrato || isNaN(dataContrato.getTime())) continue;
      if (r.data_contrato_min) {
        const [y, m, d] = r.data_contrato_min.split('-').map(Number);
        if (dataContrato < new Date(y, m - 1, d)) continue;
      }
      if (r.data_contrato_max) {
        const [y, m, d] = r.data_contrato_max.split('-').map(Number);
        if (dataContrato > new Date(y, m - 1, d, 23, 59, 59)) continue;
      }
    }
    // Todos os critérios bateram
    const taxaPercent = r.taxa;
    return {
      taxa: taxaPercent / 100,
      taxaPercent,
      descricao: r.descricao ?? 'Regra específica',
    };
  }
  // Fallback: taxa padrão
  const taxaPercent = emp.taxaJurosQuitacao ?? 0;
  return { taxa: taxaPercent / 100, taxaPercent, descricao: 'Taxa padrão' };
}

// ─── Função principal ─────────────────────────────────────────────────────────

export function calcularQuitacao(
  parcelas: ParcelaQuitacaoInput[],
  dataBase: Date,
  isRegistrado: boolean,
  valorTotalContrato: number,
  emp: Empreendimento,
  dataContrato?: Date | null,
): ResultadoQuitacao {
  if (!validarDataBase(dataBase)) {
    throw new Error('A data base não pode ser posterior ao último dia do mês atual.');
  }

  // % pago = (valor original do contrato − saldo corrigido em aberto) / valor original do contrato
  // "Saldo corrigido" = com correção monetária (INCC/IGPM), mas SEM juros de atraso nem multa.
  // Campo Sienge: corrected_balance_amount → valorCorrigido
  const totalCorrigidoEmAberto = parcelas.reduce((s, p) => s + p.valorCorrigido, 0);
  const percentualPago =
    valorTotalContrato > 0
      ? Math.max(0, Math.min(100, ((valorTotalContrato - totalCorrigidoEmAberto) / valorTotalContrato) * 100))
      : 0;

  const { taxa, taxaPercent, descricao } = buscarTaxa(emp, isRegistrado, percentualPago, dataContrato);

  const parcelasCalc: ParcelaQuitacaoResult[] = parcelas
    .filter((p) => p.valorAtual > 0)
    .map((p) => {
      const dias = diasEntre(dataBase, p.dataVencimento);
      // Parcela em atraso (dias < 0): o banco já retorna o saldo com juros e acréscimos
      // (current_balance_with_addition) — não aplicar desconto nem acréscimo adicional.
      // Parcela futura (dias > 0): aplicar desconto de VP normalmente.
      const vp = dias < 0 ? p.valorAtual : calcVP(p.valorAtual, taxa, dias);
      return {
        numero: p.numero,
        dataVencimento: p.dataVencimento,
        valorAtual: p.valorAtual,
        valorComDesconto: Math.round(vp * 100) / 100,
        dias,
      };
    });

  const totalQuitacao =
    Math.round(parcelasCalc.reduce((s, p) => s + p.valorComDesconto, 0) * 100) / 100;

  return {
    parcelas: parcelasCalc,
    totalQuitacao,
    taxaAplicada: taxa,
    taxaPercent,
    regraDescricao: descricao,
    percentualPago,
    dataBase,
  };
}
