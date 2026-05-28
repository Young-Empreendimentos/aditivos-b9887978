import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, RefreshCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDadosContrato, type DadosContrato, type ParteContrato } from '@/lib/sienge';
import {
  type DadosContratoForm,
  type ParteForm,
  emptyParte,
} from '@/types/dadosContrato';
import { toast } from 'sonner';
import type { ClienteSienge, ContratoSienge } from '@/lib/sienge';
import type { Parcela } from '@/types/contract';

interface Props {
  billId: string | null;
  empreendimentoFallback: string;
  numeroContratoFallback: string;
  selectedCliente: ClienteSienge | null;
  selectedContrato: ContratoSienge | null;
  parcelas: Parcela[];
  form: DadosContratoForm;
  onFormChange: (f: DadosContratoForm) => void;
  onBack: () => void;
  onNext: () => void;
}

const keep = (next: string | number | null | undefined, prev = '') => {
  if (next === null || next === undefined) return prev;
  const value = String(next).trim();
  return value || prev;
};

const extractLote = (unit: string | null | undefined) => {
  const value = (unit ?? '').trim();
  return value.replace(/^\s*lote\s*/i, '').trim() || value;
};

const ESTADO_CIVIL_OPTS = [
  'Solteiro(a)',
  'Casado(a)',
  'Divorciado(a)',
  'Viúvo(a)',
  'União Estável',
];

function parteFromApi(p: ParteContrato | undefined): ParteForm {
  if (!p) return emptyParte();
  const ec = (p.estado_civil ?? '').toLowerCase();
  const sexoRaw = String((p as any).sexo ?? '').trim();
  const sexoInferido: 'M' | 'F' | '' =
    sexoRaw === 'M' || sexoRaw.toLowerCase().startsWith('m') ? 'M'
    : sexoRaw === 'F' || sexoRaw.toLowerCase().startsWith('f') ? 'F'
    : ec.endsWith('a') ? 'F'
    : ec ? 'M'
    : '';
  return {
    nome: p.nome ?? '',
    cpf: p.cpf ?? '',
    nacionalidade: p.nacionalidade ?? '',
    estado_civil: p.estado_civil ?? '',
    profissao: p.profissao ?? '',
    rg: p.rg ?? '',
    orgao_emissor: p.orgao_emissor ?? '',
    data_emissao_rg: p.data_emissao_rg ?? '',
    email: p.email ?? '',
    telefone: p.telefone ?? '',
    endereco: {
      logradouro: p.endereco?.logradouro ?? '',
      numero: p.endereco?.numero ?? '',
      bairro: p.endereco?.bairro ?? '',
      cidade: p.endereco?.cidade ?? '',
      estado: p.endereco?.estado ?? '',
      cep: p.endereco?.cep ?? '',
    },
    sexo: sexoInferido,
    tipo_documento: 'RG',
    regime_bens: '',
  };
}

function applyApiToForm(api: DadosContrato, prev: DadosContratoForm): DadosContratoForm {
  // api.partes pode vir null do RPC — tratar como lista vazia
  const partes = Array.isArray(api.partes) ? api.partes : [];
  const principal = partes.find((p) => p.is_principal) ?? partes[0];
  const conjuge = partes.find((p) => p.is_conjuge);
  const cidadePrincipal = principal?.endereco?.cidade ?? '';
  const estadoPrincipal = principal?.endereco?.estado ?? '';
  return {
    ...prev,
    empreendimento: keep(api.contrato?.empreendimento, prev.empreendimento),
    num_lote: keep(api.unidade?.num_lote, prev.num_lote),
    area: keep(api.unidade?.area, prev.area),
    matricula: keep(api.unidade?.matricula, prev.matricula),
    onus: keep(api.unidade?.onus, prev.onus),
    cidade_empreendimento: prev.cidade_empreendimento || cidadePrincipal,
    estado_empreendimento: prev.estado_empreendimento || estadoPrincipal,
    numero_contrato: keep(api.contrato?.numero, prev.numero_contrato),
    data_contrato: keep((api.contrato?.data_contrato ?? api.contrato?.data_emissao ?? '').slice(0, 10), prev.data_contrato),
    valor_total: keep(api.contrato?.valor_total, prev.valor_total),
    valor_antigo_matricula: '',  // sempre vazio — preenchimento manual pelo usuário
    matricula_origem: prev.matricula_origem,  // preserva o que o usuário digitou
    comprador: principal ? parteFromApi(principal) : prev.comprador,
    temConjuge: !!conjuge,
    conjuge: conjuge ? parteFromApi(conjuge) : prev.conjuge,
    data_casamento: prev.data_casamento,
  };
}

function applyKnownDataToForm(
  prev: DadosContratoForm,
  selectedCliente: ClienteSienge | null,
  selectedContrato: ContratoSienge | null,
  parcelas: Parcela[],
  empreendimentoFallback: string,
  numeroContratoFallback: string,
): DadosContratoForm {
  const saldoAtualBanco = parcelas.reduce((sum, p) => sum + Number(p.saldoAtual || 0), 0);
  return {
    ...prev,
    empreendimento: prev.empreendimento || empreendimentoFallback || selectedContrato?.business_area_name || '',
    num_lote: prev.num_lote || extractLote(selectedContrato?.main_unit),
    area: prev.area || keep(selectedContrato?.bill_private_area),
    numero_contrato: prev.numero_contrato || numeroContratoFallback || selectedContrato?.bill_document || '',
    data_contrato: prev.data_contrato || (selectedContrato?.issue_date ?? '').slice(0, 10),
    valor_total: prev.valor_total || (saldoAtualBanco > 0 ? String(saldoAtualBanco) : ''),
    valor_antigo_matricula: '',  // sempre vazio — preenchimento manual pelo usuário
    comprador: {
      ...prev.comprador,
      nome: prev.comprador.nome || selectedCliente?.client_name || selectedContrato?.client_name || '',
    },
  };
}

export function StepDadosContrato({
  billId,
  empreendimentoFallback,
  numeroContratoFallback,
  selectedCliente,
  selectedContrato,
  parcelas,
  form,
  onFormChange,
  onBack,
  onNext,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const fetchData = async (force = false) => {
    if (!billId) return;
    if (!force && loadedFor === billId) return;
    setLoading(true);
    try {
      const knownForm = applyKnownDataToForm(
        form,
        selectedCliente,
        selectedContrato,
        parcelas,
        empreendimentoFallback,
        numeroContratoFallback,
      );
      onFormChange(knownForm);
      const api = await getDadosContrato(billId);
      const valido = api && api.contrato && typeof api.contrato === 'object';
      if (valido) {
        onFormChange(applyApiToForm(api!, knownForm));
        toast.success('Dados do contrato carregados');
      } else {
        onFormChange(knownForm);
        toast.warning('Sem dados retornados. Preencha manualmente.');
      }
      setLoadedFor(billId);
    } catch (err) {
      console.error(err);
      onFormChange(applyKnownDataToForm(form, selectedCliente, selectedContrato, parcelas, empreendimentoFallback, numeroContratoFallback));
      toast.warning('Não foi possível completar a busca; mantive os dados já carregados nas etapas anteriores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (billId && loadedFor !== billId) {
      fetchData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId]);

  const setComprador = (patch: Partial<ParteForm>) =>
    onFormChange({ ...form, comprador: { ...form.comprador, ...patch } });
  const setCompradorEnd = (patch: Partial<ParteForm['endereco']>) =>
    onFormChange({
      ...form,
      comprador: { ...form.comprador, endereco: { ...form.comprador.endereco, ...patch } },
    });
  const setConjuge = (patch: Partial<ParteForm>) =>
    onFormChange({ ...form, conjuge: { ...form.conjuge, ...patch } });
  const setConjugeEnd = (patch: Partial<ParteForm['endereco']>) =>
    onFormChange({
      ...form,
      conjuge: { ...form.conjuge, endereco: { ...form.conjuge.endereco, ...patch } },
    });

  const ecCasado =
    form.comprador.estado_civil === 'Casado(a)' ||
    form.comprador.estado_civil === 'União Estável';
  const mostrarConjuge = form.temConjuge || ecCasado;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Revise e complete os dados que serão usados no aditivo. Campos vazios podem vir nulos do
          Sienge — preencha manualmente quando necessário.
        </p>
        <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={loading || !billId}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          Recarregar
        </Button>
      </div>

      {/* Imóvel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dados do Imóvel</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Empreendimento">
            <Input value={form.empreendimento} readOnly className="bg-muted" />
          </Field>
          <Field label="Nº do Lote">
            <Input value={form.num_lote} onChange={(e) => onFormChange({ ...form, num_lote: e.target.value })} />
          </Field>
          <Field label="Área (m²)">
            <Input value={form.area} onChange={(e) => onFormChange({ ...form, area: e.target.value })} />
          </Field>
          <Field label="Matrícula">
            <Input value={form.matricula} onChange={(e) => onFormChange({ ...form, matricula: e.target.value })} />
          </Field>
          <Field label="Matrícula de origem">
            <Input
              value={form.matricula_origem}
              placeholder="ex: 45.146"
              onChange={(e) => onFormChange({ ...form, matricula_origem: e.target.value })}
            />
          </Field>
          <Field label="Valor antigo (R$)">
            <Input
              value={form.valor_antigo_matricula}
              placeholder="ex: 85000.00"
              onChange={(e) => onFormChange({ ...form, valor_antigo_matricula: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Valor total da dívida conforme consta na matrícula do lote no Cartório de Registro de Imóveis.
            </p>
          </Field>
          <Field label="Cidade do empreendimento">
            <Input value={form.cidade_empreendimento} onChange={(e) => onFormChange({ ...form, cidade_empreendimento: e.target.value })} />
          </Field>
          <Field label="UF do empreendimento">
            <Input value={form.estado_empreendimento} maxLength={2} onChange={(e) => onFormChange({ ...form, estado_empreendimento: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Ônus" className="sm:col-span-2">
            <Input value={form.onus} onChange={(e) => onFormChange({ ...form, onus: e.target.value })} />
          </Field>
        </CardContent>
      </Card>

      {/* Comprador principal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Comprador Principal</CardTitle>
        </CardHeader>
        <CardContent>
          <ParteFields parte={form.comprador} onChange={setComprador} onEndChange={setCompradorEnd} />
        </CardContent>
      </Card>

      {/* Toggle cônjuge */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="temConjuge"
          checked={mostrarConjuge}
          onCheckedChange={(c) => onFormChange({ ...form, temConjuge: !!c })}
        />
        <Label htmlFor="temConjuge" className="cursor-pointer">
          Incluir cônjuge / companheiro(a)
        </Label>
      </div>

      {mostrarConjuge && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cônjuge / Companheiro(a)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ParteFields parte={form.conjuge} onChange={setConjuge} onEndChange={setConjugeEnd} />
            <Field label="Data do casamento / união">
              <Input
                type="date"
                value={form.data_casamento}
                onChange={(e) => onFormChange({ ...form, data_casamento: e.target.value })}
              />
            </Field>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button onClick={onNext}>
          Próximo <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ParteFields({
  parte,
  onChange,
  onEndChange,
}: {
  parte: ParteForm;
  onChange: (p: Partial<ParteForm>) => void;
  onEndChange: (p: Partial<ParteForm['endereco']>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome completo" className="sm:col-span-2">
          <Input value={parte.nome} onChange={(e) => onChange({ nome: e.target.value })} />
        </Field>
        <Field label="CPF">
          <Input value={parte.cpf} onChange={(e) => onChange({ cpf: e.target.value })} />
        </Field>
        <Field label="Sexo">
          <Select value={parte.sexo} onValueChange={(v) => onChange({ sexo: v as 'M' | 'F' })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Masculino</SelectItem>
              <SelectItem value="F">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Nacionalidade">
          <Input value={parte.nacionalidade} onChange={(e) => onChange({ nacionalidade: e.target.value })} placeholder="brasileiro / brasileira" />
        </Field>
        <Field label="Estado civil">
          <Select value={parte.estado_civil} onValueChange={(v) => onChange({ estado_civil: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {ESTADO_CIVIL_OPTS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Regime de bens (se casado/união)">
          <Input
            value={parte.regime_bens}
            onChange={(e) => onChange({ regime_bens: e.target.value })}
            placeholder="comunhão parcial de bens"
          />
        </Field>
        <Field label="Profissão">
          <Input value={parte.profissao} onChange={(e) => onChange({ profissao: e.target.value })} />
        </Field>
        <Field label="Tipo de documento">
          <Input
            value={parte.tipo_documento}
            onChange={(e) => onChange({ tipo_documento: e.target.value })}
            placeholder="RG / CNH / Carteira de Habilitação"
          />
        </Field>
        <Field label="Nº do documento">
          <Input value={parte.rg} onChange={(e) => onChange({ rg: e.target.value })} />
        </Field>
        <Field label="Órgão emissor">
          <Input value={parte.orgao_emissor} onChange={(e) => onChange({ orgao_emissor: e.target.value })} placeholder="SSP/RS, DETRAN/RS..." />
        </Field>
        <Field label="Data de emissão">
          <Input
            type="date"
            value={(parte.data_emissao_rg ?? '').slice(0, 10)}
            onChange={(e) => onChange({ data_emissao_rg: e.target.value })}
          />
        </Field>
        <Field label="E-mail">
          <Input value={parte.email} onChange={(e) => onChange({ email: e.target.value })} />
        </Field>
        <Field label="Telefone">
          <Input value={parte.telefone} onChange={(e) => onChange({ telefone: e.target.value })} />
        </Field>
      </div>


      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Endereço</p>
        <div className="grid gap-3 sm:grid-cols-6">
          <Field label="Logradouro" className="sm:col-span-4">
            <Input value={parte.endereco.logradouro} onChange={(e) => onEndChange({ logradouro: e.target.value })} />
          </Field>
          <Field label="Número" className="sm:col-span-2">
            <Input value={parte.endereco.numero} onChange={(e) => onEndChange({ numero: e.target.value })} />
          </Field>
          <Field label="Bairro" className="sm:col-span-3">
            <Input value={parte.endereco.bairro} onChange={(e) => onEndChange({ bairro: e.target.value })} />
          </Field>
          <Field label="Cidade" className="sm:col-span-2">
            <Input value={parte.endereco.cidade} onChange={(e) => onEndChange({ cidade: e.target.value })} />
          </Field>
          <Field label="UF" className="sm:col-span-1">
            <Input value={parte.endereco.estado} onChange={(e) => onEndChange({ estado: e.target.value })} />
          </Field>
          <Field label="CEP" className="sm:col-span-2">
            <Input value={parte.endereco.cep} onChange={(e) => onEndChange({ cep: e.target.value })} />
          </Field>
        </div>
      </div>
    </div>
  );
}
