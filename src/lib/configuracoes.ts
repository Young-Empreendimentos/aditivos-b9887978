import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from './firebase';

export interface ConfiguracaoEmpresa {
  company_id: string;
  company_name: string;
  taxaJuros: number;
  /** URL pública/token do template no Firebase Storage (novo formato) */
  templateUrl?: string;
  /** Caminho do objeto no Storage, para permitir substituição/remoção */
  templatePath?: string;
  /** @deprecated mantido apenas para retrocompatibilidade com modelos antigos (<1MB) */
  templateBase64?: string;
  templateName?: string;
  templateSize?: number;
  updatedAt?: number;
  updatedBy?: string | null;
}

const COLLECTION = 'configuracoes_empresa_aditivos';
const TEMPLATE_FOLDER = 'aditivo_templates';

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
    templateUrl: config.templateUrl,
    templatePath: config.templatePath,
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

/** Faz upload do .docx para o Storage e devolve { url, path } */
export async function uploadTemplate(
  company_id: string,
  file: File,
): Promise<{ url: string; path: string }> {
  if (!company_id) throw new Error('company_id é obrigatório');
  const path = `${TEMPLATE_FOLDER}/${company_id}.docx`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, {
    contentType:
      file.type ||
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = await getDownloadURL(ref);
  return { url, path };
}

export async function deleteTemplate(path: string): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(storageRef(storage, path));
  } catch {
    /* arquivo já não existe - ignora */
  }
}

/** Faz download do template (Storage url ou base64 legado) e retorna um File */
export async function fetchTemplateAsFile(
  cfg: Pick<ConfiguracaoEmpresa, 'templateUrl' | 'templateBase64' | 'templateName' | 'company_name'>,
): Promise<File | null> {
  const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const name = cfg.templateName ?? `${cfg.company_name ?? 'modelo'}.docx`;
  if (cfg.templateUrl) {
    const res = await fetch(cfg.templateUrl);
    if (!res.ok) throw new Error(`Falha ao baixar modelo (HTTP ${res.status})`);
    const blob = await res.blob();
    return new File([blob], name, { type: mime });
  }
  if (cfg.templateBase64) {
    const binary = atob(cfg.templateBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], name, { type: mime });
  }
  return null;
}

export async function listConfiguracoes(): Promise<ConfiguracaoEmpresa[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => d.data() as ConfiguracaoEmpresa);
}
