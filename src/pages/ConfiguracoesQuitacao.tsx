import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import {
  listEmpreendimentos,
  upsertEmpreendimento,
  type Empreendimento,
  type RegraQuitacao,
} from '@/lib/empreendimentos';

// ─── Linha editável da tabela principal ──────────────────────────────────────

interface EmpRow extends Empreendimento {
  taxaInput: string;
  dirty: boolean;
  saving: boolean;
}

// ─── Componente de regras específicas (Dialog) ────────────────────────────────

interface RegraRow extends RegraQuitacao {
  _key: number;
}

function emptyRegra(key: number): RegraRow {
  return { _key: key, is_registrado: null, pago_min: null, pago_max: null, taxa: 0, descricao: '' };
}

function RegraDialog({
  empreendimento,
  open,
  onClose,
  onSaved,
}: {
  empreendimento: Empreendimento;
  open: boolean;
  onClose: () => void;
  onSaved: (regras: RegraQuitacao[]) => void;
}) {
  const [regras, setRegras] = useState<RegraRow[]>([]);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      setRegras(
        (empreendimento.regrasQuitacao ?? []).map((r, i) => ({ ...r, _key: i }))
      );
    }
  }, [open, empreendimento]);

  function addRegra() {
    setRegras((prev) => [...prev, emptyRegra(Date.now())]);
  }

  function removeRegra(key: number) {
    setRegras((prev) => prev.filter((r) => r._key !== key));
  }

  function updateRegra(key: number, patch: Partial<RegraRow>) {
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
      const clean: RegraQuitacao[] = regras.map(({ _key, ...r }) => ({
        is_registrado: r.is_registrado,
        pago_min: r.pago_min,
        pago_max: r.pago_max,
        taxa: Number(r.taxa),
        descricao: r.descricao || undefined,
      }));
      await upsertEmpreendimento(
        { ...empreendimento, regrasQuitacao: clean },
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

  const registradoLabel = (v: boolean | null) => {
    if (v === true) return 'Sim';
    if (v === false) return 'Não';
    return 'Qualquer';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Regras específicas — {empreendimento.nome}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2 mb-3">
          O sistema usa a <strong>primeira regra que bater</strong> nos critérios. Se nenhuma bater,
          usa a taxa padrão.
        </p>

        <div className="max-h-[50vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Registrado?</TableHead>
                <TableHead className="w-24">% Pago min</TableHead>
                <TableHead className="w-24">% Pago max</TableHead>
                <TableHead className="w-28">Taxa % a.m.</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regras.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    Nenhuma regra específica. Clique em "+ Adicionar" para criar.
                  </TableCell>
                </TableRow>
              )}
              {regras.map((r) => (
                <TableRow key={r._key}>
                  <TableCell>
                    <Select
                      value={r.is_registrado === null ? 'null' : String(r.is_registrado)}
                      onValueChange={(v) =>
                        updateRegra(r._key, {
                          is_registrado: v === 'null' ? null : v === 'true',
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue>{registradoLabel(r.is_registrado)}</SelectValue>
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
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      placeholder="0"
                      value={r.pago_min ?? ''}
                      onChange={(e) =>
                        updateRegra(r._key, {
                          pago_min: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className="h-8 w-20 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      placeholder="100"
                      value={r.pago_max ?? ''}
                      onChange={(e) =>
                        updateRegra(r._key, {
                          pago_max: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      className="h-8 w-20 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={r.taxa}
                      onChange={(e) => updateRegra(r._key, { taxa: Number(e.target.value) })}
                      className="h-8 w-24 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Ex: Registrado >50% pago"
                      value={r.descricao ?? ''}
                      onChange={(e) => updateRegra(r._key, { descricao: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeRegra(r._key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button variant="outline" size="sm" onClick={addRegra} className="w-fit">
          <Plus className="h-3.5 w-3.5" /> Adicionar regra
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Fechar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar regras
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConfiguracoesQuitacao() {
  const { user } = useAuth();
  const { isAdmin, role } = usePermission();
  const canEdit = isAdmin;

  const [rows, setRows] = useState<EmpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogEmp, setDialogEmp] = useState<Empreendimento | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const emps = await listEmpreendimentos();
        if (cancelled) return;
        setRows(
          emps.map((e) => ({
            ...e,
            taxaInput: String(e.taxaJurosQuitacao ?? ''),
            dirty: false,
            saving: false,
          }))
        );
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Erro ao carregar empreendimentos');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function updateTaxa(id: string, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, taxaInput: value, dirty: true } : r))
    );
  }

  async function saveRow(r: EmpRow) {
    const taxa = Number(r.taxaInput);
    if (!Number.isFinite(taxa) || taxa < 0 || taxa > 100) {
      toast.error('Taxa inválida (0–100)');
      return;
    }
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, saving: true } : x)));
    try {
      await upsertEmpreendimento(
        { ...r, taxaJurosQuitacao: taxa },
        user?.email ?? null
      );
      toast.success(`Salvo: ${r.nome}`);
      setRows((prev) =>
        prev.map((x) =>
          x.id === r.id ? { ...x, taxaJurosQuitacao: taxa, saving: false, dirty: false } : x
        )
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, saving: false } : x)));
    }
  }

  function onRulesSaved(empId: string, regras: RegraQuitacao[]) {
    setRows((prev) =>
      prev.map((r) => (r.id === empId ? { ...r, regrasQuitacao: regras } : r))
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Configurações · Quitação</h1>
              <p className="text-sm text-muted-foreground">
                Taxa padrão e regras de desconto por empreendimento
              </p>
            </div>
          </div>
          <Badge variant="outline" className="capitalize">{role}</Badge>
        </header>

        {!canEdit && (
          <div className="mb-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Você tem permissão somente de leitura nesta página.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empreendimentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empreendimento</TableHead>
                  <TableHead className="w-44 text-right">Taxa padrão (% a.m.)</TableHead>
                  <TableHead className="w-32 text-center">Regras específicas</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                      Carregando empreendimentos…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      Nenhum empreendimento cadastrado. Crie primeiro em Configurações.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        disabled={!canEdit || r.saving}
                        value={r.taxaInput}
                        onChange={(e) => updateTaxa(r.id, e.target.value)}
                        className="h-8 w-28 ml-auto tabular-nums text-right"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!canEdit}
                        onClick={() => setDialogEmp(r)}
                        className="gap-1"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        {(r.regrasQuitacao?.length ?? 0) > 0
                          ? `${r.regrasQuitacao!.length} regra${r.regrasQuitacao!.length > 1 ? 's' : ''}`
                          : 'Configurar'}
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
          A taxa padrão é usada quando nenhuma regra específica bater nos critérios do contrato.
          Regras específicas combinam: status de registro + % do contrato já pago.
        </p>
      </div>

      {dialogEmp && (
        <RegraDialog
          empreendimento={dialogEmp}
          open={!!dialogEmp}
          onClose={() => setDialogEmp(null)}
          onSaved={(regras) => {
            onRulesSaved(dialogEmp.id, regras);
            setDialogEmp(null);
          }}
        />
      )}
    </div>
  );
}
