import { Link } from 'react-router-dom';
import { FileText, Receipt, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission, ROLE_LABELS } from '@/hooks/usePermission';
import { toast } from 'sonner';

const ROLE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  coordinator: 'secondary',
  common: 'outline',
};

const Index = () => {
  const { user, logout } = useAuth();
  const { role, isCoordinator } = usePermission();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao sair');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-12 relative text-center">
          <div className="absolute right-0 top-0 flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName ?? user.email ?? ''} />}
                  <AvatarFallback>
                    {(user.displayName ?? user.email ?? '?').slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-xs font-medium">{user.displayName ?? user.email}</span>
                  <Badge variant={ROLE_BADGE_VARIANT[role]} className="h-4 px-1.5 text-[10px]">
                    {ROLE_LABELS[role]}
                  </Badge>
                </div>
              </div>
            )}
            {isCoordinator && (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link to="/configuracoes">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Config. Aditivo</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/configuracoes/quitacao">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Config. Quitação</span>
                  </Link>
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Young Empreendimentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Selecione uma ferramenta para começar</p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
          <Link to="/gerador-aditivo" className="group">
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary cursor-pointer">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Gerador de Aditivo Contratual</CardTitle>
                <CardDescription>Reparcelamento de contrato de compra e venda de imóvel</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/quitacao" className="group">
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary cursor-pointer">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                  <Receipt className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Quitação</CardTitle>
                <CardDescription>Em construção</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
