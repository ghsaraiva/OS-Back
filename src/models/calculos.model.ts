export interface DimensionamentoMinimoInput {
  nome_cliente?: string;
  telefone_cliente?: string;
  email_cliente?: string;
  cidade: string;
  estado: string;
  id_cidade: string;
  observacao?: string;
  estrutura?: string;
  padrao?: string;
  consumo_mes: number;
  valor_tarifa: number;
}

export interface DimensionamentoMinimoOutput {
  consumo_mensal_kwh: number;
  mediacalc: number;
  hsp_mensal: number;
  kwp_minimo: number;
  localidade: {
    cidade: string;
    estado: string;
  };
}

export interface SistemaRealInput {
  potencia_painel: number;
  quantidade_paineis: number;
}

export interface SistemaRealOutput {
  kwp_sistema: number;
}

export interface GeracaoERetornoInput {
  kwp_sistema: number;
  mediacalc: number;
  valor_tarifa: number;
  consumo_mes_rs: number;
  padrao: string;
  valor_investido: number;
  quantidade_paineis: number;
}

export interface GeracaoERetornoOutput {
  hsp_diario: number;
  hsp_mensal: number;
  geracao_mensal_kwh: number;
  geracao_anual_kwh: number;
  area_estimada: number;
  porcentagem_reducao: number;
  valor_pago_mes: number;
  valor_pago_ano: number;
  economia_mensal_rs: number;
  economia_anual_rs: number;
  tempo_retorno: string;
  media_mes_kwh: number;
}

// Seção 3: Dinâmica do Kit
export interface LicenciamentoKitInput {
  valorKit: number;
  valorPorcentagem: number;
}

export interface LicenciamentoKitOutput {
  lucroEquipamentoFinal: number;
  valorKitLicenciado: number;
}

// Seção 4: Cascata do Projeto (Corrigida)
export interface PrecoFinalInput {
  valorKitLicenciado: number;
  valorMaoDeObra: number; // Valor por painel
  valorEquipamentoLocal: number; // Valor por painel
  valorHomologacao?: number;
  quantidade_inversores?: number;
  potencia_inversor?: number;
  porcentagemLucroLiquido: number;
  quantidade_paineis: number;
}

export interface PrecoFinalOutput {
  custoProjeto: number; // Agora será a soma de tudo exceto o lucro
  margemSeguranca: number;
  seguro: number;
  lucroLiquidoRs: number;
  imposto: number;
  precoFinalSugerido: number;
  valorMaoDeObraTotal: number;
  valorEquipamentoLocalTotal: number;
  custoDireto: number; // Novo campo para o custo bruto sem impostos/margem
  valorHomologacaoCalculado: number;
}

export interface CriarSolicitacaoInput {
  user_id: string;
  nome_cliente: string;
  telefone_cliente?: string;
  email_cliente?: string;
  estado: string;
  cidade: string;
  id_cidade: string;
  consumo_mes: number;
  valor_tarifa: number;
  estrutura: string;
  padrao: string;
  observacao?: string;
}

export interface SalvarRefinamentoInput {
  orcamentoId: string;
  potencia_painel: number;
  quantidade_paineis: number;
  peso_painel: number;
  marca_modulo: string;
  quantidade_inversores: number;
  potencia_inversor: number;
  modelo_inversor: string;
  marca_inversor: string;
  tensao_inversor: any; // Pode vir como string do form e ser convertida
  valorKit: number;
  nome_cliente?: string;
  telefone_cliente?: string;
  email_cliente?: string;
  id_cidade?: string;
  cidade?: string;
  estado?: string;
  estrutura?: string;
  padrao?: string;
  consumo_mes?: number;
  valor_tarifa?: number;
  valorPorcentagem: number;
  valorMaoDeObra: number;
  valorEquipamentoLocal: number;
  valorHomologacao: number;
  porcentagemLucroLiquido: number;
  observacao?: string;

  // Novos campos de Sistema e Geração (Mantemos apenas os inputs)
  area_estimada?: number;

  // Novos campos de Garantias e Suporte
  garantia_fabrica_modulo?: string;
  garantia_eficiencia_modulo?: string;
  garantia_inversor?: string;
  garantia_instalacao?: string;
  garantia_estrutura?: string;
  monitoramento_inversor?: string;
  material_structure?: string;

  // Novos campos de Características da Estrutura
  caracteristica_estrutura_1?: string;
  caracteristica_estrutura_2?: string;
  caracteristica_estrutura_3?: string;
  caracteristica_estrutura_4?: string;
  caracteristica_estrutura_5?: string;

  // Novos campos de Composição (Serão gerados no backend, mas mantidos opcionais caso ainda passem)
}

export interface AtualizarPrecoVendaInput {
  preco_final_venda: number;
}

export interface ConfigMargensLucroOutput {
  opcoes: { value: string; label: string }[];
  min: number;
  max: number;
}
