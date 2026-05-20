import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Settings, Home } from 'lucide-react';
import { Stepper } from '@/components/Stepper';
import { Step1 } from '@/components/Step1';
import { Step2 } from '@/components/Step2';
import { Step3 } from '@/components/Step3';
import { Step4 } from '@/components/Step4';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission, ROLE_LABELS } from '@/hooks/usePermission';
import type { Parcela, NovaParcela, Reforco } from '@/types/contract';
import type { ClienteSienge, ContratoSienge } from '@/lib/sienge';
import { toast } from 'sonner';

const STEPS = ['Dados', 'Seleção', 'Simulação', 'Revisão'];

const ROLE_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  coordinator: 'secondary',
  common: 'outline',
};

const GeradorAditivo = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const { user, logout } = useAuth();
  const { role, isAdmin, isCoordinator } = usePermission();


  const handleLogout = async () => {
    try {
      await logout();
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao sair');
    }
  };


  // Step 1 state
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [taxaJuros, setTaxaJuros] = useState(0);
  const [custosAdicionais, setCustosAdicionais] = useState(0);
  const [dataRenegociacao, setDataRenegociacao] = useState<Date | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<ClienteSienge | null>(null);
  const [selectedContrato, setSelectedContrato] = useState<ContratoSienge | null>(null);

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

  const handleStep1Next = useCallback(() => {
    setSelectedIds(new Set());
    setCurrentStep(2);
  }, []);

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
        <header className="mb-8 relative text-center">
          <div className="absolute right-0 top-0 flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName ?? user.email ?? ''} />}
                  <AvatarFallback>
                    {(user.displayName ?? user.email ?? '?').slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-xs font-medium">{user.displayName ?? user.email}</span>
                  <Badge variant={ROLE_BADGE_VARIANT[role]} className="h-4 px-1.5 text-[10px]">
                    {ROLE_LABELS[role]}
                  </Badge>
                </div>
              </div>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">Menu</span>
              </Link>
            </Button>
            {isCoordinator && (
              <Button asChild variant="outline" size="sm">
                <Link to="/configuracoes">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Configurações</span>
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Gerador de Aditivo Contratual</h1>
          <p className="text-sm text-muted-foreground mt-1">Reparcelamento de contrato de compra e venda de imóvel</p>
        </header>

        <Stepper currentStep={currentStep} steps={STEPS} />

        {currentStep === 1 && (
          <Step1
            templateFile={templateFile}
            taxaJuros={taxaJuros}
            custosAdicionais={custosAdicionais}
            dataRenegociacao={dataRenegociacao}
            selectedCliente={selectedCliente}
            selectedContrato={selectedContrato}
            parcelas={parcelas}
            onTemplateFile={setTemplateFile}
            onTaxaJuros={setTaxaJuros}
            onCustosAdicionais={setCustosAdicionais}
            onDataRenegociacao={setDataRenegociacao}
            onClienteSelect={setSelectedCliente}
            onContratoSelect={setSelectedContrato}
            onParcelasLoaded={setParcelas}
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

export default GeradorAditivo;
