import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ArrowLeft, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { calculatePMT, generateNovasParcelas } from '@/lib/financial';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import type { Parcela, NovaParcela } from '@/types/contract';
import { toast } from 'sonner';

interface Step3Props {
  selectedParcelas: Parcela[];
  taxaJuros: number;
  custosAdicionais: number;
  numParcelas: number;
  startDate: Date | null;
  onNumParcelas: (n: number) => void;
  onStartDate: (d: Date) => void;
  onSimulationResult: (parcelas: NovaParcela[], pv: number, pmt: number, totalJuros: number, totalRenegociado: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3({
  selectedParcelas, taxaJuros, custosAdicionais, numParcelas, startDate,
  onNumParcelas, onStartDate, onSimulationResult, onNext, onBack
}: Step3Props) {

  const pvTotal = useMemo(
    () => selectedParcelas.reduce((s, p) => s + p.saldoAtual, 0) + custosAdicionais,
    [selectedParcelas, custosAdicionais]
  );

  const pmt = useMemo(
    () => calculatePMT(pvTotal, taxaJuros, numParcelas),
    [pvTotal, taxaJuros, numParcelas]
  );

  const novasParcelas = useMemo(() => {
    if (!startDate || numParcelas <= 0) return [];
    return generateNovasParcelas(pmt, numParcelas, startDate);
  }, [pmt, numParcelas, startDate]);

  const totalRenegociado = pmt * numParcelas;
  const totalJuros = totalRenegociado - pvTotal;

  const handleNext = () => {
    if (numParcelas <= 0) {
      toast.error('Informe o número de parcelas');
      return;
    }
    if (!startDate) {
      toast.error('Selecione a data do primeiro vencimento');
      return;
    }
    onSimulationResult(novasParcelas, pvTotal, pmt, totalJuros, totalRenegociado);
    onNext();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label htmlFor="numParcelas">Nº de novas parcelas</Label>
              <Input
                id="numParcelas"
                type="number"
                min="1"
                max="600"
                value={numParcelas || ''}
                onChange={(e) => onNumParcelas(Math.min(600, Math.max(0, parseInt(e.target.value) || 0)))}
                className="tabular-nums"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label>Data do 1º vencimento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate || undefined}
                    onSelect={(d) => d && onStartDate(d)}
                    initialFocus
                    className={cn('p-3 pointer-events-auto')}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">PV (saldo + custos)</span>
              <span className="font-semibold tabular-nums">{formatCurrency(pvTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Taxa</span>
              <span className="font-semibold tabular-nums">{formatPercent(taxaJuros)} a.m.</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor da parcela</span>
              <span className="font-bold tabular-nums text-primary">{formatCurrency(pmt)}</span>
            </div>
            <div className="border-t pt-1 mt-1 flex justify-between">
              <span className="text-muted-foreground">Total de juros</span>
              <span className="tabular-nums">{formatCurrency(totalJuros > 0 ? totalJuros : 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total renegociado</span>
              <span className="font-bold tabular-nums">{formatCurrency(totalRenegociado > 0 ? totalRenegociado : 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {novasParcelas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quadro 2 — Novo Plano de Parcelas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[350px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-20">Nº Parc.</TableHead>
                    <TableHead>Data Vencimento</TableHead>
                    <TableHead className="text-right">Valor da Nova Parcela</TableHead>
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
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button onClick={handleNext}>
          Próximo <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
