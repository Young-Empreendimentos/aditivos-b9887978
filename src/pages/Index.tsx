import { useState, useCallback, useMemo } from 'react';
import { LogOut } from 'lucide-react';
import { Stepper } from '@/components/Stepper';
import { Step1 } from '@/components/Step1';
import { Step2 } from '@/components/Step2';
import { Step3 } from '@/components/Step3';
import { Step4 } from '@/components/Step4';
import { Button } from '@/components/ui/button';
import { parseReportFile } from '@/lib/parseReport';
import { useAuth } from '@/contexts/AuthContext';
import type { Parcela, NovaParcela, Reforco } from '@/types/contract';
import { toast } from 'sonner';

const STEPS = ['Dados', 'Seleção', 'Simulação', 'Revisão'];


const Index = () => {
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 state
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [taxaJuros, setTaxaJuros] = useState(0);
  const [custosAdicionais, setCustosAdicionais] = useState(0);
  const [dataRenegociacao, setDataRenegociacao] = useState<Date | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);

  // Step 2 state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Step 3 state
  const [numParcelas, setNumParcelas] = useState(0);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [reforcos, setReforcos] = useState<Reforco[]>([]);
  const [novasParcelas, setNovasParcelas] = useState<NovaParcela[]>([]);
  const [pvTotal, setPvTotal] = useState(0);
  const [pmtValue, setPmtValue] = useState(0);
  const [totalJuros, setTotalJuros] = useState(0);
  const [valorTotalRenegociado, setValorTotalRenegociado] = useState(0);

  const selectedParcelas = useMemo(
    () => parcelas.filter((p) => selectedIds.has(p.rowIndex)),
    [parcelas, selectedIds]
  );

  const handleStep1Next = useCallback(async () => {
    if (!reportFile) return;
    try {
      const parsed = await parseReportFile(reportFile);
      setParcelas(parsed);
      setCurrentStep(2);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [reportFile]);

  const handleSimulationResult = useCallback(
    (np: NovaParcela[], pv: number, pmt: number, tj: number, tr: number) => {
      setNovasParcelas(np);
      setPvTotal(pv);
      setPmtValue(pmt);
      setTotalJuros(tj);
      setValorTotalRenegociado(tr);
    },
    []
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Gerador de Aditivo Contratual</h1>
          <p className="text-sm text-muted-foreground mt-1">Reparcelamento de contrato de compra e venda de imóvel</p>
        </header>

        <Stepper currentStep={currentStep} steps={STEPS} />

        {currentStep === 1 && (
          <Step1
            templateFile={templateFile}
            reportFile={reportFile}
            taxaJuros={taxaJuros}
            custosAdicionais={custosAdicionais}
            dataRenegociacao={dataRenegociacao}
            onTemplateFile={setTemplateFile}
            onReportFile={setReportFile}
            onTaxaJuros={setTaxaJuros}
            onCustosAdicionais={setCustosAdicionais}
            onDataRenegociacao={setDataRenegociacao}
            onNext={handleStep1Next}
          />
        )}

        {currentStep === 2 && (
          <Step2
            parcelas={parcelas}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onNext={() => setCurrentStep(3)}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && (
          <Step3
            parcelas={parcelas}
            selectedParcelas={selectedParcelas}
            selectedIds={selectedIds}
            taxaJuros={taxaJuros}
            custosAdicionais={custosAdicionais}
            dataRenegociacao={dataRenegociacao!}
            numParcelas={numParcelas}
            startDate={startDate}
            reforcos={reforcos}
            onNumParcelas={setNumParcelas}
            onStartDate={setStartDate}
            onReforcos={setReforcos}
            onSimulationResult={handleSimulationResult}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
          />
        )}

        {currentStep === 4 && (
          <Step4
            templateFile={templateFile}
            allParcelas={parcelas}
            selectedParcelas={selectedParcelas}
            selectedIds={selectedIds}
            novasParcelas={novasParcelas}
            taxaJuros={taxaJuros}
            custosAdicionais={custosAdicionais}
            pvTotal={pvTotal}
            totalJuros={totalJuros}
            valorTotalRenegociado={valorTotalRenegociado}
            pmtValue={pmtValue}
            onBack={() => setCurrentStep(3)}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
