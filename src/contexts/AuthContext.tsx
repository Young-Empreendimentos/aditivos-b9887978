import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

export type Role = 'admin' | 'coordinator' | 'common';

const ROLES_COLLECTION = 'roles_gerador_aditivos';
const ALLOWED_DOMAIN = '@youngempreendimentos.com.br';

const SEED_ROLES: Record<string, Role> = {
  'eduardo@youngempreendimentos.com.br': 'admin',
  'suelen@youngempreendimentos.com.br': 'coordinator',
};

interface AuthContextValue {
  user: User | null;
  role: Role;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchRole(email: string): Promise<Role> {
  const key = email.toLowerCase();
  try {
    const ref = doc(db, ROLES_COLLECTION, key);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as { role?: Role };
      if (data.role === 'admin' || data.role === 'coordinator' || data.role === 'common') {
        return data.role;
      }
    }
    // Seed default for known users / first-login common
    const seeded: Role = SEED_ROLES[key] ?? 'common';
    try {
      await setDoc(ref, { role: seeded, email: key }, { merge: true });
    } catch {
      // ignore write failure (rules may restrict), fall back to in-memory role
    }
    return seeded;
  } catch {
    return SEED_ROLES[key] ?? 'common';
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>('common');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u?.email && u.email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
        const r = await fetchRole(u.email);
        setRole(r);
      } else {
        setRole('common');
      }
      setLoading(false);
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
    setRole('common');
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
