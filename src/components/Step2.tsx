import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { Parcela } from '@/types/contract';
import { toast } from 'sonner';

interface Step2Props {
  parcelas: Parcela[];
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2({ parcelas, selectedIds, onSelectionChange, onNext, onBack }: Step2Props) {
  const selectableParcelas = useMemo(() => parcelas, [parcelas]);

  const allSelected = selectableParcelas.length > 0 && selectableParcelas.every((p) => selectedIds.has(p.rowIndex));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(selectableParcelas.map((p) => p.rowIndex)));
    }
  };

  const toggle = (rowIndex: number) => {
    const next = new Set(selectedIds);
    if (next.has(rowIndex)) next.delete(rowIndex);
    else next.add(rowIndex);
    onSelectionChange(next);
  };

  const totalSaldo = useMemo(
    () => parcelas.filter((p) => selectedIds.has(p.rowIndex)).reduce((sum, p) => sum + p.saldoAtual, 0),
    [parcelas, selectedIds]
  );

  const handleNext = () => {
    if (selectedIds.size === 0) {
      toast.error('Selecione ao menos uma parcela para reparcelar');
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Parcelas do Contrato</CardTitle>
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[450px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-20">Nº Parc.</TableHead>
                  <TableHead>Data Vencimento</TableHead>
                  <TableHead className="text-right">Valor Original</TableHead>
                  <TableHead className="text-right">Saldo Atual c/ encargos</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parcelas.map((p) => (
                  <TableRow
                    key={p.rowIndex}
                    className={selectedIds.has(p.rowIndex) ? 'bg-primary/5' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(p.rowIndex)}
                        onCheckedChange={() => toggle(p.rowIndex)}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums font-medium">
                      {String(p.numero).padStart(2, '0')}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {format(p.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p.valorOriginal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p.saldoAtual)}</TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sticky footer summary */}
      <Card className="sticky bottom-4 border-primary/20 shadow-lg">
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Parcelas selecionadas: </span>
              <span className="font-semibold">{selectedIds.size}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Saldo devedor total: </span>
              <span className="font-semibold tabular-nums">{formatCurrency(totalSaldo)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Button>
            <Button onClick={handleNext}>
              Próximo <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
