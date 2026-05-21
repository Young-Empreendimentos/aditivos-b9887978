import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { generateDocx, downloadDocx, generateAndDownloadPdf } from '@/lib/documentGenerator';
import { buildPlaceholders } from '@/lib/placeholders';
import type { Parcela, NovaParcela } from '@/types/contract';
import type { DadosContratoForm } from '@/types/dadosContrato';
import type { ClienteSienge } from '@/lib/sienge';
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
  dataRenegociacao: Date | null;
  onBack: () => void;
}

export function Step4({
  templateFile, allParcelas, selectedParcelas, selectedIds, novasParcelas,
  taxaJuros, custosAdicionais, pvTotal, totalJuros, valorTotalRenegociado, pmtValue,
  dadosForm, selectedCliente, dataRenegociacao, onBack
}: Step4Props) {
  const [generating, setGenerating] = useState(false);

  // Quadro 1: todas as parcelas com saldo > 0 (incluindo as selecionadas para renegociação)
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
                    <TableHead className="w-16">Nº</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor Original</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quadro1.map((p) => (
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
                    <TableHead className="w-16">Nº</TableHead>
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
        <Button variant="outline" onClick={onBack} disabled={generating}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex gap-2">
          {templateFile && (
            <Button onClick={handleGenerateDocx} disabled={generating} variant="outline">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Baixar .docx
            </Button>
          )}
          <Button onClick={handleGeneratePdf} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
