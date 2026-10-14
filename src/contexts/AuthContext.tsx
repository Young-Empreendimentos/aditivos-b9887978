import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

export type Role = 'admin' | 'coordinator' | 'common';

const ROLES_COLLECTION = 'roles_gerador_aditivos';
const ALLOWED_DOMAIN = '@youngempreendimentos.com.br';

// Usuários "semente": entram já aprovados para destravar o início.
// O restante é liberado por eles na tela de Usuários.
const SEED_ROLES: Record<string, Role> = {
  'eduardo@youngempreendimentos.com.br': 'admin',
  'elen@youngempreendimentos.com.br': 'admin',
  'suelen@youngempreendimentos.com.br': 'coordinator',
};

interface AuthContextValue {
  user: User | null;
  /** null = logado (e-mail Young) mas SEM acesso liberado (pendente de aprovação). */
  role: Role | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isRole(r: unknown): r is Role {
  return r === 'admin' || r === 'coordinator' || r === 'common';
}

/** Garante que a promessa resolva em no máximo `ms` (senão devolve `fallback`).
 *  Evita o app ficar preso em "Carregando…" se a rede pendurar sem dar erro. */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Retorna o papel se o usuário estiver APROVADO; senão null (sem acesso).
 * - Doc aprovado → papel.
 * - Doc legado (tem papel, sem campo `status`) → tratado como aprovado (não tranca quem já usava).
 * - Doc pendente / sem papel → null.
 * - Sem doc: semente entra aprovada; demais viram solicitação "pendente" (para o coordenador ver).
 */
async function fetchRole(email: string): Promise<Role | null> {
  const key = email.toLowerCase();
  const ref = doc(db, ROLES_COLLECTION, key);

  // Sementes são os donos fixos: o papel definido no código SEMPRE vale,
  // mesmo que o registro no banco esteja diferente — e auto-corrige o registro.
  if (SEED_ROLES[key]) {
    const seeded = SEED_ROLES[key];
    try {
      await setDoc(ref, { email: key, role: seeded, status: 'aprovado', aprovadoPor: 'seed' }, { merge: true });
    } catch { /* regras do Firestore podem bloquear a escrita */ }
    return seeded;
  }

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as { role?: unknown; status?: string };
      const hasRole = isRole(data.role);
      const status = data.status ?? (hasRole ? 'aprovado' : 'pendente'); // compat com docs antigos
      if (status === 'aprovado' && hasRole) return data.role as Role;
      return null;
    }
    // Sem doc: registra a solicitação pendente para aparecer na tela de Usuários
    try {
      await setDoc(ref, { email: key, role: null, status: 'pendente', solicitadoEm: new Date().toISOString() }, { merge: true });
    } catch { /* regras do Firestore podem bloquear a escrita */ }
    return null;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      try {
        if (u?.email && u.email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
          const r = await withTimeout(fetchRole(u.email), 8000, null);
          setRole(r);
        } else {
          setRole(null);
        }
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const email = result.user.email ?? '';
    if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
      await signOut(auth);
      throw new Error('Acesso restrito. Use sua conta @youngempreendimentos.com.br');
    }
    const r = await fetchRole(email);
    setRole(r);
  };

  const logout = async () => {
    await signOut(auth);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
