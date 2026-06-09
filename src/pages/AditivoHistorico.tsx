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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency } from '@/lib/formatters';
import { useAuth } from '@/contexts/AuthContext';
import {
  listarAditivos,
  atualizarStatusAditivo,
  STATUS_LABELS,
  STATUS_CLASSES,
  STATUS_ORDER,
  type RegistroAditivo,
  type StatusAditivo,
} from '@/lib/aditivoHistorico';

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

function StatusBadge({ status }: { status: StatusAditivo }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Dialog de alteração de status ───────────────────────────────────────────

function StatusDialog({
  registro,
  open,
  onClose,
  onSaved,
}: {
  registro: RegistroAditivo;
  open: boolean;
  onClose: () => void;
  onSaved: (id: string, novoStatus: StatusAditivo) => void;
}) {
  const { user } = useAuth();
  const [novoStatus, setNovoStatus] = useState<StatusAditivo>(registro.status);
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
      toast.info('Status nao foi alterado.');
      onClose();
      return;
    }
    setSaving(true);
    try {
      await atualizarStatusAditivo(registro.id, novoStatus, user?.email ?? 'desconhecido', obs);
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
            <Select value={novoStatus} onValueChange={(v) => setNovoStatus(v as StatusAditivo)}>
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
            <Label>Observacao <span className="text-muted-foreground">(opcional)</span></Label>
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
  r: RegistroAditivo;
  expanded: boolean;
  onToggle: () => void;
  onEditStatus: () => void;
}) {
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
        <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
          {formatCurrency(r.totalQuadro1)}
        </TableCell>
        <TableCell className="text-sm text-right tabular-nums font-semibold text-primary">
          {formatCurrency(r.totalQuadro2)}
        </TableCell>
        <TableCell className="text-xs text-right tabular-nums">
          {r.taxaJuros.toFixed(2).replace('.', ',')}%
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
          <TableCell colSpan={10} className="p-0">
            <div className="p-4 grid md:grid-cols-3 gap-6">

              {/* Quadro 1 */}
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Quadro 1 — Parcelas Originais
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-7 text-xs w-14 text-center">N</TableHead>
                      <TableHead className="h-7 text-xs">Vencimento</TableHead>
                      <TableHead className="h-7 text-xs text-right">Valor Original</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.parcelasQuadro1.map((p) => (
                      <TableRow key={p.numero}>
                        <TableCell className="py-1 text-xs text-center tabular-nums">
                          {String(p.numero).padStart(2, '0')}
                        </TableCell>
                        <TableCell className="py-1 text-xs tabular-nums">
                          {fmtDateShort(p.dataVencimento)}
                        </TableCell>
                        <TableCell className="py-1 text-xs text-right tabular-nums">
                          {formatCurrency(p.valorOriginal)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-primary/5">
                      <TableCell colSpan={2} className="py-1 text-xs font-bold">Total</TableCell>
                      <TableCell className="py-1 text-xs text-right tabular-nums font-bold">
                        {formatCurrency(r.totalQuadro1)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Quadro 2 */}
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Quadro 2 — Novo Plano
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-7 text-xs w-14 text-center">N</TableHead>
                      <TableHead className="h-7 text-xs">Vencimento</TableHead>
                      <TableHead className="h-7 text-xs text-right">Valor</TableHead>
                      <TableHead className="h-7 text-xs w-16">Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.parcelasQuadro2.map((p) => (
                      <TableRow key={`${p.tipo}-${p.numero}`} className={p.tipo === 'reforco' ? 'bg-accent/30' : p.tipo === 'mantida' ? 'bg-muted/30' : ''}>
                        <TableCell className="py-1 text-xs text-center tabular-nums">
                          {String(p.numero).padStart(2, '0')}
                        </TableCell>
                        <TableCell className="py-1 text-xs tabular-nums">
                          {fmtDateShort(p.dataVencimento)}
                        </TableCell>
                        <TableCell className="py-1 text-xs text-right tabular-nums font-medium">
                          {formatCurrency(p.valor)}
                        </TableCell>
                        <TableCell className="py-1">
                          {p.tipo === 'reforco' && <Badge variant="secondary" className="text-[10px] px-1">Ref.</Badge>}
                          {p.tipo === 'mantida' && <Badge variant="outline" className="text-[10px] px-1">Mant.</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-primary/5">
                      <TableCell colSpan={2} className="py-1 text-xs font-bold">Total</TableCell>
                      <TableCell className="py-1 text-xs text-right tabular-nums font-bold text-primary">
                        {formatCurrency(r.totalQuadro2)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Info + Historico de status */}
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Parametros
                </p>
                <div className="space-y-1 text-xs mb-4">
                  <div>Taxa: <span className="text-foreground font-medium">{r.taxaJuros.toFixed(2).replace('.', ',')}% a.m.</span></div>
                  <div>Custos adicionais: <span className="text-foreground font-medium">{formatCurrency(r.custosAdicionais)}</span></div>
                  <div>Data renegociacao: <span className="text-foreground font-medium">{fmtDateShort(r.dataRenegociacao)}</span></div>
                  {r.correcaoMonetaria && (
                    <div>Correcao: <span className="text-foreground font-medium">{r.correcaoMonetaria}</span></div>
                  )}
                  <div>Registro: <span className="text-foreground font-medium">{r.isRegistrado ? 'Registrado' : 'Nao registrado'}</span></div>
                  <div>PV Total: <span className="text-foreground font-medium">{formatCurrency(r.pvTotal)}</span></div>
                  <div>Total Juros: <span className="text-foreground font-medium">{formatCurrency(r.totalJuros)}</span></div>
                </div>

                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Historico de status
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
                <div className="mt-4 text-[11px] text-muted-foreground">
                  Simulado por: <span className="text-foreground">{r.criadoPorNome}</span>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Pagina principal ─────────────────────────────────────────────────────────

export default function AditivoHistorico() {
  const [registros, setRegistros] = useState<RegistroAditivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusDialogId, setStatusDialogId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('__all__');
  const [filterBusca, setFilterBusca] = useState('');

  async function carregarDados() {
    setLoading(true);
    try {
      const data = await listarAditivos();
      setRegistros(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar historico');
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

  function handleStatusSaved(id: string, novoStatus: StatusAditivo) {
    setRegistros((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: novoStatus } : r))
    );
  }

  const totalQ1 = registrosFiltrados.reduce((s, r) => s + r.totalQuadro1, 0);
  const totalQ2 = registrosFiltrados.reduce((s, r) => s + r.totalQuadro2, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/gerador"><ArrowLeft className="h-4 w-4" /> Gerador</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Historico de Aditivos</h1>
              <p className="text-sm text-muted-foreground">
                Simulacoes salvas pela equipe
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
              placeholder="Cliente, contrato ou empreendimento..."
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Registros', value: String(registrosFiltrados.length) },
              { label: 'Total Quadro 1', value: formatCurrency(totalQ1) },
              { label: 'Total Quadro 2 (Renegociado)', value: formatCurrency(totalQ2), highlight: true },
            ].map((c) => (
              <Card key={c.label} className="py-3">
                <CardContent className="px-4 py-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{c.label}</p>
                  <p className={`text-lg font-bold tabular-nums ${c.highlight ? 'text-primary' : ''}`}>
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
              {loading ? 'Carregando...' : `${registrosFiltrados.length} registro${registrosFiltrados.length !== 1 ? 's' : ''}`}
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
                    <TableHead className="text-right whitespace-nowrap">Quadro 1</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Quadro 2</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Taxa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                        <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
                        Carregando historico...
                      </TableCell>
                    </TableRow>
                  )}
                  {!loading && registrosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-10 text-muted-foreground text-sm">
                        {registros.length === 0
                          ? 'Nenhuma simulacao salva ainda. Gere um aditivo e clique em "Salvar simulacao".'
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
