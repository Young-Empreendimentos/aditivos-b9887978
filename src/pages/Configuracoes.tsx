import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, Loader2, Save, Settings2, Trash2, Upload, AlertCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { listEmpresas, type EmpresaSienge } from '@/lib/sienge';
import {
  getConfiguracao,
  upsertConfiguracao,
  type ConfiguracaoEmpresa,
  type RegraAditivo,
} from '@/lib/configuracoes';

type TemplateType = 'normal' | 'registrado';

interface Row {
  company_id: string;
  company_name: string;
  taxaJuros: string;
  originalTaxa: number;
  regrasAditivo: RegraAditivo[];
  // Template não registrado
  hasTemplate: boolean;
  templateName?: string;
  templateSize?: number;
  pendingFile?: File | null;
  // Template registrado
  hasTemplateRegistrado: boolean;
  templateRegistradoName?: string;
  templateRegistradoSize?: number;
  pendingFileRegistrado?: File | null;
  dirty: boolean;
  saving: boolean;
}

// ─── Dialog de regras de taxa para aditivos ──────────────────────────────────

interface RegraRow extends RegraAditivo { _key: number }

function emptyRegra(key: number): RegraRow {
  return { _key: key, is_registrado: null, taxa: 0, descricao: '' };
}

function RegraAditivoDialog({
  nomeEmpresa,
  companyId,
  regrasIniciais,
  open,
  onClose,
  onSaved,
  readOnly = false,
}: {
  nomeEmpresa: string;
  companyId: string;
  regrasIniciais: RegraAditivo[];
  open: boolean;
  onClose: () => void;
  onSaved: (regras: RegraAditivo[]) => void;
  readOnly?: boolean;
}) {
  const [regras, setRegras] = useState<RegraRow[]>([]);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open) setRegras(regrasIniciais.map((r, i) => ({ ...r, _key: i })));
  }, [open, regrasIniciais]);

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
      const clean: RegraAditivo[] = regras.map(({ _key, ...r }) => ({
        is_registrado: r.is_registrado,
        taxa: Number(r.taxa),
        ...(r.descricao ? { descricao: r.descricao } : {}),
      }));
      const current = await getConfiguracao(companyId);
      await upsertConfiguracao({
        company_id: companyId,
        company_name: nomeEmpresa,
        taxaJuros: current?.taxaJuros ?? 0,
        regrasAditivo: clean,
        updatedBy: user?.email ?? null,
      });
      toast.success('Regras de taxa salvas!');
      onSaved(clean);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const registradoLabel = (v: boolean | null) =>
    v === true ? 'Sim' : v === false ? 'Não' : 'Qualquer';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Regras de taxa — {nomeEmpresa}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2 mb-3">
          A <strong>primeira regra que bater</strong> no critério "Registrado?" é usada.
          Se nenhuma bater, aplica a taxa padrão da empresa.
        </p>
        <div className="max-h-[50vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Registrado?</TableHead>
                <TableHead className="w-28">Taxa % a.m.</TableHead>
                <TableHead>Descrição</TableHead>
                {!readOnly && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {regras.length === 0 && (
                <TableRow>
                  <TableCell colSpan={readOnly ? 3 : 4} className="text-center text-sm text-muted-foreground py-6">
                    {readOnly ? 'Nenhuma regra configurada.' : 'Nenhuma regra. Clique em "+ Adicionar" para criar.'}
                  </TableCell>
                </TableRow>
              )}
              {regras.map((r) => (
                <TableRow key={r._key}>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs">{registradoLabel(r.is_registrado)}</span>
                    ) : (
                      <Select
                        value={r.is_registrado === null ? 'null' : String(r.is_registrado)}
                        onValueChange={(v) =>
                          updateRegra(r._key, { is_registrado: v === 'null' ? null : v === 'true' })
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
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs tabular-nums">{r.taxa}%</span>
                    ) : (
                      <Input
                        type="number" min={0} max={100} step={0.01}
                        value={r.taxa}
                        onChange={(e) => updateRegra(r._key, { taxa: Number(e.target.value) })}
                        className="h-8 w-24 text-right tabular-nums"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs text-muted-foreground">{r.descricao || '—'}</span>
                    ) : (
                      <Input
                        placeholder="ex: Contrato registrado"
                        value={r.descricao ?? ''}
                        onChange={(e) => updateRegra(r._key, { descricao: e.target.value })}
                        className="h-8 text-xs"
                      />
                    )}
                  </TableCell>
                  {!readOnly && (
                  <TableCell>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeRegra(r._key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                  )}
                </TableRow>
              ))}
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


function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Configuracoes() {
  const { user } = useAuth();
  const { isAdmin, isCoordinator, role } = usePermission();
  const canEditTaxa = isAdmin;
  const canEditTemplate = isCoordinator;
  const readOnly = !canEditTaxa && !canEditTemplate;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [regraDialogId, setRegraDialogId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const empresas = await listEmpresas();
        const configs = await Promise.all(
          empresas.map((e) => getConfiguracao(e.company_id).catch(() => null))
        );
        if (cancelled) return;
        const merged: Row[] = empresas.map((e: EmpresaSienge, i) => {
          const cfg = configs[i] as ConfiguracaoEmpresa | null;
          return {
            company_id: e.company_id,
            company_name: e.company_name,
            taxaJuros: String(cfg?.taxaJuros ?? 0),
            originalTaxa: Number(cfg?.taxaJuros ?? 0),
            regrasAditivo: cfg?.regrasAditivo ?? [],
            hasTemplate: !!cfg?.templateBase64,
            templateName: cfg?.templateName,
            templateSize: cfg?.templateSize,
            pendingFile: null,
            hasTemplateRegistrado: !!cfg?.templateRegistradoBase64,
            templateRegistradoName: cfg?.templateRegistradoName,
            templateRegistradoSize: cfg?.templateRegistradoSize,
            pendingFileRegistrado: null,
            dirty: false,
            saving: false,
          };
        });
        setRows(merged);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar empresas';
        toast.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.company_id === id ? { ...r, ...patch, dirty: true } : r)));
  }

  function onPickTemplate(id: string, file: File, type: TemplateType = 'normal') {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('O modelo deve ser um arquivo .docx');
      return;
    }
    if (type === 'registrado') {
      updateRow(id, {
        pendingFileRegistrado: file,
        templateRegistradoName: file.name,
        templateRegistradoSize: file.size,
      });
    } else {
      updateRow(id, {
        pendingFile: file,
        templateName: file.name,
        templateSize: file.size,
      });
    }
  }

  async function downloadTemplate(r: Row, type: TemplateType = 'normal') {
    try {
      let blob: Blob | null = null;
      const isReg = type === 'registrado';
      const pending = isReg ? r.pendingFileRegistrado : r.pendingFile;
      const hasStored = isReg ? r.hasTemplateRegistrado : r.hasTemplate;
      const b64Key = isReg ? 'templateRegistradoBase64' : 'templateBase64';
      const nameKey = isReg ? 'templateRegistradoName' : 'templateName';
      const defaultName = isReg
        ? (r.templateRegistradoName ?? `${r.company_name}_registrado.docx`)
        : (r.templateName ?? `${r.company_name}.docx`);

      if (pending) {
        blob = pending;
      } else if (hasStored) {
        const cfg = await getConfiguracao(r.company_id);
        const b64 = cfg?.[b64Key as keyof typeof cfg] as string | undefined;
        if (b64) {
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          blob = new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
        }
      }
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (isReg ? r.templateRegistradoName : r.templateName) ?? defaultName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao baixar modelo';
      toast.error(msg);
    }
  }

  async function saveRow(r: Row) {
    const taxa = Number(r.taxaJuros);
    if (!Number.isFinite(taxa) || taxa < 0 || taxa > 100) {
      toast.error('Taxa de aditivo inválida (0–100)');
      return;
    }
    setRows((prev) => prev.map((x) => (x.company_id === r.company_id ? { ...x, saving: true } : x)));
    try {
      let templateBase64: string | undefined;
      let templateName = r.templateName;
      let templateSize = r.templateSize;

      let templateRegistradoBase64: string | undefined;
      let templateRegistradoName = r.templateRegistradoName;
      let templateRegistradoSize = r.templateRegistradoSize;

      if (r.pendingFile) {
        templateBase64 = await fileToBase64(r.pendingFile);
        templateName = r.pendingFile.name;
        templateSize = r.pendingFile.size;
      }
      if (r.pendingFileRegistrado) {
        templateRegistradoBase64 = await fileToBase64(r.pendingFileRegistrado);
        templateRegistradoName = r.pendingFileRegistrado.name;
        templateRegistradoSize = r.pendingFileRegistrado.size;
      }

      await upsertConfiguracao({
        company_id: r.company_id,
        company_name: r.company_name,
        taxaJuros: taxa,
        regrasAditivo: r.regrasAditivo,
        ...(templateBase64 ? { templateBase64 } : {}),
        templateName,
        templateSize,
        ...(templateRegistradoBase64 ? { templateRegistradoBase64 } : {}),
        templateRegistradoName,
        templateRegistradoSize,
        updatedBy: user?.email ?? null,
      });
      toast.success(`Configuração salva: ${r.company_name}`);
      setRows((prev) =>
        prev.map((x) =>
          x.company_id === r.company_id
            ? {
                ...x,
                saving: false,
                dirty: false,
                originalTaxa: taxa,
                hasTemplate: x.hasTemplate || !!templateBase64,
                templateName,
                templateSize,
                pendingFile: null,
                hasTemplateRegistrado: x.hasTemplateRegistrado || !!templateRegistradoBase64,
                templateRegistradoName,
                templateRegistradoSize,
                pendingFileRegistrado: null,
              }
            : x
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      toast.error(msg);
      setRows((prev) =>
        prev.map((x) => (x.company_id === r.company_id ? { ...x, saving: false } : x))
      );
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Configurações · Aditivo</h1>
              <p className="text-sm text-muted-foreground">
                Taxa de juros e modelo de aditivo por empresa
              </p>
            </div>
          </div>
          <Badge variant="outline" className="capitalize">{role}</Badge>
        </header>

        {readOnly && (
          <div className="mb-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Você tem permissão somente de leitura nesta página.
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empresas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="w-36 text-right">Taxa padrão (% a.m.)</TableHead>
                  <TableHead className="w-32 text-center">Regras taxa</TableHead>
                  <TableHead>Modelo (.docx)</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Carregando empresas…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      Nenhuma empresa encontrada no Sienge.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => {
                  const configured = r.hasTemplate || !!r.pendingFile;
                  return (
                    <TableRow key={r.company_id}>
                      <TableCell className="font-medium align-top">
                        <div>{r.company_name}</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          ID {r.company_id}
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={r.taxaJuros}
                          disabled={!canEditTaxa || r.saving}
                          onChange={(e) =>
                            updateRow(r.company_id, { taxaJuros: e.target.value })
                          }
                          className="h-8 w-24 ml-auto tabular-nums text-right"
                        />
                      </TableCell>
                      <TableCell className="text-center align-top">
                        <Button
                          size="sm" variant="ghost"
                          disabled={readOnly}
                          onClick={() => setRegraDialogId(r.company_id)}
                          className="gap-1"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          {r.regrasAditivo.length > 0
                            ? `${r.regrasAditivo.length} regra${r.regrasAditivo.length > 1 ? 's' : ''}`
                            : canEditTaxa ? 'Configurar' : 'Visualizar'}
                        </Button>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-2">
                          {/* Modelo não registrado */}
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Não registrado</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button" variant="outline" size="sm"
                                disabled={!canEditTemplate || r.saving}
                                onClick={() => document.getElementById(`tpl-${r.company_id}`)?.click()}
                              >
                                <Upload className="h-3.5 w-3.5" />
                                {r.templateName ? 'Trocar' : 'Enviar'}
                              </Button>
                              <input id={`tpl-${r.company_id}`} type="file" accept=".docx" hidden
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickTemplate(r.company_id, f, 'normal'); e.target.value = ''; }}
                              />
                              {r.templateName && (
                                <button type="button" onClick={() => downloadTemplate(r, 'normal')}
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-[180px] truncate" title={r.templateName}>
                                  <Download className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{r.templateName}</span>
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Modelo registrado */}
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Registrado</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button" variant="outline" size="sm"
                                disabled={!canEditTemplate || r.saving}
                                onClick={() => document.getElementById(`tpl-reg-${r.company_id}`)?.click()}
                              >
                                <Upload className="h-3.5 w-3.5" />
                                {r.templateRegistradoName ? 'Trocar' : 'Enviar'}
                              </Button>
                              <input id={`tpl-reg-${r.company_id}`} type="file" accept=".docx" hidden
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickTemplate(r.company_id, f, 'registrado'); e.target.value = ''; }}
                              />
                              {r.templateRegistradoName && (
                                <button type="button" onClick={() => downloadTemplate(r, 'registrado')}
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-[180px] truncate" title={r.templateRegistradoName}>
                                  <Download className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{r.templateRegistradoName}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {configured ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Configurado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1">
                            <AlertCircle className="h-3 w-3" /> Sem modelo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button
                          size="sm"
                          disabled={!r.dirty || r.saving || readOnly}
                          onClick={() => saveRow(r)}
                        >
                          {r.saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Salvar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Modelo: arquivo .docx (envie já comprimido). Taxa de juros e regras: somente Admin. Modelo: Admin e Coordenador.
        </p>
      </div>

      {regraDialogId && (() => {
        const row = rows.find((r) => r.company_id === regraDialogId);
        return row ? (
          <RegraAditivoDialog
            nomeEmpresa={row.company_name}
            companyId={row.company_id}
            regrasIniciais={row.regrasAditivo}
            open={!!regraDialogId}
            readOnly={!canEditTaxa}
            onClose={() => setRegraDialogId(null)}
            onSaved={(regras) => {
              setRows((prev) =>
                prev.map((r) =>
                  r.company_id === row.company_id ? { ...r, regrasAditivo: regras } : r
                )
              );
              setRegraDialogId(null);
            }}
          />
        ) : null;
      })()}
    </div>
  );
}
