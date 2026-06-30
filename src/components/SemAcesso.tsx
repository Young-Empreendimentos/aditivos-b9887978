import { Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

/** Tela mostrada para quem está logado (e-mail Young) mas ainda não foi aprovado. */
export function SemAcesso() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950">
      <main className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-10 space-y-6 text-center">
          <div className="h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
            <Clock className="h-7 w-7 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-slate-900">Acesso pendente de aprovação</h1>
            <p className="text-sm text-slate-500">
              {user?.email && (
                <>
                  <strong>{user.email}</strong>
                  <br />
                </>
              )}
              Seu acesso ao Recalcula ainda não foi liberado. Um coordenador precisa aprovar sua entrada.
            </p>
            <p className="text-xs text-slate-400">Assim que aprovarem, é só entrar novamente.</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => logout()}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </main>
    </div>
  );
}
