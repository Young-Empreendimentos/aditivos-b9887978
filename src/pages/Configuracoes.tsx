import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { ArrowLeft, Download, Pencil, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import {
  Empreendimento,
  base64ToBlob,
  deleteEmpreendimento,
  fileToBase64,
  listEmpreendimentos,
  upsertEmpreendimento,
} from '@/lib/empreendimentos';

const MAX_TEMPLATE_BYTES = 900_000; // ~900KB to stay within 1MB Firestore doc limit
const empSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(80, 'Máx. 80 caracteres'),
  taxaJuros: z.number().min(0, 'Mín. 0').max(100, 'Máx. 100'),
});

interface DraftState {
  id?: string;
  nome: string;
  taxaJuros: string;
  templateFile?: File | null;
  templateName?: string;
  templateBase64?: string;
  templateSize?: number;
}

const emptyDraft: DraftState = { nome: '', taxaJuros: '' };

export default function Configuracoes() {
  const { user } = useAuth();
  const { isAdmin, isCoordinator, role } = usePermission();
  const canEditTaxa = isAdmin;
  const canEditTemplate = isCoordinator; // includes admin
  const canDelete = isAdmin;

  const [items, setItems] = useState<Empreendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Empreendimento | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setItems(await listEmpreendimentos());
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao carregar empreendimentos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function startNew() {
    if (!canEditTaxa && !canEditTemplate) return;
    setDraft({ ...emptyDraft });
  }

  function startEdit(e: Empreendimento) {
    setDraft({
      id: e.id,
      nome: e.nome,
      taxaJuros: String(e.taxaJuros ?? 0),
      templateName: e.templateName,
      templateBase64: e.templateBase64,
      templateSize: e.templateSize,
    });
  }

  function cancelDraft() {
    setDraft(null);
  }

  async function onPickTemplate(file: File) {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('O modelo deve ser um arquivo .docx');
      return;
    }
    if (file.size > MAX_TEMPLATE_BYTES) {
      toast.error('Arquivo muito grande. Limite atual: 900 KB.');
      return;
    }
    try {
      const b64 = await fileToBase64(file);
      setDraft((d) =>
        d
          ? { ...d, templateFile: file, templateName: file.name, templateBase64: b64, templateSize: file.size }
          : d
      );
    } catch {
      toast.error('Falha ao ler o arquivo');
    }
  }

  function downloadTemplate(e: Empreendimento) {
    if (!e.templateBase64) return;
    const blob = base64ToBlob(e.templateBase64);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = e.templateName ?? `${e.nome}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveDraft() {
    if (!draft) return;
    const parsed = empSchema.safeParse({
      nome: draft.nome,
      taxaJuros: Number(draft.taxaJuros),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      await upsertEmpreendimento(
        {
          id: draft.id,
          nome: parsed.data.nome,
          taxaJuros: parsed.data.taxaJuros,
          templateBase64: draft.templateBase64,
          templateName: draft.templateName,
          templateSize: draft.templateSize,
        },
        user?.email ?? null
      );
      toast.success('Empreendimento salvo');
      setDraft(null);
      await reload();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      await deleteEmpreendimento(confirmDelete.id);
      toast.success('Empreendimento removido');
      setConfirmDelete(null);
      await reload();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao remover');
    }
  }

  const readOnly = !canEditTaxa && !canEditTemplate;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
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
                Taxas de juros e modelos de aditivo por empreendimento
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Empreendimentos</CardTitle>
            {(canEditTaxa || canEditTemplate) && !draft && (
              <Button size="sm" onClick={startNew}>
                <Plus className="h-4 w-4" /> Novo
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-32 text-right">Taxa (% a.m.)</TableHead>
                  <TableHead>Modelo (.docx)</TableHead>
                  <TableHead className="w-40 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      Carregando…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && items.length === 0 && !draft && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      Nenhum empreendimento cadastrado.
                    </TableCell>
                  </TableRow>
                )}
                {items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(e.taxaJuros).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {e.templateName ? (
                        <button
                          type="button"
                          onClick={() => downloadTemplate(e)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Download className="h-3 w-3" />
                          {e.templateName}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        {(canEditTaxa || canEditTemplate) && (
                          <Button variant="ghost" size="sm" onClick={() => startEdit(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDelete(e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {draft && (
          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {draft.id ? 'Editar empreendimento' : 'Novo empreendimento'}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={cancelDraft}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nome">Nome do empreendimento</Label>
                <Input
                  id="nome"
                  maxLength={80}
                  value={draft.nome}
                  onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
                  disabled={!canEditTaxa && !canEditTemplate}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxa">Taxa de juros (% a.m.)</Label>
                <Input
                  id="taxa"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={draft.taxaJuros}
                  onChange={(e) => setDraft({ ...draft, taxaJuros: e.target.value })}
                  disabled={!canEditTaxa}
                  className="tabular-nums"
                />
                {!canEditTaxa && (
                  <p className="text-[11px] text-muted-foreground">Somente Admin pode alterar a taxa.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Modelo de aditivo (.docx)</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canEditTemplate}
                    onClick={() => document.getElementById('tpl-input')?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {draft.templateName ? 'Trocar arquivo' : 'Enviar arquivo'}
                  </Button>
                  <input
                    id="tpl-input"
                    type="file"
                    accept=".docx"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onPickTemplate(f);
                      e.target.value = '';
                    }}
                  />
                  {draft.templateName && (
                    <span className="text-xs text-muted-foreground truncate">
                      {draft.templateName}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Limite 900 KB. Apenas Admin e Coordenador podem alterar.
                </p>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={cancelDraft} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={saveDraft} disabled={saving || readOnly}>
                  <Save className="h-4 w-4" /> Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empreendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. O modelo de aditivo também será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
