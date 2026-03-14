export interface Parcela {
  /** Original row index from spreadsheet */
  rowIndex: number;
  /** Renumbered installment number (entry excluded) */
  numero: number;
  dataVencimento: Date;
  /** Par column from report */
  parcelaOriginal: string;
  tipoCondicao: string;
  valorOriginal: number;
  saldoAtual: number;
  /** Whether this is the entry payment */
  isEntrada: boolean;
}

export interface NovaParcela {
  numero: number;
  dataVencimento: Date;
  valor: number;
}

export interface ContractState {
  // Step 1
  templateFile: File | null;
  reportFile: File | null;
  taxaJuros: number;
  custosAdicionais: number;
  // Parsed data
  parcelas: Parcela[];
  // Step 2
  selectedParcelaIds: Set<number>; // rowIndex set
  // Step 3
  numNovasParcelas: number;
  dataInicioVencimento: Date | null;
  novasParcelas: NovaParcela[];
  // Derived
  pvTotal: number;
  pmtValue: number;
  totalJuros: number;
  valorTotalRenegociado: number;
}
