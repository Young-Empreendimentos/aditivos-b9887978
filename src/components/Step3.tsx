import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { calculatePMT, generateNovasParcelas, calcularTotalPVReforcos, capitalizarParcelaParaDataBase } from '@/lib/financial';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import type { Parcela, NovaParcela, Reforco } from '@/types/contract';
import { toast } from 'sonner';

interface Step3Props {
  parcelas: Parcela[];
  selectedParcelas: Parcela[];
  selectedIds: Set<number>;
  taxaJuros: number;
  custosAdicionais: number;
  dataRenegociacao: Date;
  numParcelas: number;
  startDate: Date | null;
  reforcos: Reforco[];
  onNumParcelas: (n: number) => void;
  onStartDate: (d: Date) => void;
  onReforcos: (r: Reforco[]) => void;
  onSimulationResult: (parcelas: NovaParcela[], pv: number, pmt: number, totalJuros: number, totalRenegociado: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step3({
  parcelas, selectedParcelas, selectedIds, taxaJuros, custosAdicionais, dataRenegociacao, numParcelas, startDate, reforcos,
  onNumParcelas, onStartDate, onReforcos, onSimulationResult, onNext, onBack
}: Step3Props) {

  const [reforcoData, setReforcoData] = useState<Date | null>(null);
  const [reforcoValor, setReforcoValor] = useState('');

  // Parcelas não selecionadas (mantidas) — excluindo entrada
  const parcelasMantidas = useMemo(
    () => parcelas.filter(p => !p.isEntrada && !selectedIds.has(p.rowIndex)),
    [parcelas, selectedIds]
  );

  // PV bruto = soma dos saldos capitalizados até a data da renegociação + custos
  const pvBruto = useMemo(
    () => selectedParcelas.reduce((s, p) => 
      s + capitalizarParcelaParaDataBase(p.saldoAtual, p.dataVencimento, dataRenegociacao, taxaJuros), 0
    ) + custosAdicionais,
    [selectedParcelas, custosAdicionais, dataRenegociacao, taxaJuros]
  );

  // VP dos reforços descontados até a data da renegociação
  const totalPVReforcos = useMemo(
    () => calcularTotalPVReforcos(reforcos, dataRenegociacao, taxaJuros),
    [reforcos, dataRenegociacao, taxaJuros]
  );

  const pvTotal = Math.max(0, pvBruto - totalPVReforcos);

  const pmt = useMemo(
    () => calculatePMT(pvTotal, taxaJuros, numParcelas),
    [pvTotal, taxaJuros, numParcelas]
  );

  // Gerar novas parcelas PMT
  const novasParcelasPMT = useMemo(() => {
    if (!startDate || numParcelas <= 0) return [];
    return generateNovasParcelas(pmt, numParcelas, startDate);
  }, [pmt, numParcelas, startDate]);

  // Quadro 2 completo: mantidas + reforços + novas, ordenadas por data e renumeradas
  const quadro2Completo = useMemo(() => {
    const items: NovaParcela[] = [];

    // Parcelas mantidas (não renegociadas)
    parcelasMantidas.forEach(p => {
      items.push({
        numero: 0,
        dataVencimento: p.dataVencimento,
        valor: p.saldoAtual,
        tipo: 'mantida',
      });
    });

    // Reforços
    reforcos.forEach(r => {
      items.push({
        numero: 0,
        dataVencimento: r.data,
        valor: r.valor,
        tipo: 'reforco',
      });
    });

    // Novas parcelas PMT
    novasParcelasPMT.forEach(p => {
      items.push({ ...p, tipo: 'nova' });
    });

    // Ordenar por data
    items.sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime());

    // Agrupar parcelas na mesma data em uma única parcela
    const merged: NovaParcela[] = [];
    for (const item of items) {
      const dateKey = item.dataVencimento.getTime();
      const existing = merged.find(m => m.dataVencimento.getTime() === dateKey);
      if (existing) {
        existing.valor += item.valor;
        // Se qualquer uma for 'nova', marca como 'nova'
        if (item.tipo === 'nova' || existing.tipo === 'nova') existing.tipo = 'nova';
      } else {
        merged.push({ ...item });
      }
    }

    // Renumerar
    merged.forEach((item, idx) => { item.numero = idx + 1; });

    return merged;
  }, [parcelasMantidas, reforcos, novasParcelasPMT]);

  const totalRenegociado = quadro2Completo.reduce((s, p) => s + p.valor, 0);
  const totalJuros = totalRenegociado - pvBruto;

  const addReforco = () => {
    if (!reforcoData) { toast.error('Selecione a data do reforço'); return; }
    const val = parseFloat(reforcoValor.replace(/\./g, '').replace(',', '.'));
    if (!val || val <= 0) { toast.error('Informe um valor válido para o reforço'); return; }
    onReforcos([...reforcos, { id: crypto.randomUUID(), data: reforcoData, valor: val }]);
    setReforcoData(null);
    setReforcoValor('');
  };

  const removeReforco = (id: string) => {
    onReforcos(reforcos.filter(r => r.id !== id));
  };

  const handleNext = () => {
    if (numParcelas <= 0) { toast.error('Informe o número de parcelas'); return; }
    if (!startDate) { toast.error('Selecione a data do primeiro vencimento'); return; }
    onSimulationResult(quadro2Completo, pvTotal, pmt, totalJuros, totalRenegociado);
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
              <span className="text-muted-foreground">PV bruto</span>
              <span className="font-semibold tabular-nums">{formatCurrency(pvBruto)}</span>
            </div>
            {reforcos.length > 0 && (
              <div className="flex justify-between text-destructive">
                <span>(-) Reforços (VP)</span>
                <span className="tabular-nums">{formatCurrency(totalPVReforcos)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">PV financiado</span>
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

      {/* Reforços */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Reforços (pagamentos avulsos)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label>Data do reforço</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn('w-[160px] justify-start text-left font-normal', !reforcoData && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reforcoData ? format(reforcoData, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={reforcoData || undefined}
                    onSelect={(d) => d && setReforcoData(d)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={reforcoValor}
                onChange={(e) => setReforcoValor(e.target.value)}
                className="w-[140px] tabular-nums"
              />
            </div>
            <Button size="sm" onClick={addReforco}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </div>

          {reforcos.length > 0 && (
            <div className="space-y-2">
              {reforcos.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2 text-sm">
                  <div className="flex items-center gap-4">
                    <span className="tabular-nums">{format(r.data, 'dd/MM/yyyy', { locale: ptBR })}</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(r.valor)}</span>
                    {(() => {
                      const dias = Math.max(0, Math.round((r.data.getTime() - dataRenegociacao.getTime()) / 86400000));
                      const iMensal = taxaJuros / 100;
                      const iDiaria = Math.pow(1 + iMensal, 1 / 30) - 1;
                      const vp = (iMensal === 0 || dias === 0) ? r.valor : r.valor / Math.pow(1 + iDiaria, dias);
                      return (
                        <span className="text-muted-foreground text-xs">
                          VP: {formatCurrency(vp)} ({dias}d)
                        </span>
                      );
                    })()}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeReforco(r.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {quadro2Completo.length > 0 && (
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
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-24">Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quadro2Completo.map((p) => (
                    <TableRow key={`${p.tipo}-${p.numero}`} className={p.tipo === 'reforco' ? 'bg-accent/30' : p.tipo === 'mantida' ? 'bg-muted/30' : ''}>
                      <TableCell className="tabular-nums font-medium">{String(p.numero).padStart(2, '0')}</TableCell>
                      <TableCell className="tabular-nums">{format(p.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.valor)}</TableCell>
                      <TableCell>
                        {p.tipo === 'reforco' && <Badge variant="secondary">Reforço</Badge>}
                        {p.tipo === 'mantida' && <Badge variant="outline">Mantida</Badge>}
                        {p.tipo === 'nova' && <Badge>Nova</Badge>}
                      </TableCell>
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
