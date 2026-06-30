import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SemAcesso } from '@/components/SemAcesso';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  // Logado com e-mail Young, mas ainda não aprovado por um coordenador.
  if (role === null) return <SemAcesso />;
  return <>{children}</>;
};
