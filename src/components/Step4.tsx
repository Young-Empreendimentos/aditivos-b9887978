import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { generateDocx, downloadDocx, generateAndDownloadPdf } from '@/lib/documentGenerator';
import type { Parcela, NovaParcela } from '@/types/contract';
import { toast } from 'sonner';

interface Step4Props {
  templateFile: File | null;
  selectedParcelas: Parcela[];
  novasParcelas: NovaParcela[];
  taxaJuros: number;
  custosAdicionais: number;
  pvTotal: number;
  totalJuros: number;
  valorTotalRenegociado: number;
  pmtValue: number;
  onBack: () => void;
}

export function Step4({
  templateFile, selectedParcelas, novasParcelas,
  taxaJuros, custosAdicionais, pvTotal, totalJuros, valorTotalRenegociado, pmtValue, onBack
}: Step4Props) {
  const [generating, setGenerating] = useState(false);

  const handleGenerateDocx = async () => {
    if (!templateFile) {
      toast.error('Nenhum modelo .docx foi fornecido. O documento não pode ser gerado sem um template.');
      return;
    }
    setGenerating(true);
    try {
      const blob = await generateDocx(templateFile, selectedParcelas, novasParcelas, taxaJuros, custosAdicionais, valorTotalRenegociado);
      downloadDocx(blob, 'aditivo_contratual.docx');
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
      await generateAndDownloadPdf(selectedParcelas, novasParcelas, taxaJuros, custosAdicionais, valorTotalRenegociado, pvTotal, 'aditivo_contratual.pdf');
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
            <CardTitle className="text-base">Quadro 1 — Parcelas Originais</CardTitle>
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
                  {selectedParcelas.map((p) => (
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
                    <TableHead className="text-right">Nova Parcela</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {novasParcelas.map((p) => (
                    <TableRow key={p.numero}>
                      <TableCell className="tabular-nums font-medium">{String(p.numero).padStart(2, '0')}</TableCell>
                      <TableCell className="tabular-nums">{format(p.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.valor)}</TableCell>
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
