import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Clock, Loader2, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { listUsuarios, aprovarUsuario, removerUsuario, type UsuarioAcesso, type Role } from '@/lib/usuarios';

const DOMINIO = '@youngempreendimentos.com.br';

const ROLE_OPCOES: { value: Role; label: string }[] = [
  { value: 'common', label: 'Usuário' },
  { value: 'coordinator', label: 'Coordenador' },
  { value: 'admin', label: 'Admin' },
];

function RoleSelect({ value, onChange, disabled }: { value: Role; onChange: (r: Role) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Role)} disabled={disabled}>
      <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        {ROLE_OPCOES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export default function Usuarios() {
  const { user } = useAuth();
  const { isCoordinator, role } = usePermission();

  const [usuarios, setUsuarios] = useState<UsuarioAcesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoRole, setNovoRole] = useState<Role>('common');
  const [pendenteRoles, setPendenteRoles] = useState<Record<string, Role>>({});

  const carregar = async () => {
    setLoading(true);
    try {
      setUsuarios(await listUsuarios());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCoordinator) carregar();
  }, [isCoordinator]);

  if (!isCoordinator) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Você não tem permissão para gerenciar usuários. Fale com um coordenador.
      </div>
    );
  }

  const aprovar = async (email: string, r: Role) => {
    setBusy(email);
    try {
      await aprovarUsuario(email, r, user?.email ?? null);
      toast.success(`${email} liberado`);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao aprovar (verifique as regras do Firestore)');
    } finally {
      setBusy(null);
    }
  };

  const remover = async (email: string) => {
    setBusy(email);
    try {
      await removerUsuario(email);
      toast.success(`Acesso de ${email} removido`);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    } finally {
      setBusy(null);
    }
  };

  const adicionarManual = async () => {
    const email = novoEmail.toLowerCase().trim();
    if (!email.endsWith(DOMINIO)) {
      toast.error(`Use um e-mail ${DOMINIO}`);
      return;
    }
    await aprovar(email, novoRole);
    setNovoEmail('');
    setNovoRole('common');
  };

  const pendentes = usuarios.filter((u) => u.status === 'pendente');
  const aprovados = usuarios.filter((u) => u.status === 'aprovado');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Usuários e acesso</h1>
              <p className="text-sm text-muted-foreground">Aprove quem pode usar o Recalcula</p>
            </div>
          </div>
          <Badge variant="outline" className="capitalize">{role ?? ''}</Badge>
        </header>

        {/* Liberar manualmente */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Liberar acesso manualmente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 flex-1 min-w-[220px]">
              <Label htmlFor="novoEmail">E-mail</Label>
              <Input id="novoEmail" placeholder={`nome${DOMINIO}`} value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Papel</Label>
              <RoleSelect value={novoRole} onChange={setNovoRole} disabled={busy !== null} />
            </div>
            <Button onClick={adicionarManual} disabled={busy !== null}><Check className="h-4 w-4" /> Liberar</Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Carregando…
          </div>
        ) : (
          <>
            {/* Pendentes */}
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" /> Pendentes de aprovação ({pendentes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendentes.length === 0 && <p className="text-sm text-muted-foreground">Ninguém aguardando aprovação.</p>}
                {pendentes.map((u) => (
                  <div key={u.email} className="flex flex-wrap items-center gap-3 border rounded-md px-3 py-2">
                    <span className="font-medium text-sm flex-1 min-w-[200px]">{u.email}</span>
                    <RoleSelect
                      value={pendenteRoles[u.email] ?? 'common'}
                      onChange={(r) => setPendenteRoles((p) => ({ ...p, [u.email]: r }))}
                      disabled={busy === u.email}
                    />
                    <Button size="sm" disabled={busy === u.email} onClick={() => aprovar(u.email, pendenteRoles[u.email] ?? 'common')}>
                      {busy === u.email ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Aprovar
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === u.email} onClick={() => remover(u.email)} title="Recusar">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Aprovados */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Com acesso ({aprovados.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aprovados.length === 0 && <p className="text-sm text-muted-foreground">Ninguém liberado ainda.</p>}
                {aprovados.map((u) => (
                  <div key={u.email} className="flex flex-wrap items-center gap-3 border rounded-md px-3 py-2">
                    <span className="font-medium text-sm flex-1 min-w-[200px]">{u.email}</span>
                    <RoleSelect value={u.role ?? 'common'} onChange={(r) => aprovar(u.email, r)} disabled={busy === u.email} />
                    <Button variant="ghost" size="icon" className="h-9 w-9" disabled={busy === u.email} onClick={() => remover(u.email)} title="Remover acesso">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          Coordenador e admin podem liberar/remover acesso. Quem entra pela 1ª vez fica "pendente" até ser aprovado.
        </p>
      </div>
    </div>
  );
}
