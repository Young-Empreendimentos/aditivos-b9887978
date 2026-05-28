import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/formatters';
import { useAuth } from '@/contexts/AuthContext';
import {
  listarQuitacoes,
  atualizarStatusQuitacao,
  STATUS_LABELS,
  STATUS_CLASSES,
  STATUS_ORDER,
  type RegistroQuitacao,
  type StatusQuitacao,
} from '@/lib/quitacaoHistorico';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: { toDate?: () => Date } | string | null | undefined): string {
  if (!ts) return '—';
  try {
    const d = typeof ts === 'string' ? new Date(ts) : ts.toDate?.() ?? new Date();
    return format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch {
    return '—';
  }
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'dd/MM/yyyy', { locale: ptBR });
}

function StatusBadge({ status }: { status: StatusQuitacao }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const STATUS_ORDER: StatusQuitacao[] = ['simulado', 'aprovado', 'enviado', 'quitado', 'cancelado'];

// ─── Dialog de alteração de status ───────────────────────────────────────────

function StatusDialog({
  registro,
  open,
  onClose,
  onSaved,
}: {
  registro: RegistroQuitacao;
  open: boolean;
  onClose: () => void;
  onSaved: (id: string, novoStatus: StatusQuitacao) => void;
}) {
  const { user } = useAuth();
  const [novoStatus, setNovoStatus] = useState<StatusQuitacao>(registro.status);
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNovoStatus(registro.status);
      setObs('');
    }
  }, [open, registro.status]);

  async function handleSave() {
    if (novoStatus === registro.status) {
      toast.info('Status não foi alterado.');
      onClose();
      return;
    }
    setSaving(true);
    try {
      await atualizarStatusQuitacao(registro.id, novoStatus, user?.email ?? 'desconhecido', obs);
      toast.success(`Status atualizado para "${STATUS_LABELS[novoStatus]}"`);
      onSaved(registro.id, novoStatus);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{registro.clienteNome}</span>
            {' — '}
            {registro.contratoNumero}
          </div>
          <div className="space-y-1.5">
            <Label>Novo status</Label>
            <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v as StatusQuitacao)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Observação <span className="text-muted-foreground">(opcional)</span></Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: Enviado por e-mail em 28/05/2026"
              className="min-h-[80px] text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Linha expandível ─────────────────────────────────────────────────────────

function RegistroRow({
  r,
  expanded,
  onToggle,
  onEditStatus,
}: {
  r: RegistroQuitacao;
  expanded: boolean;
  onToggle: () => void;
  onEditStatus: () => void;
}) {
  const descontoAbsoluto = r.valorSaldoAtual - r.totalQuitacao;
  const descontoPct = r.valorSaldoAtual > 0
    ? (descontoAbsoluto / r.valorSaldoAtual) * 100
    : 0;

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40"
        onClick={onToggle}
      >
        <TableCell className="w-6 px-2">
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </TableCell>
        <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
          {fmtDate(r.criadoEm as any)}
        </TableCell>
        <TableCell className="font-medium text-sm max-w-[180px] truncate" title={r.clienteNome}>
          {r.clienteNome}
        </TableCell>
        <TableCell className="text-xs tabular-nums whitespace-nowrap">
          {r.contratoNumero || r.billId}
        </TableCell>
        <TableCell className="text-xs max-w-[140px] truncate" title={r.empreendimento}>
          {r.empreendimento}
        </TableCell>
        <TableCell className="text-xs text-center">{r.lote ?? '—'}</TableCell>
        <TableCell className="text-xs text-right tabular-nums">
          {r.percentualPago.toFixed(1).replace('.', ',')}%
        </TableCell>
        <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
          {formatCurrency(r.valorSaldoAtual)}
        </TableCell>
        <TableCell className="text-sm text-right tabular-nums font-semibold text-primary">
          {formatCurrency(r.totalQuitacao)}
        </TableCell>
        <TableCell className="text-xs text-right tabular-nums text-green-700 dark:text-green-400">
          {descontoAbsoluto > 0
            ? `${formatCurrency(descontoAbsoluto)} (${descontoPct.toFixed(1).replace('.', ',')}%)`
            : '—'}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={r.status} />
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Alterar status"
            onClick={onEditStatus}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={12} className="p-0">
            <div className="p-4 grid md:grid-cols-2 gap-6">

              {/* Parcelas */}
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Parcelas — base {fmtDateShort(r.dataBase)}
                  {' · '}
                  {r.taxaPercent.toFixed(4).replace('.', ',')}% a.m.
                  {' · '}
                  {r.regraDescricao}
                  {' · '}
                  {r.isRegistrado ? 'Registrado' : 'Não registrado'}
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-7 text-xs w-14 text-center">Nº</TableHead>
                      <TableHead className="h-7 text-xs">Vencimento</TableHead>
                      <TableHead className="h-7 text-xs text-right">Saldo atual</TableHead>
                      <TableHead className="h-7 text-xs text-right">C/ desconto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.parcelas.map((p) => (
                      <TableRow key={p.numero} className={p.dias < 0 ? 'bg-destructive/5' : ''}>
                        <TableCell className="py-1 text-xs text-center tabular-nums">
                          {String(p.numero).padStart(2, '0')}
                          {p.dias < 0 && (
                            <span className="ml-1 text-[10px] text-destructive">venc.</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1 text-xs tabular-nums">
                          {fmtDateShort(p.dataVencimento)}
                        </TableCell>
                        <TableCell className="py-1 text-xs text-right tabular-nums text-muted-foreground">
                          {formatCurrency(p.valorAtual)}
                        </TableCell>
                        <TableCell className="py-1 text-xs text-right tabular-nums font-medium">
                          {formatCurrency(p.valorComDesconto)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-primary/5">
                      <TableCell colSpan={2} className="py-1 text-xs font-bold">Total</TableCell>
                      <TableCell className="py-1 text-xs text-right tabular-nums text-muted-foreground font-medium">
                        {formatCurrency(r.valorSaldoAtual)}
                      </TableCell>
                      <TableCell className="py-1 text-xs text-right tabular-nums font-bold text-primary">
                        {formatCurrency(r.totalQuitacao)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Histórico de status */}
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Histórico de status
                </p>
                <div className="space-y-2">
                  {[...(r.statusHistorico ?? [])].reverse().map((entry, i) => (
                    <div key={i} className="flex gap-3 items-start text-xs">
                      <div className="mt-0.5 shrink-0">
                        <StatusBadge status={entry.status} />
                      </div>
                      <div className="text-muted-foreground leading-relaxed">
                        <span className="tabular-nums">{fmtDate(entry.em as any)}</span>
                        {' · '}
                        <span>{entry.por}</span>
                        {entry.obs && (
                          <span className="block text-foreground/80 italic">{entry.obs}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-[11px] text-muted-foreground space-y-0.5">
                  <div>Calculado por: <span className="text-foreground">{r.criadoPorNome}</span></div>
                  {r.lote && (
                    <div>
                      Lote: <span className="text-foreground">{r.lote}</span>
                      {!r.loteHabilitado && (
                        <span className="ml-2 text-destructive">(sem desconto de quitação)</span>
                      )}
                    </div>
                  )}
                  <div>% Pago: <span className="text-foreground">{r.percentualPago.toFixed(2).replace('.', ',')}%</span></div>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function QuitacaoHistorico() {
  const [registros, setRegistros] = useState<RegistroQuitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusDialogId, setStatusDialogId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('__all__');
  const [filterBusca, setFilterBusca] = useState('');

  async function carregarDados() {
    setLoading(true);
    try {
      const data = await listarQuitacoes();
      setRegistros(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregarDados(); }, []);

  const registrosFiltrados = registros.filter((r) => {
    if (filterStatus !== '__all__' && r.status !== filterStatus) return false;
    if (filterBusca.trim().length >= 2) {
      const q = filterBusca.trim().toLowerCase();
      return (
        r.clienteNome.toLowerCase().includes(q) ||
        r.contratoNumero.toLowerCase().includes(q) ||
        r.empreendimento.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const statusDialogRegistro = statusDialogId
    ? registros.find((r) => r.id === statusDialogId) ?? null
    : null;

  function handleStatusSaved(id: string, novoStatus: StatusQuitacao) {
    setRegistros((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: novoStatus } : r))
    );
  }

  // Resumo de totais filtrados
  const totalQuitacao = registrosFiltrados.reduce((s, r) => s + r.totalQuitacao, 0);
  const totalSaldo = registrosFiltrados.reduce((s, r) => s + r.valorSaldoAtual, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/quitacao"><ArrowLeft className="h-4 w-4" /> Quitação</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Histórico de Quitações</h1>
              <p className="text-sm text-muted-foreground">
                Simulações salvas pela equipe
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={carregarDados} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os status</SelectItem>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Buscar</Label>
            <Input
              placeholder="Cliente, contrato ou empreendimento…"
              value={filterBusca}
              onChange={(e) => setFilterBusca(e.target.value)}
              className="h-8 w-64"
            />
          </div>
          {(filterStatus !== '__all__' || filterBusca.trim()) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => { setFilterStatus('__all__'); setFilterBusca(''); }}
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Cards de resumo */}
        {registrosFiltrados.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Registros', value: String(registrosFiltrados.length) },
              { label: 'Saldo total', value: formatCurrency(totalSaldo) },
              { label: 'Total p/ quitação', value: formatCurrency(totalQuitacao) },
              {
                label: 'Desconto total',
                value: formatCurrency(totalSaldo - totalQuitacao),
                highlight: true,
              },
            ].map((c) => (
              <Card key={c.label} className="py-3">
                <CardContent className="px-4 py-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
                  <p className={`text-lg font-bold tabular-nums ${c.highlight ? 'text-green-700 dark:text-green-400' : ''}`}>
                    {c.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-0 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {loading ? 'Carregando…' : `${registrosFiltrados.length} registro${registrosFiltrados.length !== 1 ? 's' : ''}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6" />
                    <TableHead className="whitespace-nowrap">Data / hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="whitespace-nowrap">Contrato</TableHead>
                    <TableHead>Empreendimento</TableHead>
                    <TableHead className="text-center">Lote</TableHead>
                    <TableHead className="text-right whitespace-nowrap">% Pago</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Saldo atual</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Valor quitação</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Desconto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                        <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
                        Carregando histórico…
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && registrosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-10 text-muted-foreground text-sm">
                        {registros.length === 0
                          ? 'Nenhuma simulação salva ainda. Calcule uma quitação e clique em "Salvar simulação".'
                          : 'Nenhum resultado para os filtros aplicados.'}
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading &&
                    registrosFiltrados.map((r) => (
                      <RegistroRow
                        key={r.id}
                        r={r}
                        expanded={expandedId === r.id}
                        onToggle={() => setExpandedId((prev) => (prev === r.id ? null : r.id))}
                        onEditStatus={() => setStatusDialogId(r.id)}
                      />
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {statusDialogRegistro && (
        <StatusDialog
          registro={statusDialogRegistro}
          open={!!statusDialogId}
          onClose={() => setStatusDialogId(null)}
          onSaved={handleStatusSaved}
        />
      )}
    </div>
  );
}
