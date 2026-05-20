import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const EMPREENDIMENTOS_COLLECTION = 'empreendimentos_gerador_aditivos';

export interface Empreendimento {
  id: string;
  nome: string;
  taxaJuros: number; // % a.m.
  templateBase64?: string; // .docx encoded in base64 (small files only)
  templateName?: string;
  templateSize?: number;
  updatedAt?: number;
  updatedBy?: string | null;
}

function slugify(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function listEmpreendimentos(): Promise<Empreendimento[]> {
  const q = query(collection(db, EMPREENDIMENTOS_COLLECTION), orderBy('nome'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Empreendimento, 'id'>) }));
}

export async function upsertEmpreendimento(
  e: Omit<Empreendimento, 'id'> & { id?: string },
  updatedBy?: string | null
): Promise<string> {
  const id = e.id ?? (slugify(e.nome) || crypto.randomUUID());
  const ref = doc(db, EMPREENDIMENTOS_COLLECTION, id);
  const payload: Record<string, unknown> = {
    nome: e.nome,
    taxaJuros: e.taxaJuros,
    updatedAt: serverTimestamp(),
    updatedBy: updatedBy ?? null,
  };
  if (e.templateBase64 !== undefined) payload.templateBase64 = e.templateBase64;
  if (e.templateName !== undefined) payload.templateName = e.templateName;
  if (e.templateSize !== undefined) payload.templateSize = e.templateSize;
  await setDoc(ref, payload, { merge: true });
  return id;
}

export async function deleteEmpreendimento(id: string): Promise<void> {
  await deleteDoc(doc(db, EMPREENDIMENTOS_COLLECTION, id));
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export function base64ToBlob(b64: string, mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'): Blob {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
