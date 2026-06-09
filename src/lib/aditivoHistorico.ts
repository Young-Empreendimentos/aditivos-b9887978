/**
 * Histórico de simulações de aditivo contratual.
 * Coleção Firestore: aditivo_historico
 * Cada documento representa um aditivo simulado/gerado por um usuário.
 */

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { DadosContratoForm } from '@/types/dadosContrato';

export const HISTORICO_COLLECTION = 'aditivo_historico';

export type StatusAditivo = 'simulado' | 'aprovado' | 'enviado' | 'assinado' | 'cancelado';

export const STATUS_LABELS: Record<StatusAditivo, string> = {
  simulado: 'Simulado',
  aprovado: 'Aprovado',
  enviado: 'Enviado ao cliente',
  assinado: 'Assinado',
  cancelado: 'Cancelado',
};

export const STATUS_ORDER: StatusAditivo[] = ['simulado', 'aprovado', 'enviado', 'assinado', 'cancelado'];

export const STATUS_CLASSES: Record<StatusAditivo, string> = {
  simulado: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300',
  aprovado: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300',
  enviado: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300',
  assinado: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300',
  cancelado: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300',
};

export interface ParcelaQ1Historico {
  numero: number;
  dataVencimento: string; // YYYY-MM-DD
  valorOriginal: number;
}

export interface ParcelaQ2Historico {
  numero: number;
  dataVencimento: string; // YYYY-MM-DD
  valor: number;
  tipo: string; // 'nova' | 'reforco' | 'mantida'
}

export interface StatusEntry {
  status: StatusAditivo;
  em: Timestamp;
  por: string;
  obs?: string;
}

export interface RegistroAditivo {
  id: string;
  criadoEm: Timestamp;
  criadoPor: string;       // email
  criadoPorNome: string;   // displayName

  // Contrato
  billId: string;
  clienteId: string;
  clienteNome: string;
  contratoNumero: string;
  empreendimento: string;
  empresa: string;
  isRegistrado: boolean;

  // Parâmetros do cálculo
  taxaJuros: number;
  custosAdicionais: number;
  correcaoMonetaria: string;
  dataRenegociacao: string; // YYYY-MM-DD

  // Resultado
  totalQuadro1: number;
  totalQuadro2: number;
  valorTotalRenegociado: number;
  pvTotal: number;
  totalJuros: number;

  // Parcelas
  parcelasQuadro1: ParcelaQ1Historico[];
  parcelasQuadro2: ParcelaQ2Historico[];

  // Dados do contrato (para regenerar documento)
  dadosForm?: DadosContratoForm;

  // Workflow
  status: StatusAditivo;
  statusHistorico: StatusEntry[];
  observacao?: string;
}

export type NovoRegistroAditivo = Omit<
  RegistroAditivo,
  'id' | 'criadoEm' | 'statusHistorico'
>;

/** Salva uma nova simulação de aditivo e retorna o ID gerado. */
export async function salvarAditivo(dados: NovoRegistroAditivo): Promise<string> {
  const primeiroStatus: StatusEntry = {
    status: dados.status,
    em: Timestamp.now(),
    por: dados.criadoPor,
  };
  const ref = await addDoc(collection(db, HISTORICO_COLLECTION), {
    ...dados,
    criadoEm: serverTimestamp(),
    statusHistorico: [primeiroStatus],
  });
  return ref.id;
}

/** Lista todos os aditivos ordenados do mais recente para o mais antigo. */
export async function listarAditivos(): Promise<RegistroAditivo[]> {
  const q = query(
    collection(db, HISTORICO_COLLECTION),
    orderBy('criadoEm', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegistroAditivo));
}

/** Atualiza o status de um aditivo e adiciona uma entrada no histórico. */
export async function atualizarStatusAditivo(
  id: string,
  novoStatus: StatusAditivo,
  por: string,
  obs?: string
): Promise<void> {
  const entrada: StatusEntry = {
    status: novoStatus,
    em: Timestamp.now(),
    por,
    ...(obs?.trim() ? { obs: obs.trim() } : {}),
  };
  await updateDoc(doc(db, HISTORICO_COLLECTION, id), {
    status: novoStatus,
    statusHistorico: arrayUnion(entrada),
  });
}
