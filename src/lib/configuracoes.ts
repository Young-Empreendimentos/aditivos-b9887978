import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import pako from 'pako';
import { db, auth } from './firebase';

export interface ConfiguracaoEmpresa {
  company_id: string;
  company_name: string;
  taxaJuros: number;
  /** Template .docx comprimido com gzip e codificado em base64 (novo formato) */
  templateBase64Gz?: string;
  /** @deprecated base64 puro (formato antigo, mantido para retrocompatibilidade) */
  templateBase64?: string;
  /** @deprecated URL no Storage (formato intermediário, mantido para retrocompatibilidade) */
  templateUrl?: string;
  /** @deprecated caminho no Storage */
  templatePath?: string;
  templateName?: string;
  templateSize?: number; // tamanho original em bytes
  updatedAt?: number;
  updatedBy?: string | null;
}

const COLLECTION = 'configuracoes_empresa_aditivos';
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ---------- helpers de codificação ----------

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(bin);
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Comprime um File em base64+gzip. */
export async function compressFileToBase64Gz(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const gz = pako.gzip(buf, { level: 9 });
  return uint8ToBase64(gz);
}

// ---------- Firestore ----------

export async function getConfiguracao(
  company_id: string,
): Promise<ConfiguracaoEmpresa | null> {
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
    templateBase64Gz: config.templateBase64Gz,
    templateBase64: config.templateBase64,
    templateUrl: config.templateUrl,
    templatePath: config.templatePath,
    templateName: config.templateName,
    templateSize: config.templateSize,
    updatedAt: Date.now(),
    updatedBy:
      config.updatedBy ?? auth.currentUser?.email ?? auth.currentUser?.uid ?? null,
  };
  const cleaned = payload as unknown as Record<string, unknown>;
  Object.keys(cleaned).forEach((k) => {
    if (cleaned[k] === undefined) delete cleaned[k];
  });
  await setDoc(ref, payload, { merge: true });
}

/** Reconstrói o File a partir do que estiver salvo (gz, base64 puro ou URL antiga). */
export async function fetchTemplateAsFile(
  cfg: Pick<
    ConfiguracaoEmpresa,
    'templateBase64Gz' | 'templateBase64' | 'templateUrl' | 'templateName' | 'company_name'
  >,
): Promise<File | null> {
  const name = cfg.templateName ?? `${cfg.company_name ?? 'modelo'}.docx`;
  if (cfg.templateBase64Gz) {
    const gz = base64ToUint8(cfg.templateBase64Gz);
    const bytes = pako.ungzip(gz);
    return new File([bytes], name, { type: DOCX_MIME });
  }
  if (cfg.templateBase64) {
    const bytes = base64ToUint8(cfg.templateBase64);
    return new File([bytes], name, { type: DOCX_MIME });
  }
  if (cfg.templateUrl) {
    const res = await fetch(cfg.templateUrl);
    if (!res.ok) throw new Error(`Falha ao baixar modelo (HTTP ${res.status})`);
    const blob = await res.blob();
    return new File([blob], name, { type: DOCX_MIME });
  }
  return null;
}

export async function listConfiguracoes(): Promise<ConfiguracaoEmpresa[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => d.data() as ConfiguracaoEmpresa);
}
