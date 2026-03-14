import { FileUploadZone } from '@/components/FileUploadZone';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface Step1Props {
  templateFile: File | null;
  reportFile: File | null;
  taxaJuros: number;
  custosAdicionais: number;
  onTemplateFile: (f: File) => void;
  onReportFile: (f: File) => void;
  onTaxaJuros: (v: number) => void;
  onCustosAdicionais: (v: number) => void;
  onNext: () => void;
}

export function Step1({
  templateFile, reportFile, taxaJuros, custosAdicionais,
  onTemplateFile, onReportFile, onTaxaJuros, onCustosAdicionais, onNext
}: Step1Props) {

  const handleNext = () => {
    if (!reportFile) {
      toast.error('Faça upload do relatório de contas a receber (.xlsx)');
      return;
    }
    if (taxaJuros <= 0 || taxaJuros > 100) {
      toast.error('Informe uma taxa de juros válida (entre 0 e 100%)');
      return;
    }
    onNext();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Arquivos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FileUploadZone
            accept=".docx"
            label="Upload do Modelo (.docx)"
            description="Modelo com placeholders {{QUADRO_1}}, {{QUADRO_2}}, etc."
            file={templateFile}
            onFileSelect={onTemplateFile}
          />
          <FileUploadZone
            accept=".xlsx,.xls"
            label="Upload do Relatório (.xlsx)"
            description="Relatório de contas a receber"
            file={reportFile}
            onFileSelect={onReportFile}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Parâmetros Financeiros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="taxa">Taxa de Juros (% a.m.)</Label>
            <div className="relative">
              <Input
                id="taxa"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="1.50"
                value={taxaJuros || ''}
                onChange={(e) => onTaxaJuros(parseFloat(e.target.value) || 0)}
                className="pr-14 tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">% a.m.</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="custos">Custos Adicionais (R$)</Label>
            <div className="relative">
              <Input
                id="custos"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={custosAdicionais || ''}
                onChange={(e) => onCustosAdicionais(parseFloat(e.target.value) || 0)}
                className="pl-10 tabular-nums"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} size="lg">
          Próximo <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
