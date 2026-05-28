/**
 * Histórico de simulações de quitação.
 * Coleção Firestore: quitacao_historico
 * Cada documento representa uma simulação salva por um usuário.
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

export const HISTORICO_COLLECTION = 'quitacao_historico';

export type StatusQuitacao = 'simulado' | 'aprovado' | 'enviado' | 'quitado' | 'cancelado';

export const STATUS_LABELS: Record<StatusQuitacao, string> = {
  simulado: 'Simulado',
  aprovado: 'Aprovado',
  enviado: 'Enviado ao cliente',
  quitado: 'Quitado',
  cancelado: 'Cancelado',
};

export const STATUS_CLASSES: Record<StatusQuitacao, string> = {
  simulado: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300',
  aprovado: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300',
  enviado: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300',
  quitado: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300',
  cancelado: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300',
};

export interface ParcelaHistorico {
  numero: number;
  dataVencimento: string; // YYYY-MM-DD
  valorAtual: number;
  valorComDesconto: number;
  dias: number;
}

export interface StatusEntry {
  status: StatusQuitacao;
  em: Timestamp;
  por: string;
  obs?: string;
}

export interface RegistroQuitacao {
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
  lote: string | null;
  loteHabilitado: boolean;

  // Parâmetros do cálculo
  dataBase: string;          // YYYY-MM-DD
  isRegistrado: boolean;

  // Resultado
  taxaPercent: number;
  regraDescricao: string;
  percentualPago: number;
  valorSaldoAtual: number;
  totalQuitacao: number;
  descontoTotal: number;

  // Parcelas
  parcelas: ParcelaHistorico[];

  // Workflow
  status: StatusQuitacao;
  statusHistorico: StatusEntry[];
  observacao?: string;
}

export type NovoRegistroQuitacao = Omit<
  RegistroQuitacao,
  'id' | 'criadoEm' | 'statusHistorico'
>;

/** Salva uma nova simulação e retorna o ID gerado. */
export async function salvarQuitacao(dados: NovoRegistroQuitacao): Promise<string> {
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

/** Lista todas as simulações ordenadas da mais recente para a mais antiga. */
export async function listarQuitacoes(): Promise<RegistroQuitacao[]> {
  const q = query(
    collection(db, HISTORICO_COLLECTION),
    orderBy('criadoEm', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RegistroQuitacao));
}

/** Atualiza o status de uma simulação e adiciona uma entrada no histórico. */
export async function atualizarStatusQuitacao(
  id: string,
  novoStatus: StatusQuitacao,
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
