import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calculator, Coins, GripVertical, Info, List, Loader2, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import {
  listEmpreendimentosSienge,
  listRegrasTipo,
  salvarRegrasTipo,
  LABEL_REGRA_TIPO,
  type RegraTipoRecebimento,
  type RegraTipoValor,
} from '@/lib/sienge';
import {
  getQuitacaoConfig,
  saveQuitacaoConfig,
  type QuitacaoConfig,
  type RegraQuitacao,
} from '@/lib/quitacaoConfig';

// ─── Linha da tabela principal ────────────────────────────────────────────────

interface EmpRow {
  nome: string;
  taxaInput: string;
  regras: RegraQuitacao[];
  lotes_habilitados: string[] | null;
  dirty: boolean;
  saving: boolean;
}

// ─── Dialog de regras específicas ────────────────────────────────────────────

interface RegraRow extends RegraQuitacao {
  _key: string;
}

function emptyRegra(): RegraRow {
  return {
    _key: String(Date.now() + Math.random()),
    is_registrado: null,
    pago_min: null,
    pago_max: null,
    taxa: 0,
    descricao: '',
  };
}

// Linha sortável individual
function SortableRegraRow({
  regra,
  index,
  onUpdate,
  onRemove,
  readOnly = false,
}: {
  regra: RegraRow;
  index: number;
  onUpdate: (key: string, patch: Partial<RegraRow>) => void;
  onRemove: (key: string) => void;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: regra._key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
    position: isDragging ? ('relative' as const) : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      {/* Handle de arrasto */}
      {!readOnly && (
      <TableCell className="w-8 px-1 text-center">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted touch-none"
          tabIndex={-1}
          type="button"
          title="Arrastar para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      )}
      {/* Nº ordem */}
      <TableCell className="w-8 text-center text-xs font-mono text-muted-foreground select-none">
        {index + 1}
      </TableCell>
      <TableCell>
        <Select
          value={regra.is_registrado === null ? 'null' : String(regra.is_registrado)}
          disabled={readOnly}
          onValueChange={(v) =>
            onUpdate(regra._key, {
              is_registrado: v === 'null' ? null : v === 'true',
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue>
              {regra.is_registrado === null ? 'Qualquer' : regra.is_registrado ? 'Sim' : 'Não'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="null">Qualquer</SelectItem>
            <SelectItem value="true">Sim</SelectItem>
            <SelectItem value="false">Não</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number" min={0} max={100} step={1} placeholder="0"
          value={regra.pago_min ?? ''}
          disabled={readOnly}
          onChange={(e) =>
            onUpdate(regra._key, { pago_min: e.target.value === '' ? null : Number(e.target.value) })
          }
          className="h-8 w-20 text-right tabular-nums"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number" min={0} max={100} step={1} placeholder="100"
          value={regra.pago_max ?? ''}
          disabled={readOnly}
          onChange={(e) =>
            onUpdate(regra._key, { pago_max: e.target.value === '' ? null : Number(e.target.value) })
          }
          className="h-8 w-20 text-right tabular-nums"
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-1 items-center">
          <Input
            type="date"
            value={regra.data_contrato_min ?? ''}
            disabled={readOnly}
            onChange={(e) =>
              onUpdate(regra._key, { data_contrato_min: e.target.value || null })
            }
            className="h-8 w-32 tabular-nums text-xs"
            title="Data contrato de"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={regra.data_contrato_max ?? ''}
            disabled={readOnly}
            onChange={(e) =>
              onUpdate(regra._key, { data_contrato_max: e.target.value || null })
            }
            className="h-8 w-32 tabular-nums text-xs"
            title="Data contrato até"
          />
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="number" min={0} max={100} step={0.01}
          value={regra.taxa}
          disabled={readOnly}
          onChange={(e) => onUpdate(regra._key, { taxa: Number(e.target.value) })}
          className="h-8 w-24 text-right tabular-nums"
        />
      </TableCell>
      <TableCell>
        <Input
          placeholder="Ex: Período sem desconto"
          value={regra.descricao ?? ''}
          disabled={readOnly}
          onChange={(e) => onUpdate(regra._key, { descricao: e.target.value })}
          className="h-8 text-xs"
        />
      </TableCell>
      {!readOnly && (
      <TableCell>
        <Button
          size="icon" variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onRemove(regra._key)}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
      )}
    </TableRow>
  );
}

function RegraDialog({
  nomeEmp,
  regrasIniciais,
  open,
  onClose,
  onSaved,
  readOnly = false,
}: {
  nomeEmp: string;
  regrasIniciais: RegraQuitacao[];
  open: boolean;
  onClose: () => void;
  onSaved: (regras: RegraQuitacao[]) => void;
  readOnly?: boolean;
}) {
  const [regras, setRegras] = useState<RegraRow[]>([]);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  // Evita re-inicializar ao salvar (só recria quando o dialog abre)
  const openRef = useRef(false);
  useEffect(() => {
    if (open && !openRef.current) {
      setRegras(
        regrasIniciais.map((r, i) => ({
          ...r,
          _key: String(i) + '_' + String(Date.now()),
        }))
      );
    }
    openRef.current = open;
  }, [open, regrasIniciais]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRegras((prev) => {
        const oldIndex = prev.findIndex((r) => r._key === active.id);
        const newIndex = prev.findIndex((r) => r._key === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function addRegra() {
    setRegras((prev) => [...prev, emptyRegra()]);
  }

  function removeRegra(key: string) {
    setRegras((prev) => prev.filter((r) => r._key !== key));
  }

  function updateRegra(key: string, patch: Partial<RegraRow>) {
    setRegras((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    for (const r of regras) {
      if (!Number.isFinite(r.taxa) || r.taxa < 0 || r.taxa > 100) {
        toast.error('Taxa inválida em uma das regras (0–100)');
        return;
      }
    }
    setSaving(true);
    try {
      const clean: RegraQuitacao[] = regras.map(({ _key: _k, ...r }) => ({
        is_registrado: r.is_registrado,
        pago_min: r.pago_min,
        pago_max: r.pago_max,
        taxa: Number(r.taxa),
        ...(r.descricao ? { descricao: r.descricao } : {}),
        ...(r.data_contrato_min ? { data_contrato_min: r.data_contrato_min } : { data_contrato_min: null }),
        ...(r.data_contrato_max ? { data_contrato_max: r.data_contrato_max } : { data_contrato_max: null }),
      }));
      const current = await getQuitacaoConfig(nomeEmp);
      await saveQuitacaoConfig(
        { empreendimento: nomeEmp, taxa_padrao: current?.taxa_padrao ?? 0, regras: clean },
        user?.email ?? null
      );
      toast.success('Regras salvas!');
      onSaved(clean);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Regras específicas — {nomeEmp}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2 mb-3">
          O sistema usa a <strong>primeira regra que bater</strong> nos critérios (em ordem).
          Se nenhuma bater, usa a taxa padrão.
          {!readOnly && <span className="ml-1 text-[11px]">— Arraste <GripVertical className="inline h-3 w-3 align-middle" /> para reordenar.</span>}
        </p>

        <div className="max-h-[50vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {!readOnly && <TableHead className="w-8" />}
                <TableHead className="w-8 text-center text-xs">#</TableHead>
                <TableHead className="w-28">Registrado?</TableHead>
                <TableHead className="w-24">% Pago min</TableHead>
                <TableHead className="w-24">% Pago max</TableHead>
                <TableHead>Período contrato (de → até)</TableHead>
                <TableHead className="w-28">Taxa % a.m.</TableHead>
                <TableHead>Descrição</TableHead>
                {!readOnly && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {regras.length === 0 && (
                <TableRow>
                  <TableCell colSpan={readOnly ? 7 : 9} className="text-center text-sm text-muted-foreground py-6">
                    {readOnly ? 'Nenhuma regra específica configurada.' : 'Nenhuma regra específica. Clique em "+ Adicionar" para criar.'}
                  </TableCell>
                </TableRow>
              )}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={regras.map((r) => r._key)}
                  strategy={verticalListSortingStrategy}
                >
                  {regras.map((r, idx) => (
                    <SortableRegraRow
                      key={r._key}
                      regra={r}
                      index={idx}
                      onUpdate={updateRegra}
                      onRemove={removeRegra}
                      readOnly={readOnly}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </TableBody>
          </Table>
        </div>

        {!readOnly && (
          <Button variant="outline" size="sm" onClick={addRegra} className="w-fit">
            <Plus className="h-3.5 w-3.5" /> Adicionar regra
          </Button>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Fechar</Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar regras
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog de lotes habilitados ─────────────────────────────────────────────

function LotesDialog({
  nomeEmp,
  lotesIniciais,
  open,
  onClose,
  onSaved,
  readOnly = false,
}: {
  nomeEmp: string;
  lotesIniciais: string[] | null;
  open: boolean;
  onClose: () => void;
  onSaved: (lotes: string[] | null) => void;
  readOnly?: boolean;
}) {
  const [todos, setTodos] = useState(true);
  const [textarea, setTextarea] = useState('');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      if (!lotesIniciais || lotesIniciais.length === 0) {
        setTodos(true);
        setTextarea('');
      } else {
        setTodos(false);
        setTextarea(lotesIniciais.join('\n'));
      }
    }
  }, [open, lotesIniciais]);

  async function handleSave() {
    setSaving(true);
    try {
      const lotes = todos
        ? null
        : textarea
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);
      const current = await getQuitacaoConfig(nomeEmp);
      await saveQuitacaoConfig(
        {
          empreendimento: nomeEmp,
          taxa_padrao: current?.taxa_padrao ?? 0,
          regras: current?.regras ?? [],
          lotes_habilitados: lotes,
        },
        user?.email ?? null
      );
      toast.success('Lotes salvos!');
      onSaved(lotes);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lotes com desconto — {nomeEmp}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Defina quais lotes podem receber desconto de quitação.
          Lotes fora da lista serão calculados sem desconto.
        </p>

        <div className="space-y-4">
          {readOnly ? (
            todos ? (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                Todos os lotes deste empreendimento receberão desconto de quitação.
              </p>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Lotes com desconto habilitado:</Label>
                <div className="font-mono text-xs rounded-md border p-3 min-h-[100px] bg-muted/30 whitespace-pre-line">
                  {textarea || '(nenhum)'}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {textarea.split('\n').filter((l: string) => l.trim()).length} lote(s)
                </p>
              </div>
            )
          ) : (
            <>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={todos ? 'default' : 'outline'}
                  onClick={() => setTodos(true)}
                >
                  Todos os lotes
                </Button>
                <Button
                  size="sm"
                  variant={!todos ? 'default' : 'outline'}
                  onClick={() => setTodos(false)}
                >
                  Lotes específicos
                </Button>
              </div>

              {!todos && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Um lote por linha (exatamente como aparece no sistema, ex: "Lote 113")
                  </Label>
                  <Textarea
                    value={textarea}
                    onChange={(e) => setTextarea(e.target.value)}
                    placeholder={'Lote 01\nLote 02\nLote 05'}
                    className="font-mono text-xs min-h-[180px]"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {textarea.split('\n').filter((l) => l.trim()).length} lote(s) cadastrado(s)
                  </p>
                </div>
              )}

              {todos && (
                <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
                  Todos os lotes deste empreendimento receberão desconto de quitação.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Fechar</Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Regras: o que conta como "valor pago" ──────────────────────────────────
// Fonte única = tabela no banco, lida pelo cálculo. Editar aqui (admin) muda o
// cálculo da quitação na hora (e o bot do financeiro, que usa a mesma função).

const REGRA_BADGE: Record<RegraTipoValor, string> = {
  sempre: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  nunca: 'bg-rose-100 text-rose-700 border-rose-200',
  so_entrada: 'bg-amber-100 text-amber-800 border-amber-200',
  so_fora_entrada: 'bg-sky-100 text-sky-700 border-sky-200',
};

function RegrasValorPagoCard({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<RegraTipoRecebimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await listRegrasTipo();
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function setRegra(tipo: string, regra: RegraTipoValor) {
    setRows((prev) => prev.map((r) => (r.tipo === tipo ? { ...r, regra } : r)));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await salvarRegrasTipo(rows.map(({ tipo, regra, descricao }) => ({ tipo, regra, descricao })));
      toast.success('Regras salvas! O cálculo da quitação já está usando elas.');
      setDirty(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar as regras');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Coins className="h-4 w-4 text-[#fe5009]" />
          Como o valor pago é calculado
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Cada baixa do Sienge tem um <strong>tipo</strong>. Aqui você decide quais tipos entram na conta
          de <strong>“quanto o cliente já pagou”</strong> — que define a faixa de desconto da quitação.
          {canEdit
            ? ' O que estiver aqui é exatamente o que o sistema usa no cálculo.'
            : ' (Somente leitura — peça a um admin para alterar.)'}
        </p>
      </CardHeader>
      <CardContent>
        {/* Legenda das opções */}
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(LABEL_REGRA_TIPO) as RegraTipoValor[]).map((k) => (
            <div key={k} className="flex items-center gap-2 rounded-md border p-2">
              <Badge variant="outline" className={`${REGRA_BADGE[k]} font-medium`}>{LABEL_REGRA_TIPO[k]}</Badge>
              <span className="text-[11px] text-muted-foreground leading-tight">
                {k === 'sempre' && 'em qualquer parcela'}
                {k === 'nunca' && 'nunca entra'}
                {k === 'so_entrada' && 'só na entrada ou sinal (AT/SI)'}
                {k === 'so_fora_entrada' && 'só fora da entrada/sinal'}
              </span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Carregando regras…
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Tipo de baixa</TableHead>
                  <TableHead>O que é</TableHead>
                  <TableHead className="w-56">Conta como pago?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.tipo}>
                    <TableCell className="font-medium">{r.tipo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.descricao}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select value={r.regra} onValueChange={(v) => setRegra(r.tipo, v as RegraTipoValor)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(LABEL_REGRA_TIPO) as RegraTipoValor[]).map((k) => (
                              <SelectItem key={k} value={k} className="text-xs">{LABEL_REGRA_TIPO[k]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={`${REGRA_BADGE[r.regra]} font-medium`}>
                          {LABEL_REGRA_TIPO[r.regra]}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {canEdit && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              Mudanças valem para <strong>todos os contratos</strong> e para o bot do financeiro.
            </p>
            <Button onClick={handleSave} disabled={!dirty || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar regras
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Exemplo fictício do cálculo (para conferir no Excel) ────────────────────

function ExemploCalculoCard() {
  return (
    <Card className="mt-6 border-dashed">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4 text-[#fe5009]" />
          Exemplo de como a conta é feita (números fictícios)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Contrato de exemplo que <strong>não existe</strong> — serve só para você conferir a fórmula numa planilha.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Passo 1 */}
        <div className="rounded-md border p-3">
          <p className="font-medium mb-2">1) Quanto o cliente já pagou</p>
          <table className="w-full text-xs">
            <tbody className="[&_td]:py-0.5">
              <tr><td>Recebimentos normais</td><td className="text-right tabular-nums">R$ 40.000,00</td><td className="pl-3 text-emerald-700">conta</td></tr>
              <tr><td>Entrada lançada como “Cancelamento”</td><td className="text-right tabular-nums">R$ 10.000,00</td><td className="pl-3 text-emerald-700">conta (entrada)</td></tr>
              <tr><td>Bonificação (comissão ao corretor)</td><td className="text-right tabular-nums">R$ 5.000,00</td><td className="pl-3 text-rose-600">não conta</td></tr>
              <tr className="border-t font-medium"><td>Valor pago</td><td className="text-right tabular-nums">R$ 50.000,00</td><td /></tr>
            </tbody>
          </table>
        </div>

        {/* Passo 2 */}
        <div className="rounded-md border p-3">
          <p className="font-medium mb-1">2) % pago e faixa de desconto</p>
          <p className="text-xs text-muted-foreground">
            Valor total do contrato = <span className="tabular-nums">R$ 100.000,00</span>
          </p>
          <p className="font-mono text-xs mt-1">% pago = 50.000 ÷ 100.000 = <strong>50%</strong></p>
          <p className="text-xs text-muted-foreground mt-1">
            Na faixa configurada, suponha que 50% pago → taxa <strong>0,50% a.m.</strong>
          </p>
        </div>

        {/* Passo 3 */}
        <div className="rounded-md border p-3">
          <p className="font-medium mb-1">3) Desconto de cada parcela futura (valor presente)</p>
          <p className="font-mono text-xs bg-muted/40 rounded p-2 mt-1">
            VP = VF ÷ (1 + taxa_mensal)^(dias ÷ 30)
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Ex.: uma parcela de <span className="tabular-nums">R$ 1.000,00</span> que vence em <strong>180 dias</strong> (6 meses):
          </p>
          <p className="font-mono text-xs mt-1">
            VP = 1.000 ÷ (1,005)^(180÷30) = 1.000 ÷ 1,005^6 = 1.000 ÷ 1,030378 = <strong>R$ 970,51</strong>
          </p>
          <div className="mt-2 rounded bg-muted/40 p-2">
            <p className="text-[11px] text-muted-foreground mb-0.5">Cole numa célula do Excel para conferir:</p>
            <code className="text-xs select-all">=1000/(1,005)^(180/30)</code>
            <span className="text-[11px] text-muted-foreground"> → 970,51</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Parcela <strong>vencida</strong> (data já passou) entra pelo saldo cheio, sem desconto.
            O total da quitação é a soma do valor presente de todas as parcelas escolhidas.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Como o aditivo (reparcelamento) é montado — informativo p/ validação ────

function AditivoInfoCard() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4 text-[#fe5009]" />
          Como o valor do aditivo (reparcelamento) é montado
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Explicação para conferência. A <strong>ideia do aditivo é sempre aumentar</strong> — ele está
          reparcelando a dívida do cliente. Se algo aqui não fizer sentido, avise a Elen (não mude sozinha).
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ol className="list-decimal pl-5 space-y-2 text-xs">
          <li>
            Pega as parcelas que serão renegociadas e leva todas para a <strong>data base</strong>:
            <ul className="list-disc pl-5 mt-1 space-y-0.5 text-muted-foreground">
              <li>parcela <strong>vencida</strong> → soma juros de atraso (aumenta);</li>
              <li>parcela <strong>a vencer</strong> → hoje o sistema traz a valor presente.</li>
            </ul>
          </li>
          <li>Soma tudo = valor a refinanciar (mais custos, menos reforços a valor presente).</li>
          <li>Divide em N novas parcelas com juros (recoloca os juros para a frente).</li>
          <li>Junta parcelas do mesmo vencimento num boleto só.</li>
          <li>As meninas podem <strong>editar o valor</strong> de qualquer parcela do Quadro 2 na mão — a diferença se dilui nas outras, mantendo o total.</li>
        </ol>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1.5">
          <p>
            <strong>Por que desconta no passo 1 e cobra juros no passo 3?</strong> Os dois usam a mesma
            taxa, então em “dinheiro de hoje” eles <strong>se anulam</strong>: o plano novo vale hoje o
            mesmo que as parcelas antigas valiam.
          </p>
          <p>
            O total dos boletos só fica <strong>maior</strong> se o novo parcelamento for mais
            <strong> longo</strong>. Se for mais <strong>curto</strong>, pode sair igual ou até
            <strong> menor</strong> que a dívida — por isso não é garantido “sempre aumentar”.
          </p>
          <p>
            <strong>Suelen:</strong> se em algum caso o Quadro 2 sair <strong>abaixo</strong> da dívida
            atual, avise a Elen — ela decide se tira o desconto da parcela a vencer.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConfiguracoesQuitacao() {
  const { user } = useAuth();
  const { isAdmin, isCoordinator, role } = usePermission();
  const canEdit = isAdmin;
  const canView = isCoordinator; // coordinator + admin podem abrir dialogs (admin edita, coordinator só visualiza)

  const [rows, setRows] = useState<EmpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogNome, setDialogNome] = useState<string | null>(null);
  const [lotesDialogNome, setLotesDialogNome] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const nomes = await listEmpreendimentosSienge();
        const configs = await Promise.all(nomes.map((n) => getQuitacaoConfig(n).catch(() => null)));
        if (cancelled) return;
        setRows(
          nomes.map((nome, i) => {
            const cfg = configs[i] as QuitacaoConfig | null;
            return {
              nome,
              taxaInput: String(cfg?.taxa_padrao ?? ''),
              regras: cfg?.regras ?? [],
              lotes_habilitados: cfg?.lotes_habilitados ?? null,
              dirty: false,
              saving: false,
            };
          })
        );
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : (err as { message?: string })?.message ?? 'Erro ao carregar empreendimentos';
        console.error('[ConfiguracoesQuitacao] erro:', err);
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function updateTaxa(nome: string, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.nome === nome ? { ...r, taxaInput: value, dirty: true } : r))
    );
  }

  async function saveRow(r: EmpRow) {
    const taxa = Number(r.taxaInput);
    if (!Number.isFinite(taxa) || taxa < 0 || taxa > 100) {
      toast.error('Taxa inválida (0–100)');
      return;
    }
    setRows((prev) => prev.map((x) => (x.nome === r.nome ? { ...x, saving: true } : x)));
    try {
      await saveQuitacaoConfig(
        { empreendimento: r.nome, taxa_padrao: taxa, regras: r.regras },
        user?.email ?? null
      );
      toast.success(`Salvo: ${r.nome}`);
      setRows((prev) =>
        prev.map((x) =>
          x.nome === r.nome ? { ...x, saving: false, dirty: false, taxaInput: String(taxa) } : x
        )
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
      setRows((prev) => prev.map((x) => (x.nome === r.nome ? { ...x, saving: false } : x)));
    }
  }

  const dialogRow = dialogNome ? rows.find((r) => r.nome === dialogNome) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
          <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
        <header className="mb-6 flex items-start justify-between gap-3 border-l-4 border-[#fe5009] pl-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações · Quitação</h1>
            <p className="text-sm text-muted-foreground">
              Taxa de desconto por empreendimento e as regras de quanto o cliente já pagou
            </p>
          </div>
          <Badge variant="outline" className="capitalize shrink-0">{role ?? ''}</Badge>
        </header>

        {!canEdit && (
          <div className="mb-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Você tem permissão somente de leitura nesta página.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Empreendimentos
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — lista automática do Sienge
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead className="w-44 text-right">Taxa padrão (% a.m.)</TableHead>
                  <TableHead className="w-32 text-center">Regras específicas</TableHead>
                  <TableHead className="w-36 text-center">Lotes c/ desconto</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                      Carregando empreendimentos do Sienge…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      Nenhum empreendimento encontrado no Sienge.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.nome}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number" step="0.01" min="0" max="100"
                        disabled={!canEdit || r.saving}
                        value={r.taxaInput}
                        onChange={(e) => updateTaxa(r.nome, e.target.value)}
                        className="h-8 w-28 ml-auto tabular-nums text-right"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm" variant="ghost"
                        disabled={!canView}
                        onClick={() => setDialogNome(r.nome)}
                        className="gap-1"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        {r.regras.length > 0
                          ? `${r.regras.length} regra${r.regras.length > 1 ? 's' : ''}`
                          : canEdit ? 'Configurar' : 'Visualizar'}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm" variant="ghost"
                        disabled={!canView}
                        onClick={() => setLotesDialogNome(r.nome)}
                        className="gap-1"
                      >
                        <List className="h-3.5 w-3.5" />
                        {r.lotes_habilitados && r.lotes_habilitados.length > 0
                          ? `${r.lotes_habilitados.length} lote${r.lotes_habilitados.length > 1 ? 's' : ''}`
                          : 'Todos'}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        disabled={!r.dirty || r.saving || !canEdit}
                        onClick={() => saveRow(r)}
                      >
                        {r.saving
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Save className="h-3.5 w-3.5" />}
                        Salvar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="mt-3 text-[11px] text-muted-foreground">
          A lista é gerada automaticamente a partir dos empreendimentos presentes no Sienge.
          A taxa padrão é usada quando nenhuma regra específica bater nos critérios do contrato.
        </p>

        <RegrasValorPagoCard canEdit={canEdit} />
        <ExemploCalculoCard />
        <AditivoInfoCard />
      </div>

      {dialogRow && (
        <RegraDialog
          nomeEmp={dialogRow.nome}
          regrasIniciais={dialogRow.regras}
          open={!!dialogNome}
          readOnly={!canEdit}
          onClose={() => setDialogNome(null)}
          onSaved={(regras) => {
            setRows((prev) =>
              prev.map((r) => (r.nome === dialogRow.nome ? { ...r, regras } : r))
            );
            setDialogNome(null);
          }}
        />
      )}

      {lotesDialogNome && (() => {
        const lotesRow = rows.find((r) => r.nome === lotesDialogNome);
        return lotesRow ? (
          <LotesDialog
            nomeEmp={lotesRow.nome}
            lotesIniciais={lotesRow.lotes_habilitados}
            open={!!lotesDialogNome}
            readOnly={!canEdit}
            onClose={() => setLotesDialogNome(null)}
            onSaved={(lotes) => {
              setRows((prev) =>
                prev.map((r) =>
                  r.nome === lotesRow.nome ? { ...r, lotes_habilitados: lotes } : r
                )
              );
              setLotesDialogNome(null);
            }}
          />
        ) : null;
      })()}
    </div>
  );
}
