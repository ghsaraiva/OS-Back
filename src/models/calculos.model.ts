export interface DimensionamentoMinimoInput {
  nome_cliente?: string;
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
  valorHomologacao: number;
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
}

export interface CriarSolicitacaoInput {
  user_id: string;
  nome_cliente: string;
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
  valorPorcentagem: number;
  valorMaoDeObra: number;
  valorEquipamentoLocal: number;
  valorHomologacao: number;
  porcentagemLucroLiquido: number;
  observacao?: string;
  
  // Novos campos calculados (Pass-through do Front-end)
  kwp_minimo: number;
  kwp_sistema: number;
  valor_kit_final: number;
  lucro_equipamento: number;
  valor_mao_obra_final: number;
  valor_equip_local_final: number;
  seguro: number;
  custo_projeto: number;
  imposto: number;
  margem_seguranca: number;
  lucro_liquido_previsto: number;
  preco_final_venda: number;
  situacao: string;

  // Novos campos de Sistema e Geração
  area_estimada?: number;
  geracao_mes?: number;
  geracao_ano?: number;
  valor_pago_mes?: number;
  valor_pago_ano?: number;
  porcentagem_reducao?: number;
  tempo_retorno?: string;

  // Novos campos de Garantias e Suporte
  garantia_fabrica_modulo?: string;
  garantia_eficiencia_modulo?: string;
  garantia_inversor?: string;
  garantia_instalacao?: string;
  garantia_estrutura?: string;
  monitoramento_inversor?: string;
  material_estrutura?: string;

  // Novos campos de Características da Estrutura
  caracteristica_estrutura_1?: string;
  caracteristica_estrutura_2?: string;
  caracteristica_estrutura_3?: string;
  caracteristica_estrutura_4?: string;
  caracteristica_estrutura_5?: string;

  // Novos campos de Composição
  composicao_1?: string;
  composicao_2?: string;
  composicao_3?: string;
  composicao_4?: string;
  composicao_5?: string;
}
