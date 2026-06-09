import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Download, FileText, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { generateDocx, downloadDocx, generateAndDownloadPdf } from '@/lib/documentGenerator';
import { buildPlaceholders } from '@/lib/placeholders';
import { salvarAditivo } from '@/lib/aditivoHistorico';
import { useAuth } from '@/contexts/AuthContext';
import type { Parcela, NovaParcela } from '@/types/contract';
import type { DadosContratoForm } from '@/types/dadosContrato';
import type { ClienteSienge, ContratoSienge } from '@/lib/sienge';
import { toast } from 'sonner';

interface Step4Props {
  templateFile: File | null;
  allParcelas: Parcela[];
  selectedParcelas: Parcela[];
  selectedIds: Set<number>;
  novasParcelas: NovaParcela[];
  taxaJuros: number;
  custosAdicionais: number;
  pvTotal: number;
  totalJuros: number;
  valorTotalRenegociado: number;
  pmtValue: number;
  dadosForm: DadosContratoForm;
  selectedCliente: ClienteSienge | null;
  selectedContrato: ContratoSienge | null;
  dataRenegociacao: Date | null;
  isRegistrado: boolean;
  onBack: () => void;
}

export function Step4({
  templateFile, allParcelas, selectedParcelas, selectedIds, novasParcelas,
  taxaJuros, custosAdicionais, pvTotal, totalJuros, valorTotalRenegociado, pmtValue,
  dadosForm, selectedCliente, selectedContrato, dataRenegociacao, isRegistrado, onBack
}: Step4Props) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Quadro 1: todas as parcelas com saldo > 0 (incluindo as selecionadas para renegociacao)
  const quadro1 = allParcelas.filter(p => selectedIds.has(p.rowIndex) || p.saldoAtual > 0);

  const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'documento';
  const fileName = `Aditivo_${sanitize(dadosForm.numero_contrato || 'contrato')}_${sanitize(selectedCliente?.client_name ?? dadosForm.comprador.nome ?? '')}.docx`;

  const handleGenerateDocx = async () => {
    if (!templateFile) {
      toast.error('Nenhum modelo .docx foi fornecido.');
      return;
    }
    setGenerating(true);
    try {
      const placeholders = buildPlaceholders(dadosForm, { dataRenegociacao });
      const blob = await generateDocx(templateFile, quadro1, novasParcelas, taxaJuros, custosAdicionais, valorTotalRenegociado, placeholders);
      downloadDocx(blob, fileName);
      toast.success('Documento .docx gerado com sucesso!');
    } catch (err: any) {
      toast.error(`Erro ao gerar .docx: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleGeneratePdf = async () => {
    setGenerating(true);
    try {
      await generateAndDownloadPdf(quadro1, novasParcelas, taxaJuros, custosAdicionais, valorTotalRenegociado, pvTotal, 'aditivo_contratual.pdf');
      toast.success('PDF gerado com sucesso!');
    } catch (err: any) {
      toast.error(`Erro ao gerar PDF: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSalvar = async () => {
    if (!selectedContrato || !selectedCliente) {
      toast.error('Contrato ou cliente nao selecionado.');
      return;
    }
    setSaving(true);
    try {
      const sortedQ1 = [...quadro1].sort((a, b) => a.numero - b.numero);
      const sortedQ2 = [...novasParcelas].sort((a, b) => a.numero - b.numero);

      await salvarAditivo({
        criadoPor: user?.email ?? 'desconhecido',
        criadoPorNome: user?.displayName ?? user?.email ?? 'desconhecido',
        billId: String(selectedContrato.bill_id),
        clienteId: String(selectedCliente.client_id),
        clienteNome: selectedCliente.client_name,
        contratoNumero: selectedContrato.bill_document ?? String(selectedContrato.bill_id),
        empreendimento: selectedContrato.business_area_name ?? dadosForm.empreendimento ?? '',
        empresa: selectedContrato.company_name ?? '',
        isRegistrado,
        taxaJuros,
        custosAdicionais,
        correcaoMonetaria: dadosForm.correcao_monetaria ?? '',
        dataRenegociacao: dataRenegociacao ? dataRenegociacao.toISOString().split('T')[0] : '',
        totalQuadro1: sortedQ1.reduce((s, p) => s + p.valorOriginal, 0),
        totalQuadro2: sortedQ2.reduce((s, p) => s + p.valor, 0),
        valorTotalRenegociado,
        pvTotal,
        totalJuros,
        parcelasQuadro1: sortedQ1.map((p) => ({
          numero: p.numero,
          dataVencimento: p.dataVencimento.toISOString().split('T')[0],
          valorOriginal: p.valorOriginal,
        })),
        parcelasQuadro2: sortedQ2.map((p) => ({
          numero: p.numero,
          dataVencimento: p.dataVencimento.toISOString().split('T')[0],
          valor: p.valor,
          tipo: p.tipo,
        })),
        dadosForm,
        status: 'simulado',
      });
      toast.success('Simulacao salva no historico!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Financial Summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Resumo Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Taxa de Juros</p>
              <p className="font-semibold tabular-nums">{formatPercent(taxaJuros)} a.m.</p>
            </div>
            <div>
              <p className="text-muted-foreground">Custos Adicionais</p>
              <p className="font-semibold tabular-nums">{formatCurrency(custosAdicionais)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Valor Presente (PV)</p>
              <p className="font-semibold tabular-nums">{formatCurrency(pvTotal)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Renegociado</p>
              <p className="font-bold tabular-nums text-primary">{formatCurrency(valorTotalRenegociado)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-side tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quadro 1 — Todas as Parcelas a Vencer</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-16">N</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor Original</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...quadro1].sort((a, b) => a.numero - b.numero).map((p) => (
                    <TableRow key={p.rowIndex}>
                      <TableCell className="tabular-nums font-medium">{String(p.numero).padStart(2, '0')}</TableCell>
                      <TableCell className="tabular-nums">{format(p.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.valorOriginal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quadro 2 — Novo Plano</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-16">N</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-20">Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...novasParcelas].sort((a, b) => a.numero - b.numero).map((p) => (
                    <TableRow key={`${p.tipo}-${p.numero}`} className={p.tipo === 'reforco' ? 'bg-accent/30' : p.tipo === 'mantida' ? 'bg-muted/30' : ''}>
                      <TableCell className="tabular-nums font-medium">{String(p.numero).padStart(2, '0')}</TableCell>
                      <TableCell className="tabular-nums">{format(p.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.valor)}</TableCell>
                      <TableCell>
                        {p.tipo === 'reforco' && <Badge variant="secondary" className="text-xs">Ref.</Badge>}
                        {p.tipo === 'mantida' && <Badge variant="outline" className="text-xs">Mant.</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={generating || saving}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex gap-2">
          <Button onClick={handleSalvar} disabled={saving || generating} variant="secondary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar simulacao
          </Button>
          {templateFile && (
            <Button onClick={handleGenerateDocx} disabled={generating || saving} variant="outline">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Baixar .docx
            </Button>
          )}
          <Button onClick={handleGeneratePdf} disabled={generating || saving}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
