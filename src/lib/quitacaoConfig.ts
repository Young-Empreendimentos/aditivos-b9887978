/**
 * Configurações de taxa de quitação por empreendimento.
 * Armazenadas em Firestore: quitacao_configuracoes/{empreendimento_nome}
 * Totalmente independente da coleção de empreendimentos do aditivo.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const QUITACAO_CONFIG_COLLECTION = 'quitacao_configuracoes';

export interface RegraQuitacao {
  is_registrado: boolean | null; // null = qualquer status
  pago_min: number | null;       // % mínimo, null = 0
  pago_max: number | null;       // % máximo, null = 100
  taxa: number;                  // % a.m., ex: 0.53
  descricao?: string;
  /** Intervalo de data de emissão do contrato (YYYY-MM-DD).
   *  null = sem restrição de data. */
  data_contrato_min?: string | null;
  data_contrato_max?: string | null;
}

export interface QuitacaoConfig {
  empreendimento: string;        // chave (business_area_name do Sienge)
  taxa_padrao: number;           // % a.m., ex: 0.53
  regras: RegraQuitacao[];
  /** Lista de lotes habilitados para desconto (ex: ["Lote 01", "Lote 02"]).
   *  null ou ausente = todos os lotes são habilitados (padrão). */
  lotes_habilitados?: string[] | null;
  updated_at?: unknown;
  updated_by?: string | null;
}

function slugId(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function getQuitacaoConfig(empreendimento: string): Promise<QuitacaoConfig | null> {
  const ref = doc(db, QUITACAO_CONFIG_COLLECTION, slugId(empreendimento));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as QuitacaoConfig;
}

export async function saveQuitacaoConfig(
  config: Omit<QuitacaoConfig, 'updated_at'>,
  updatedBy?: string | null
): Promise<void> {
  const ref = doc(db, QUITACAO_CONFIG_COLLECTION, slugId(config.empreendimento));
  await setDoc(
    ref,
    {
      ...config,
      updated_at: serverTimestamp(),
      updated_by: updatedBy ?? null,
    },
    { merge: true }
  );
}

export async function listQuitacaoConfigs(): Promise<QuitacaoConfig[]> {
  const snap = await getDocs(collection(db, QUITACAO_CONFIG_COLLECTION));
  return snap.docs.map((d) => d.data() as QuitacaoConfig);
}
