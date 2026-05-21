import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, Loader2, Save, Upload, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from '@/lib/configuracoes';

interface Row {
  company_id: string;
  company_name: string;
  taxaJuros: string;
  originalTaxa: number;
  taxaJurosQuitacao: string;
  originalTaxaQuitacao: number;
  hasTemplate: boolean; // só indica presença; o base64 não fica no state
  templateName?: string;
  templateSize?: number;
  pendingFile?: File | null;
  dirty: boolean;
  saving: boolean;
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
            taxaJurosQuitacao: String(cfg?.taxaJurosQuitacao ?? 0),
            originalTaxaQuitacao: Number(cfg?.taxaJurosQuitacao ?? 0),
            hasTemplate: !!cfg?.templateBase64,
            templateName: cfg?.templateName,
            templateSize: cfg?.templateSize,
            pendingFile: null,
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

  function onPickTemplate(id: string, file: File) {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('O modelo deve ser um arquivo .docx');
      return;
    }
    updateRow(id, {
      pendingFile: file,
      templateName: file.name,
      templateSize: file.size,
    });
  }

  async function downloadTemplate(r: Row) {
    try {
      let blob: Blob | null = null;
      if (r.pendingFile) {
        blob = r.pendingFile;
      } else if (r.hasTemplate) {
        const cfg = await getConfiguracao(r.company_id);
        if (cfg?.templateBase64) {
          const binary = atob(cfg.templateBase64);
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
      a.download = r.templateName ?? `${r.company_name}.docx`;
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
    const taxaQ = Number(r.taxaJurosQuitacao);
    if (!Number.isFinite(taxaQ) || taxaQ < 0 || taxaQ > 100) {
      toast.error('Taxa de quitação inválida (0–100)');
      return;
    }
    setRows((prev) => prev.map((x) => (x.company_id === r.company_id ? { ...x, saving: true } : x)));
    try {
      let templateBase64: string | undefined;
      let templateName = r.templateName;
      let templateSize = r.templateSize;

      if (r.pendingFile) {
        templateBase64 = await fileToBase64(r.pendingFile);
        templateName = r.pendingFile.name;
        templateSize = r.pendingFile.size;
      }

      await upsertConfiguracao({
        company_id: r.company_id,
        company_name: r.company_name,
        taxaJuros: taxa,
        taxaJurosQuitacao: taxaQ,
        // só envia templateBase64 se houver novo arquivo; senão mantém o atual via merge
        ...(templateBase64 ? { templateBase64 } : {}),
        templateName,
        templateSize,
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
                originalTaxaQuitacao: taxaQ,
                hasTemplate: x.hasTemplate || !!templateBase64,
                templateName,
                templateSize,
                pendingFile: null,
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
              <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
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
                  <TableHead className="w-36 text-right">Taxa (% a.m.)</TableHead>
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
                          className="h-8 w-28 ml-auto tabular-nums text-right"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!canEditTemplate || r.saving}
                            onClick={() =>
                              document.getElementById(`tpl-${r.company_id}`)?.click()
                            }
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {r.templateName ? 'Trocar' : 'Enviar'}
                          </Button>
                          <input
                            id={`tpl-${r.company_id}`}
                            type="file"
                            accept=".docx"
                            hidden
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) onPickTemplate(r.company_id, f);
                              e.target.value = '';
                            }}
                          />
                          {r.templateName && (
                            <button
                              type="button"
                              onClick={() => downloadTemplate(r)}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-[200px] truncate"
                              title={r.templateName}
                            >
                              <Download className="h-3 w-3 shrink-0" />
                              <span className="truncate">{r.templateName}</span>
                            </button>
                          )}
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
          Modelo: arquivo .docx (envie já comprimido). Taxa de juros: somente Admin. Modelo: Admin e Coordenador.
        </p>
      </div>
    </div>
  );
}
