import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
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
  taxaJurosQuitacao: string;
  // mantemos referência aos demais campos para não sobrescrever no merge
  taxaJuros: number;
  dirty: boolean;
  saving: boolean;
}

export default function ConfiguracoesQuitacao() {
  const { user } = useAuth();
  const { isAdmin, role } = usePermission();
  const canEdit = isAdmin;
  const readOnly = !canEdit;

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
            taxaJurosQuitacao: String(cfg?.taxaJurosQuitacao ?? 0),
            taxaJuros: Number(cfg?.taxaJuros ?? 0),
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

  async function saveRow(r: Row) {
    const taxaQ = Number(r.taxaJurosQuitacao);
    if (!Number.isFinite(taxaQ) || taxaQ < 0 || taxaQ > 100) {
      toast.error('Taxa de quitação inválida (0–100)');
      return;
    }
    setRows((prev) => prev.map((x) => (x.company_id === r.company_id ? { ...x, saving: true } : x)));
    try {
      await upsertConfiguracao({
        company_id: r.company_id,
        company_name: r.company_name,
        taxaJuros: r.taxaJuros, // preserva taxa de aditivo existente
        taxaJurosQuitacao: taxaQ,
        updatedBy: user?.email ?? null,
      });
      toast.success(`Configuração salva: ${r.company_name}`);
      setRows((prev) =>
        prev.map((x) =>
          x.company_id === r.company_id ? { ...x, saving: false, dirty: false } : x
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
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Configurações · Quitação</h1>
              <p className="text-sm text-muted-foreground">
                Taxa de juros e regras de desconto para quitação por empresa
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
                  <TableHead className="w-40 text-right">Taxa Quitação (% a.m.)</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                      <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Carregando empresas…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                      Nenhuma empresa encontrada no Sienge.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
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
                        value={r.taxaJurosQuitacao}
                        disabled={!canEdit || r.saving}
                        onChange={(e) =>
                          updateRow(r.company_id, { taxaJurosQuitacao: e.target.value })
                        }
                        className="h-8 w-28 ml-auto tabular-nums text-right"
                      />
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
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Taxa de juros de quitação: somente Admin. Regras adicionais de desconto serão adicionadas aqui.
        </p>
      </div>
    </div>
  );
}
