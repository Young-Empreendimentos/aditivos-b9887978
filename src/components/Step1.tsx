import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowRight,
  CalendarIcon,
  Search,
  Loader2,
  Check,
  FileText,
  User,
  Building2,
  AlertTriangle,
  FileCheck2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  listEmpresas,
  searchClientes,
  listContratosByCliente,
  listParcelasByContrato,
  type EmpresaSienge,
  type ClienteSienge,
  type ContratoSienge,
  type SiengeParcelaRow,
} from '@/lib/sienge';
import { getConfiguracao, fetchTemplateAsFile, buscarTaxaAditivo, type ConfiguracaoEmpresa } from '@/lib/configuracoes';
import type { Parcela } from '@/types/contract';
import { formatCurrency } from '@/lib/formatters';


interface Step1Props {
  templateFile: File | null;
  taxaJuros: number;
  custosAdicionais: number;
  dataRenegociacao: Date | null;
  isRegistrado: boolean;
  selectedCliente: ClienteSienge | null;
  selectedContrato: ContratoSienge | null;
  parcelas: Parcela[];
  onTemplateFile: (f: File | null) => void;
  onTaxaJuros: (v: number) => void;
  onCustosAdicionais: (v: number) => void;
  onDataRenegociacao: (d: Date) => void;
  onIsRegistrado: (v: boolean) => void;
  onClienteSelect: (c: ClienteSienge | null) => void;
  onContratoSelect: (c: ContratoSienge | null) => void;
  onParcelasLoaded: (p: Parcela[]) => void;
  onNext: () => void;
}

/** Converte string de data (YYYY-MM-DD ou ISO) para Date no horário LOCAL,
 *  evitando o problema de UTC midnight = dia anterior no Brasil (UTC-3). */
function parseDateLocal(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const datePart = dateStr.split('T')[0];
  const parts = datePart.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]); // mês é 0-indexado
}

function mapRowsToParcelas(rows: SiengeParcelaRow[]): Parcela[] {
  const parcelas: Parcela[] = rows
    .map((r, idx) => {
      const due = parseDateLocal(r.due_date);
      if (!due || isNaN(due.getTime())) return null;
      return {
        rowIndex: idx,
        numero: 0,
        dataVencimento: due,
        parcelaOriginal: r.installment_number != null ? String(r.installment_number) : '',
        tipoCondicao: '',
        valorOriginal: Number(r.original_amount ?? 0),
        saldoAtual: Number(r.current_balance_with_addition ?? r.current_balance ?? 0),
        isEntrada: false,
      } as Parcela;
    })
    .filter((p): p is Parcela => p !== null);

  parcelas.sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime());
  // Todas as parcelas entram para renegociação — nenhuma é tratada como entrada
  parcelas.forEach((p, i) => {
    p.isEntrada = false;
    p.numero = i + 1;
  });
  return parcelas;
}

export function Step1({
  templateFile,
  taxaJuros,
  custosAdicionais,
  dataRenegociacao,
  isRegistrado,
  selectedCliente,
  selectedContrato,
  parcelas,
  onTemplateFile,
  onTaxaJuros,
  onCustosAdicionais,
  onDataRenegociacao,
  onIsRegistrado,
  onClienteSelect,
  onContratoSelect,
  onParcelasLoaded,
  onNext,
}: Step1Props) {
  const [empresas, setEmpresas] = useState<EmpresaSienge[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState(selectedCliente?.client_name ?? '');
  const [clientes, setClientes] = useState<ClienteSienge[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [contratos, setContratos] = useState<ContratoSienge[]>([]);
  const [loadingContratos, setLoadingContratos] = useState(false);
  const [loadingParcelas, setLoadingParcelas] = useState(false);

  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configTemplateName, setConfigTemplateName] = useState<string | null>(null);
  const [configMissing, setConfigMissing] = useState(false);
  // Guarda a config carregada para recompor a taxa quando isRegistrado mudar
  const [loadedCfg, setLoadedCfg] = useState<ConfiguracaoEmpresa | null>(null);

  // Load empresas on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingEmpresas(true);
      try {
        const list = await listEmpresas();
        if (!cancelled) setEmpresas(list);

      } catch (err: any) {
        if (!cancelled) toast.error(err?.message ?? 'Erro ao carregar empresas');
      } finally {
        if (!cancelled) setLoadingEmpresas(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced client search (only after empresa selected)
  useEffect(() => {
    if (!selectedEmpresaId) return;
    if (selectedCliente) return;
    const term = searchTerm.trim();
    if (term.length < 3) {
      setClientes([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoadingClientes(true);
      try {
        const res = await searchClientes(term, selectedEmpresaId);
        setClientes(res);
      } catch (err: any) {
        toast.error(err?.message ?? 'Erro ao buscar clientes');
      } finally {
        setLoadingClientes(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [searchTerm, selectedCliente, selectedEmpresaId]);

  const handleEmpresaChange = async (id: string) => {
    setSelectedEmpresaId(id);
    onClienteSelect(null);
    onContratoSelect(null);
    onParcelasLoaded([]);
    setContratos([]);
    setClientes([]);
    setSearchTerm('');
    onTemplateFile(null as unknown as File);
    setConfigTemplateName(null);
    setConfigMissing(false);
    if (!id) return;
    setLoadingConfig(true);
    try {
      const cfg = await getConfiguracao(id);
      const file = cfg ? await fetchTemplateAsFile(cfg) : null;
      if (!cfg || !file) {
        setConfigMissing(true);
        setLoadedCfg(null);
        return;
      }
      onTemplateFile(file);
      setConfigTemplateName(cfg.templateName ?? file.name);
      setLoadedCfg(cfg);
      // Aplica já a taxa correta considerando o status de registro atual
      onTaxaJuros(buscarTaxaAditivo(cfg, isRegistrado));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar configuração da empresa';
      toast.error(msg);
      setConfigMissing(true);
    } finally {
      setLoadingConfig(false);
    }
  };


  const handleSelectCliente = async (c: ClienteSienge) => {
    onClienteSelect(c);
    onContratoSelect(null);
    onParcelasLoaded([]);
    setContratos([]);
    setSearchTerm(c.client_name);
    setLoadingContratos(true);
    try {
      const list = await listContratosByCliente(c.client_id, selectedEmpresaId || undefined);
      setContratos(list);
      if (list.length === 0) toast.info('Nenhum contrato em aberto para este cliente.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao carregar contratos');
    } finally {
      setLoadingContratos(false);
    }
  };

  const handleSelectContrato = async (c: ContratoSienge) => {
    onContratoSelect(c);
    onParcelasLoaded([]);
    setLoadingParcelas(true);
    try {
      const rows = await listParcelasByContrato(c.bill_id, c.bill_document);
      const mapped = mapRowsToParcelas(rows);
      onParcelasLoaded(mapped);
      if (mapped.length === 0) toast.info('Nenhuma parcela em aberto neste contrato.');
      else toast.success(`${mapped.length} parcela(s) carregada(s).`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao carregar parcelas');
    } finally {
      setLoadingParcelas(false);
    }
  };

  const resetCliente = () => {
    onClienteSelect(null);
    onContratoSelect(null);
    onParcelasLoaded([]);
    setContratos([]);
    setClientes([]);
    setSearchTerm('');
  };

  const handleNext = () => {
    if (!selectedEmpresaId) {
      toast.error('Selecione a empresa.');
      return;
    }
    if (configMissing || !templateFile) {
      toast.error('Esta empresa não possui modelo de aditivo configurado.');
      return;
    }
    if (!selectedContrato || parcelas.length === 0) {
      toast.error('Selecione um cliente e um contrato com parcelas em aberto.');
      return;
    }
    if (taxaJuros <= 0 || taxaJuros > 100) {
      toast.error('Informe uma taxa de juros válida (entre 0 e 100%)');
      return;
    }
    if (!dataRenegociacao) {
      toast.error('Informe a data da renegociação');
      return;
    }
    onNext();
  };

  const nextDisabled = !selectedEmpresaId || configMissing || !templateFile || loadingConfig;


  const selectedEmpresa = empresas.find((e) => e.company_id === selectedEmpresaId);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select
            value={selectedEmpresaId}
            onValueChange={handleEmpresaChange}
            disabled={loadingEmpresas}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={loadingEmpresas ? 'Carregando empresas...' : 'Selecione a empresa'}
              />
            </SelectTrigger>
            <SelectContent>
              {empresas.map((e) => (
                <SelectItem key={e.company_id} value={e.company_id}>
                  {e.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEmpresaId && loadingConfig && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando configuração da empresa…
            </div>
          )}

          {selectedEmpresaId && !loadingConfig && configTemplateName && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
              <FileCheck2 className="h-4 w-4 shrink-0" />
              <span className="truncate">
                Modelo carregado: <span className="font-medium">{configTemplateName}</span>
              </span>
            </div>
          )}

          {selectedEmpresaId && !loadingConfig && configMissing && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Nenhum modelo configurado para esta empresa. Contate o administrador.
              </span>
            </div>
          )}
        </CardContent>

      </Card>

      <Card className={cn(!selectedEmpresaId && 'opacity-60')}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-4 w-4" /> Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedEmpresaId ? (
            <p className="text-sm text-muted-foreground">
              Selecione uma empresa para buscar clientes.
            </p>
          ) : selectedCliente ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-primary" />
                <span className="font-medium">{selectedCliente.client_name}</span>
                <Badge variant="outline" className="text-[10px]">ID {selectedCliente.client_id}</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={resetCliente}>Trocar</Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Digite o nome do cliente (mínimo 3 caracteres)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
                {loadingClientes && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {searchTerm.trim().length >= 3 && !loadingClientes && (
                <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
                  {clientes.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                      Nenhum cliente encontrado{selectedEmpresa ? ` em ${selectedEmpresa.company_name}` : ''}.
                    </p>
                  ) : (
                    clientes.map((c) => (
                      <button
                        key={c.client_id}
                        onClick={() => handleSelectCliente(c)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-center justify-between"
                      >
                        <span>{c.client_name}</span>
                        <span className="text-xs text-muted-foreground">#{c.client_id}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedCliente && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" /> Contrato
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingContratos ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando contratos...
              </div>
            ) : contratos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum contrato em aberto.</p>
            ) : (
              <div className="space-y-2">
                {contratos.map((c) => {
                  const key = `${c.bill_id}__${c.bill_document}`;
                  const active =
                    selectedContrato &&
                    selectedContrato.bill_id === c.bill_id &&
                    selectedContrato.bill_document === c.bill_document;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectContrato(c)}
                      className={cn(
                        'w-full text-left rounded-md border px-3 py-2.5 text-sm transition-colors',
                        active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {active && <Check className="h-4 w-4 text-primary" />}
                          <span className="font-medium">
                            {c.bill_document || `Bill ${c.bill_id}`}
                          </span>
                          {c.main_unit && (
                            <Badge variant="outline" className="text-[10px]">Unid. {c.main_unit}</Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {c.parcelasCount} parc. em aberto
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3">
                        {c.business_area_name && <span>{c.business_area_name}</span>}
                        {c.company_name && <span>· {c.company_name}</span>}
                        <span>· Bill ID {c.bill_id}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {loadingParcelas && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando parcelas...
              </div>
            )}
            {!loadingParcelas && parcelas.length > 0 && (
              <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Parcelas carregadas</span>
                <span className="font-medium tabular-nums">
                  {parcelas.length} · saldo total{' '}
                  {formatCurrency(parcelas.reduce((s, p) => s + p.saldoAtual, 0))}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Parâmetros Financeiros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
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
            {/* Checkbox registrado — recomputa taxa se houver regras configuradas */}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="registrado"
                checked={isRegistrado}
                onCheckedChange={(checked) => {
                  const v = !!checked;
                  onIsRegistrado(v);
                  if (loadedCfg) onTaxaJuros(buscarTaxaAditivo(loadedCfg, v));
                }}
              />
              <Label htmlFor="registrado" className="text-xs cursor-pointer font-normal">
                Contrato registrado em cartório
              </Label>
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
          <div className="space-y-2">
            <Label>Data da Renegociação</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !dataRenegociacao && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataRenegociacao ? format(dataRenegociacao, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataRenegociacao || undefined}
                  onSelect={(d) => d && onDataRenegociacao(d)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} size="lg" disabled={nextDisabled}>
          Próximo <ArrowRight className="w-4 h-4" />
        </Button>

      </div>
    </div>
  );
}
