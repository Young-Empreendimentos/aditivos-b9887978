import { Link } from 'react-router-dom';
import { FileText, Receipt, LogOut, SlidersHorizontal, ArrowRight, FileSignature, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-bold text-primary">Y</span>
            </div>
            <span className="font-semibold tracking-tight">Young</span>
          </div>

          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden sm:flex items-center gap-2 pr-2">
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Configurações">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span className="hidden sm:inline">Configurações</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Modelos e parâmetros</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/configuracoes" className="cursor-pointer">
                      <FileSignature className="h-4 w-4" />
                      Aditivo contratual
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/configuracoes/quitacao" className="cursor-pointer">
                      <BadgeCheck className="h-4 w-4" />
                      Quitação
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>

        {/* Hero */}
        <header className="text-center mb-12">
          <Badge variant="outline" className="mb-4">Young Empreendimentos</Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
            Central de Documentos
          </h1>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Gere aditivos contratuais e termos de quitação a partir dos dados do contrato.
          </p>
        </header>

        {/* Tools */}
        <div className="grid gap-5 sm:grid-cols-2 max-w-3xl mx-auto">
          <Link to="/gerador-aditivo" className="group">
            <Card className="relative h-full overflow-hidden border-border/60 transition-all hover:shadow-xl hover:border-primary/50 hover:-translate-y-0.5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-primary/40" />
              <CardHeader>
                <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <FileText className="h-5 w-5 text-primary group-hover:text-primary-foreground" />
                </div>
                <CardTitle className="flex items-center justify-between">
                  Aditivo Contratual
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </CardTitle>
                <CardDescription>Reparcelamento de contrato de compra e venda de imóvel</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/quitacao" className="group">
            <Card className="relative h-full overflow-hidden border-border/60 transition-all hover:shadow-xl hover:border-primary/50 hover:-translate-y-0.5">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-muted-foreground/40 to-transparent" />
              <CardHeader>
                <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center mb-4">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="flex items-center justify-between">
                  Quitação
                  <Badge variant="secondary" className="text-[10px] font-normal">Em breve</Badge>
                </CardTitle>
                <CardDescription>Termo de quitação de contrato</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
