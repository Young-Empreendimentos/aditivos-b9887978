import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface ConfiguracaoEmpresa {
  company_id: string;
  company_name: string;
  taxaJuros: number;
  templateBase64?: string;
  templateName?: string;
  templateSize?: number;
  updatedAt?: number;
  updatedBy?: string | null;
}

const COLLECTION = 'configuracoes_empresa_aditivos';

export async function getConfiguracao(company_id: string): Promise<ConfiguracaoEmpresa | null> {
  if (!company_id) return null;
  const ref = doc(db, COLLECTION, String(company_id));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as ConfiguracaoEmpresa;
}

export async function upsertConfiguracao(
  config: Omit<ConfiguracaoEmpresa, 'updatedAt' | 'updatedBy'> &
    Partial<Pick<ConfiguracaoEmpresa, 'updatedBy'>>,
): Promise<void> {
  if (!config.company_id) throw new Error('company_id é obrigatório');
  const ref = doc(db, COLLECTION, String(config.company_id));
  const payload: ConfiguracaoEmpresa = {
    company_id: String(config.company_id),
    company_name: config.company_name,
    taxaJuros: Number(config.taxaJuros) || 0,
    templateBase64: config.templateBase64,
    templateName: config.templateName,
    templateSize: config.templateSize,
    updatedAt: Date.now(),
    updatedBy: config.updatedBy ?? auth.currentUser?.email ?? auth.currentUser?.uid ?? null,
  };
  const cleaned = payload as unknown as Record<string, unknown>;
  Object.keys(cleaned).forEach((k) => {
    if (cleaned[k] === undefined) delete cleaned[k];
  });
  await setDoc(ref, payload, { merge: true });
}

export async function listConfiguracoes(): Promise<ConfiguracaoEmpresa[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => d.data() as ConfiguracaoEmpresa);
}
