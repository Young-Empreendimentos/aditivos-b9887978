export interface EnderecoForm {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export interface ParteForm {
  nome: string;
  cpf: string;
  nacionalidade: string;
  estado_civil: string;
  profissao: string;
  rg: string;
  orgao_emissor: string;
  data_emissao_rg: string;
  email: string;
  telefone: string;
  endereco: EnderecoForm;
  sexo: 'M' | 'F' | '';
  tipo_documento: string; // RG, CNH, etc.
  regime_bens: string;    // ex: "comunhão parcial de bens"
}

export interface DadosContratoForm {
  // Imóvel
  empreendimento: string;
  num_lote: string;
  area: string;
  matricula: string;
  onus: string;
  cidade_empreendimento: string;
  estado_empreendimento: string;
  // Contrato (de Step1/Step2)
  numero_contrato: string;
  data_contrato: string; // ISO yyyy-mm-dd
  valor_total: string;
  // Partes
  comprador: ParteForm;
  temConjuge: boolean;
  conjuge: ParteForm;
  data_casamento: string;
}

export function emptyParte(): ParteForm {
  return {
    nome: "",
    cpf: "",
    nacionalidade: "",
    estado_civil: "",
    profissao: "",
    rg: "",
    orgao_emissor: "",
    data_emissao_rg: "",
    email: "",
    telefone: "",
    endereco: { logradouro: "", numero: "", bairro: "", cidade: "", estado: "", cep: "" },
    sexo: "",
    tipo_documento: "RG",
    regime_bens: "",
  };
}

export function emptyDadosContratoForm(): DadosContratoForm {
  return {
    empreendimento: "",
    num_lote: "",
    area: "",
    matricula: "",
    onus: "",
    cidade_empreendimento: "",
    estado_empreendimento: "",
    numero_contrato: "",
    data_contrato: "",
    valor_total: "",
    comprador: emptyParte(),
    temConjuge: false,
    conjuge: emptyParte(),
    data_casamento: "",
  };
}
