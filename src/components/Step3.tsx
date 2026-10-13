import { useEffect, useMemo, useState } from 'react';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, ArrowRight, ArrowDown, Plus, Trash2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/DateInput';
import { calculatePMT, generateNovasParcelas, calcularTotalPVReforcos, capitalizarParcelaParaDataBase } from '@/lib/financial';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import type { Parcela, NovaParcela, Reforco } from '@/types/contract';
import { toast } from 'sonner';

type Periodicidade = 'anual' | 'semestral' | 'trimestral';

const MESES_POR_PERIODO: Record<Periodicidade, number> = {
  anual: 12,
  semestral: 6,
  trimestral: 3,
};

/** Converte texto de valor para número, aceitando vírgula OU ponto decimal.
 *  "1.500,00" → 1500  |  "1500,50" → 1500.5  |  "1500.50" → 1500.5  |  "1.500" → 1500 */
function parseValor(s: string): number {
  const t = (s ?? '').trim();
  if (!t) return 0;
  // Formato BR: vírgula = decimal, ponto = milhar
  if (t.includes(',')) return parseFloat(t.replace(/\./g, '').replace(',', '.')) || 0;
  // Sem vírgula: ponto separando milhar (grupos de 3) → remove os pontos
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return parseFloat(t.replace(/\./g, '')) || 0;
  // Senão o ponto é decimal (ex.: 1500.50) ou não há ponto
  return parseFloat(t) || 0;
}

/** Número → "1.500,00" para edição em input */
function formatValorInput(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

  // Reforço manual
  const [reforcoData, setReforcoData] = useState<Date | null>(null);
  const [reforcoValor, setReforcoValor] = useState('');

  // Reforço automático
  const [autoPeriod, setAutoPeriod] = useState<Periodicidade>('anual');
  const [autoValor, setAutoValor] = useState('');
  const [autoQtd, setAutoQtd] = useState('');
  const [autoStart, setAutoStart] = useState<Date | null>(null);

  const [manualNumeros, setManualNumeros] = useState<number[] | null>(null);

  // Parcelas não selecionadas (mantidas)
  const parcelasMantidas = useMemo(
    () => parcelas.filter(p => !selectedIds.has(p.rowIndex)),
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

    // Parcelas mantidas (não renegociadas e não pagas)
    parcelasMantidas.filter(p => p.saldoAtual > 0).forEach(p => {
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

    // Ordenar por número da parcela
    items.sort((a, b) => a.numero - b.numero);

    // Agrupar parcelas na mesma data em uma única parcela
    // (o cliente paga UM boleto por vencimento = a soma do que cai no dia)
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

    // Ordenar o quadro final por data (cronológico)
    merged.sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime());

    // Numeração: segue o número REAL da parcela (como no Quadro 1), consecutivo.
    // Começa no número da 1ª parcela a vencer do contrato (ex.: 27, 28, 29…) e NÃO
    // recomeça do 1. Como junta o mesmo vencimento, sai com menos linhas (= menos parcelas).
    const aVencer = parcelas.filter(p => p.saldoAtual > 0 && !p.isEntrada);
    const baseNumero = aVencer.length > 0
      ? Math.min(...aVencer.map(p => (p.numero > 0 ? p.numero : Number.POSITIVE_INFINITY)))
      : 1;
    const inicio = Number.isFinite(baseNumero) ? baseNumero : 1;

    if (manualNumeros && manualNumeros.length === merged.length) {
      merged.forEach((item, idx) => { item.numero = manualNumeros[idx]; });
    } else {
      merged.forEach((item, idx) => { item.numero = inicio + idx; });
    }

    return merged;
  }, [parcelas, parcelasMantidas, reforcos, novasParcelasPMT, manualNumeros]);

  const totalRenegociado = quadro2Completo.reduce((s, p) => s + p.valor, 0);
  // Juros = só o que o refinanciamento (parcelas PMT) adiciona sobre o valor financiado.
  // Parcelas "mantidas" e reforços NÃO geram juros novos (antes entravam aqui e inflavam o total).
  const totalPMT = novasParcelasPMT.reduce((s, p) => s + p.valor, 0);
  const totalJuros = Math.max(0, totalPMT - pvTotal);

  const addReforco = () => {
    if (!reforcoData) { toast.error('Informe a data do reforço'); return; }
    const val = parseValor(reforcoValor);
    if (!val || val <= 0) { toast.error('Informe um valor válido para o reforço'); return; }
    onReforcos([...reforcos, { id: crypto.randomUUID(), data: reforcoData, valor: val }]);
    setReforcoData(null);
    setReforcoValor('');
  };

  const gerarReforcosAuto = () => {
    if (!autoStart) { toast.error('Informe a data do primeiro reforço'); return; }
    const val = parseValor(autoValor);
    if (!val || val <= 0) { toast.error('Informe um valor válido para o reforço'); return; }
    const qtd = parseInt(autoQtd);
    if (!qtd || qtd <= 0) { toast.error('Informe quantos reforços gerar'); return; }
    if (qtd > 240) { toast.error('Quantidade muito alta (máx. 240)'); return; }
    const meses = MESES_POR_PERIODO[autoPeriod];
    const novos: Reforco[] = [];
    for (let k = 0; k < qtd; k++) {
      novos.push({ id: crypto.randomUUID(), data: addMonths(autoStart, meses * k), valor: val });
    }
    onReforcos([...reforcos, ...novos]);
    toast.success(`${qtd} reforço(s) gerado(s) — você pode editar ou excluir cada um abaixo`);
    setAutoValor('');
    setAutoQtd('');
    setAutoStart(null);
  };

  const updateReforco = (id: string, patch: Partial<Reforco>) => {
    onReforcos(reforcos.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeReforco = (id: string) => {
    onReforcos(reforcos.filter(r => r.id !== id));
  };

  const reforcosOrdenados = useMemo(
    () => [...reforcos].sort((a, b) => a.data.getTime() - b.data.getTime()),
    [reforcos]
  );

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
              <Label htmlFor="startDate">Data do 1º vencimento</Label>
              <DateInput
                id="startDate"
                value={startDate}
                onChange={(d) => d && onStartDate(d)}
              />
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
        <CardContent className="space-y-5">
          {/* Lançamento manual */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Lançar manualmente</Label>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label>Data do reforço</Label>
                <DateInput value={reforcoData} onChange={setReforcoData} className="w-[210px]" />
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
          </div>

          {/* Gerador automático */}
          <div className="space-y-2 border-t pt-4">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Gerar automaticamente</Label>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1">
                <Label>Periodicidade</Label>
                <Select value={autoPeriod} onValueChange={(v) => setAutoPeriod(v as Periodicidade)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor de cada (R$)</Label>
                <Input
                  type="text"
                  placeholder="0,00"
                  value={autoValor}
                  onChange={(e) => setAutoValor(e.target.value)}
                  className="w-[140px] tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  max="240"
                  placeholder="Ex: 5"
                  value={autoQtd}
                  onChange={(e) => setAutoQtd(e.target.value)}
                  className="w-[100px] tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label>Data do 1º reforço</Label>
                <DateInput value={autoStart} onChange={setAutoStart} className="w-[210px]" />
              </div>
              <Button size="sm" variant="secondary" onClick={gerarReforcosAuto}>
                <Sparkles className="w-4 h-4 mr-1" /> Gerar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Gera 1 reforço por período a partir da data informada. Depois você pode editar a data/valor ou excluir cada um na lista abaixo.
            </p>
          </div>

          {/* Lista editável */}
          {reforcosOrdenados.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {reforcosOrdenados.length} reforço(s) — clique para editar
              </Label>
              {reforcosOrdenados.map(r => (
                <ReforcoRow
                  key={r.id}
                  reforco={r}
                  dataRenegociacao={dataRenegociacao}
                  taxaJuros={taxaJuros}
                  onUpdate={updateReforco}
                  onRemove={removeReforco}
                />
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
                  {quadro2Completo.map((p, idx) => (
                    <TableRow key={`${p.tipo}-${idx}`} className={p.tipo === 'reforco' ? 'bg-accent/30' : p.tipo === 'mantida' ? 'bg-muted/30' : ''}>
                      <TableCell className="tabular-nums font-medium">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            value={p.numero}
                            onChange={(e) => {
                              const newNum = parseInt(e.target.value) || 0;
                              const updated = [...quadro2Completo];
                              updated[idx] = { ...updated[idx], numero: newNum };
                              setManualNumeros(updated.map(u => u.numero));
                            }}
                            className="w-16 h-7 text-center tabular-nums px-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Renumerar daqui para baixo (+1)"
                            onClick={() => {
                              const updated = [...quadro2Completo];
                              const startNum = updated[idx].numero;
                              for (let i = idx; i < updated.length; i++) {
                                updated[i] = { ...updated[i], numero: startNum + (i - idx) };
                              }
                              setManualNumeros(updated.map(u => u.numero));
                            }}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
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

interface ReforcoRowProps {
  reforco: Reforco;
  dataRenegociacao: Date;
  taxaJuros: number;
  onUpdate: (id: string, patch: Partial<Reforco>) => void;
  onRemove: (id: string) => void;
}

function ReforcoRow({ reforco, dataRenegociacao, taxaJuros, onUpdate, onRemove }: ReforcoRowProps) {
  const [valorText, setValorText] = useState(formatValorInput(reforco.valor));

  // Sincroniza se o valor mudar por fora.
  useEffect(() => {
    setValorText(formatValorInput(reforco.valor));
  }, [reforco.valor]);

  const commitValor = () => {
    const v = parseValor(valorText);
    if (v && v > 0) {
      onUpdate(reforco.id, { valor: v });
    } else {
      setValorText(formatValorInput(reforco.valor));
    }
  };

  // VP do reforço descontado até a data da renegociação (igual à lógica do financial.ts)
  const dias = Math.max(0, Math.round((reforco.data.getTime() - dataRenegociacao.getTime()) / 86400000));
  const iMensal = taxaJuros / 100;
  const iDiaria = Math.pow(1 + iMensal, 1 / 30) - 1;
  const vp = (iMensal === 0 || dias === 0) ? reforco.valor : reforco.valor / Math.pow(1 + iDiaria, dias);

  return (
    <div className="flex flex-wrap items-center gap-3 bg-muted/50 rounded px-3 py-2 text-sm">
      <DateInput
        value={reforco.data}
        onChange={(d) => d && onUpdate(reforco.id, { data: d })}
        className="w-[200px]"
      />
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground text-xs">R$</span>
        <Input
          type="text"
          value={valorText}
          onChange={(e) => setValorText(e.target.value)}
          onBlur={commitValor}
          className="w-[130px] h-9 tabular-nums"
        />
      </div>
      <span className="text-muted-foreground text-xs">
        VP: {formatCurrency(vp)} ({dias}d)
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => onRemove(reforco.id)}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
}
