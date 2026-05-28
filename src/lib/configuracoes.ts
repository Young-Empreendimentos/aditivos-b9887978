import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';

/** Regra de taxa para aditivos (ex: contrato registrado paga taxa menor) */
export interface RegraAditivo {
  is_registrado: boolean | null; // null = qualquer status
  taxa: number;                  // % a.m., ex: 1.50
  descricao?: string;
}

/**
 * Retorna a taxa de juros para aditivo aplicando a hierarquia de regras:
 * 1. Primeira regra que bater no critério is_registrado
 * 2. taxa_padrao (taxaJuros)
 */
export function buscarTaxaAditivo(cfg: ConfiguracaoEmpresa, isRegistrado: boolean): number {
  for (const r of cfg.regrasAditivo ?? []) {
    if (r.is_registrado !== null && r.is_registrado !== isRegistrado) continue;
    return r.taxa;
  }
  return cfg.taxaJuros;
}

export interface ConfiguracaoEmpresa {
  company_id: string;
  company_name: string;
  /** Taxa de juros padrão usada nos aditivos (% a.m.) */
  taxaJuros: number;
  /** Regras específicas de taxa para aditivos (ex: registrado × não registrado) */
  regrasAditivo?: RegraAditivo[];
  /** Taxa de juros usada nas quitações (% a.m.) */
  taxaJurosQuitacao?: number;
  /** Template para contratos NÃO registrados em cartório */
  templateBase64?: string;
  templateName?: string;
  templateSize?: number;
  /** Template para contratos JÁ registrados em cartório */
  templateRegistradoBase64?: string;
  templateRegistradoName?: string;
  templateRegistradoSize?: number;
  updatedAt?: number;
  updatedBy?: string | null;
}

/**
 * Retorna o template correto (base64 + name) conforme status de registro.
 * Prioridade: template específico do tipo → template padrão (não registrado).
 */
export function buscarTemplateAditivo(
  cfg: ConfiguracaoEmpresa,
  isRegistrado: boolean,
): { base64: string; name: string } | null {
  if (isRegistrado && cfg.templateRegistradoBase64) {
    return {
      base64: cfg.templateRegistradoBase64,
      name: cfg.templateRegistradoName ?? `${cfg.company_name}_registrado.docx`,
    };
  }
  if (cfg.templateBase64) {
    return {
      base64: cfg.templateBase64,
      name: cfg.templateName ?? `${cfg.company_name}.docx`,
    };
  }
  return null;
}

const COLLECTION = 'configuracoes_empresa_aditivos';
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

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
    regrasAditivo: config.regrasAditivo ?? [],
    taxaJurosQuitacao:
      config.taxaJurosQuitacao === undefined
        ? undefined
        : Number(config.taxaJurosQuitacao) || 0,
    templateBase64: config.templateBase64,
    templateName: config.templateName,
    templateSize: config.templateSize,
    templateRegistradoBase64: config.templateRegistradoBase64,
    templateRegistradoName: config.templateRegistradoName,
    templateRegistradoSize: config.templateRegistradoSize,
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

export async function fetchTemplateAsFile(
  cfg: ConfiguracaoEmpresa,
  isRegistrado = false,
): Promise<File | null> {
  const tpl = buscarTemplateAditivo(cfg, isRegistrado);
  if (!tpl) return null;
  const bytes = base64ToUint8(tpl.base64);
  return new File([bytes.buffer as ArrayBuffer], tpl.name, { type: DOCX_MIME });
}

export async function listConfiguracoes(): Promise<ConfiguracaoEmpresa[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => d.data() as ConfiguracaoEmpresa);
}
