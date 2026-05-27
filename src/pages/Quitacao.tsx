import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Calculator, CalendarDays, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/formatters';
import {
  listEmpresas,
  searchClientes,
  listContratosByCliente,
  listParcelasByContrato,
  getDadosContrato,
  extractUnitName,
  type EmpresaSienge,
  type ClienteSienge,
  type ContratoSienge,
} from '@/lib/sienge';
import { getQuitacaoConfig, type QuitacaoConfig } from '@/lib/quitacaoConfig';
import {
  calcularQuitacao,
  ultimoDiaMesAtual,
  type ResultadoQuitacao,
} from '@/lib/quitacao';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Componente principal ─────────────────────────────────────────────────────

const Quitacao = () => {
  // Seleção de contrato
  const [empresas, setEmpresas] = useState<EmpresaSienge[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('__all__');
  const [clientSearch, setClientSearch] = useState('');
  const [clientes, setClientes] = useState<ClienteSienge[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<ClienteSienge | null>(null);
  const [contratos, setContratos] = useState<ContratoSienge[]>([]);
  const [selectedContrato, setSelectedContrato] = useState<ContratoSienge | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [loadingContratos, setLoadingContratos] = useState(false);

  // Parâmetros
  const [dataBase, setDataBase] = useState(todayIso());
  const [isRegistrado, setIsRegistrado] = useState<boolean>(false);

  // Cálculo
  const [calculating, setCalculating] = useState(false);
  const [resultado, setResultado] = useState<ResultadoQuitacao | null>(null);
  const [empConf, setEmpConf] = useState<QuitacaoConfig | null>(null);
  const [loteNome, setLoteNome] = useState<string | null>(null);
  const [loteHabilitado, setLoteHabilitado] = useState<boolean>(true);

  // Ref para debounce de busca de cliente
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega empresas ao montar
  useEffect(() => {
    listEmpresas().then(setEmpresas).catch(() => toast.error('Erro ao carregar empresas'));
  }, []);

  // Busca clientes com debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (clientSearch.trim().length < 3) {
      setClientes([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoadingClientes(true);
      try {
        const list = await searchClientes(clientSearch, selectedEmpresa === '__all__' ? undefined : selectedEmpresa);
        setClientes(list);
      } catch {
        toast.error('Erro ao buscar clientes');
      } finally {
        setLoadingClientes(false);
      }
    }, 400);
  }, [clientSearch, selectedEmpresa]);

  // Carrega contratos ao selecionar cliente
  async function selectCliente(c: ClienteSienge) {
    setSelectedCliente(c);
    setClientSearch(c.client_name);
    setClientes([]);
    setSelectedContrato(null);
    setResultado(null);
    setLoadingContratos(true);
    try {
      const list = await listContratosByCliente(c.client_id, selectedEmpresa === '__all__' ? undefined : selectedEmpresa);
      setContratos(list);
    } catch {
      toast.error('Erro ao carregar contratos');
    } finally {
      setLoadingContratos(false);
    }
  }

  function selectContrato(c: ContratoSienge) {
    setSelectedContrato(c);
    setResultado(null);
  }

  // Calcular quitação
  async function handleCalcular() {
    if (!selectedContrato) return;
    if (!dataBase) {
      toast.error('Informe a data base do cálculo');
      return;
    }

    setCalculating(true);
    setResultado(null);
    try {
      // 1. Parcelas em aberto
      const rows = await listParcelasByContrato(
        selectedContrato.bill_id,
        selectedContrato.bill_document
      );
      console.log('[Quitacao] rows:', rows.length, rows[0]);

      // 2. Dados do contrato (valor total + empreendimento)
      const dadosContrato = await getDadosContrato(selectedContrato.bill_id);
      console.log('[Quitacao] dadosContrato:', dadosContrato);

      // 3. Config de taxa do empreendimento (Firestore quitacao_configuracoes)
      const nomeEmp =
        dadosContrato?.contrato?.empreendimento ??
        selectedContrato.business_area_name ??
        selectedContrato.company_name ??
        '';
      console.log('[Quitacao] nomeEmp:', JSON.stringify(nomeEmp), 'bill_id:', selectedContrato.bill_id, 'business_area_name:', selectedContrato.business_area_name);

      if (!nomeEmp.trim()) {
        toast.error(
          'Não foi possível identificar o empreendimento deste contrato. Verifique os dados no Sienge.'
        );
        setCalculating(false);
        return;
      }

      const cfg = await getQuitacaoConfig(nomeEmp);
      console.log('[Quitacao] cfg:', cfg);

      if (!cfg) {
        toast.error(
          `Empreendimento "${nomeEmp}" sem taxa configurada. Configure em Configurações > Quitação.`
        );
        setCalculating(false);
        return;
      }
      setEmpConf(cfg);

      if ((cfg.taxa_padrao ?? 0) === 0 && (cfg.regras ?? []).length === 0) {
        toast.warning(`Taxa de quitação para "${nomeEmp}" é 0%. Verifique as configurações.`);
      }

      // 4. Identificar lote e checar se está habilitado para desconto
      const lote = rows.length > 0 ? extractUnitName(rows[0]) : null;
      setLoteNome(lote);
      const lotesHabilitados = cfg.lotes_habilitados;
      const habilitado =
        !lotesHabilitados || lotesHabilitados.length === 0
          ? true
          : lote !== null && lotesHabilitados.includes(lote);
      setLoteHabilitado(habilitado);

      // 5. Mapear parcelas para o cálculo
      // parseDateLocal: converte YYYY-MM-DD como horário local (evita UTC -1 dia no Brasil)
      const parseDateLocal = (s: string | null) => {
        if (!s) return new Date(NaN);
        const [y, m, d] = s.split('T')[0].split('-').map(Number);
        return new Date(y, m - 1, d);
      };
      const parcelas = rows.map((p) => ({
        numero: p.installment_number ?? 0,
        dataVencimento: parseDateLocal(p.due_date),
        // valorAtual: saldo completo com juros e acréscimos (usado no cálculo VP)
        valorAtual: Number(p.current_balance_with_addition ?? p.current_balance ?? 0),
        // valorCorrigido: saldo com correção monetária, sem juros/multa (usado no % pago)
        valorCorrigido: Number(p.corrected_balance_amount ?? p.original_amount ?? 0),
      }));

      const valorTotalContrato = Number(dadosContrato?.contrato?.valor_total ?? 0);

      // 6. Montar objeto compatível com calcularQuitacao
      // Se lote não habilitado: taxa = 0 → calcVP retorna valorAtual sem desconto
      const empCompat = {
        id: nomeEmp,
        nome: nomeEmp,
        taxaJuros: 0,
        taxaJurosQuitacao: habilitado ? cfg.taxa_padrao : 0,
        regrasQuitacao: habilitado ? cfg.regras : [],
      };

      // 7. Data de emissão do contrato (para regras por período)
      const emissaoStr = rows.length > 0 ? (rows[0].bill_emission_date ?? null) : null;
      const dataContrato = emissaoStr
        ? (() => { const [y, m, d] = emissaoStr.split('T')[0].split('-').map(Number); return new Date(y, m - 1, d); })()
        : null;

      // 8. Calcular
      const db = new Date(dataBase + 'T00:00:00');
      const res = calcularQuitacao(parcelas, db, isRegistrado, valorTotalContrato, empCompat, dataContrato);
      setResultado(res);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao calcular');
    } finally {
      setCalculating(false);
    }
  }

  const maxDate = ultimoDiaMesAtual();
  const contratoReady = !!selectedContrato;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quitação de Contrato</h1>
            <p className="text-sm text-muted-foreground">
              Calcule o valor presente das parcelas para quitação antecipada
            </p>
          </div>
        </div>

        {/* Card 1: Selecionar contrato */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1. Selecionar contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Empresa */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Select
                  value={selectedEmpresa}
                  onValueChange={(v) => {
                    setSelectedEmpresa(v);
                    setSelectedCliente(null);
                    setClientSearch('');
                    setContratos([]);
                    setSelectedContrato(null);
                    setResultado(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as empresas</SelectItem>
                    {empresas.map((e) => (
                      <SelectItem key={e.company_id} value={e.company_id}>
                        {e.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Busca de cliente */}
              <div className="space-y-1.5 relative">
                <Label>Cliente</Label>
                <div className="relative">
                  <Input
                    placeholder="Digite 3+ letras para buscar..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setSelectedCliente(null);
                      setContratos([]);
                      setSelectedContrato(null);
                      setResultado(null);
                    }}
                  />
                  {loadingClientes && (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {clientes.length > 0 && !selectedCliente && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-background border rounded-md shadow-md max-h-48 overflow-auto">
                    {clientes.map((c) => (
                      <button
                        key={c.client_id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onClick={() => selectCliente(c)}
                      >
                        {c.client_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Lista de contratos */}
            {loadingContratos && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando contratos…
              </div>
            )}
            {!loadingContratos && contratos.length > 0 && (
              <div className="space-y-1.5">
                <Label>Contrato</Label>
                <div className="grid sm:grid-cols-2 gap-2 max-h-52 overflow-auto">
                  {contratos.map((c) => (
                    <button
                      key={`${c.bill_id}-${c.bill_document}`}
                      onClick={() => selectContrato(c)}
                      className={`text-left rounded-md border px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 ${
                        selectedContrato?.bill_id === c.bill_id
                          ? 'border-primary bg-primary/5'
                          : ''
                      }`}
                    >
                      <div className="font-medium tabular-nums">{c.bill_document || c.bill_id}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.business_area_name ?? c.company_name}
                        {c.main_unit ? ` · ${c.main_unit}` : ''}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.parcelasCount} parcela{c.parcelasCount !== 1 ? 's' : ''} em aberto
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Parâmetros */}
        {contratoReady && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Parâmetros do cálculo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                {/* Data base */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Calcular quitação p/
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={dataBase}
                      max={maxDate}
                      onChange={(e) => setDataBase(e.target.value)}
                      className="w-40 tabular-nums"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDataBase(todayIso())}
                    >
                      Hoje
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Máximo: último dia do mês atual
                  </p>
                </div>

                {/* Registrado */}
                <div className="space-y-1.5">
                  <Label>Contrato registrado?</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={isRegistrado ? 'default' : 'outline'}
                      onClick={() => setIsRegistrado(true)}
                    >
                      Sim
                    </Button>
                    <Button
                      size="sm"
                      variant={!isRegistrado ? 'default' : 'outline'}
                      onClick={() => setIsRegistrado(false)}
                    >
                      Não
                    </Button>
                  </div>
                </div>

                {/* Botão calcular */}
                <Button
                  onClick={handleCalcular}
                  disabled={calculating}
                  className="self-end"
                >
                  {calculating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calculator className="h-4 w-4" />
                  )}
                  Calcular
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card 3: Resultado */}
        {resultado && empConf && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Resultado</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {empConf.empreendimento}
                  </Badge>
                  {loteNome && (
                    <Badge variant="outline">{loteNome}</Badge>
                  )}
                  {loteHabilitado ? (
                    <Badge variant="secondary">
                      {resultado.taxaPercent.toFixed(4).replace('.', ',')}% a.m. — {resultado.regraDescricao}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Sem desconto de quitação</Badge>
                  )}
                  <Badge variant="outline">
                    {resultado.percentualPago.toFixed(1).replace('.', ',')}% pago
                  </Badge>
                  <Badge variant={isRegistrado ? 'default' : 'outline'}>
                    {isRegistrado ? 'Registrado' : 'Não registrado'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            {!loteHabilitado && (
              <CardContent className="pb-0 pt-0">
                <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
                  Este lote não possui desconto de quitação configurado — o valor apresentado é igual ao saldo devedor atual, sem aplicação de juros ou desconto.
                </div>
              </CardContent>
            )}
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-20 text-center">Nº Parcela</TableHead>
                    <TableHead>Data Parcela</TableHead>
                    <TableHead className="text-right">Valor Atual</TableHead>
                    <TableHead className="text-right">Valor c/ desconto p/ quitação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.parcelas.map((p) => (
                    <TableRow
                      key={p.numero}
                      className={p.dias < 0 ? 'bg-destructive/5' : ''}
                    >
                      <TableCell className="text-center tabular-nums font-medium">
                        {String(p.numero).padStart(2, '0')}
                        {p.dias < 0 && (
                          <span className="ml-1 text-[10px] text-destructive font-normal">venc.</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {format(p.dataVencimento, 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(p.valorAtual)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(p.valorComDesconto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-primary/10">
                    <TableCell colSpan={2} className="font-bold text-sm">
                      Saldo para quitação total no dia{' '}
                      {format(resultado.dataBase, "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(resultado.parcelas.reduce((s, p) => s + p.valorAtual, 0))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-lg text-primary">
                      {formatCurrency(resultado.totalQuitacao)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Quitacao;
