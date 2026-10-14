import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

export type Role = 'admin' | 'coordinator' | 'common';
export type StatusAcesso = 'pendente' | 'aprovado' | 'removido';

const COLLECTION = 'roles_gerador_aditivos';

export interface UsuarioAcesso {
  email: string;
  role: Role | null;
  status: StatusAcesso;
  solicitadoEm?: string;
  aprovadoEm?: string;
  aprovadoPor?: string | null;
}

function isRole(r: unknown): r is Role {
  return r === 'admin' || r === 'coordinator' || r === 'common';
}

/** Lista todos os usuários (aprovados e pendentes), ordenados por e-mail. */
export async function listUsuarios(): Promise<UsuarioAcesso[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs
    .filter((d) => (d.data() as { status?: string }).status !== 'removido') // esconde removidos
    .map((d) => {
      const data = d.data() as { email?: string; role?: unknown; status?: string; solicitadoEm?: string; aprovadoEm?: string; aprovadoPor?: string };
      const hasRole = isRole(data.role);
      return {
        email: data.email ?? d.id,
        role: hasRole ? (data.role as Role) : null,
        // Compat: doc antigo (tem papel, sem status) = aprovado.
        status: (data.status as StatusAcesso) ?? (hasRole ? 'aprovado' : 'pendente'),
        solicitadoEm: data.solicitadoEm,
        aprovadoEm: data.aprovadoEm,
        aprovadoPor: data.aprovadoPor ?? null,
      } as UsuarioAcesso;
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}

/** Aprova (ou altera o papel de) um usuário. */
export async function aprovarUsuario(email: string, role: Role, aprovadoPor: string | null): Promise<void> {
  const key = email.toLowerCase().trim();
  await setDoc(
    doc(db, COLLECTION, key),
    { email: key, role, status: 'aprovado', aprovadoEm: new Date().toISOString(), aprovadoPor: aprovadoPor ?? null },
    { merge: true }
  );
}

/** Remove o acesso de um usuário. Soft delete: marca 'removido' e tira o papel (bloqueia
 *  o acesso e some da lista), mas MANTÉM o registro. Regra da Elen: nunca apagar de vez.
 *  Reaprovar o usuário (aprovarUsuario) volta ele ao normal. */
export async function removerUsuario(email: string): Promise<void> {
  const key = email.toLowerCase().trim();
  await setDoc(
    doc(db, COLLECTION, key),
    { email: key, role: null, status: 'removido', removidoEm: new Date().toISOString() },
    { merge: true },
  );
}
