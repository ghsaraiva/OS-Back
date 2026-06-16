import pb, { authenticatePB } from '../config/pocketbase';
import { 
  DimensionamentoMinimoInput, 
  DimensionamentoMinimoOutput,
  SistemaRealInput,
  SistemaRealOutput,
  GeracaoERetornoInput,
  GeracaoERetornoOutput,
  LicenciamentoKitInput,
  LicenciamentoKitOutput,
  PrecoFinalInput,
  PrecoFinalOutput,
  SalvarRefinamentoInput,
  CriarSolicitacaoInput
} from '../models/calculos.model';

// Constantes de precificação para evitar números mágicos
export const TAXA_SEGURO = 0.015; // 1.5%
export const TAXA_IMPOSTO = 0.15; // 15%
// Ponto de quebra ocorre quando divisor = 0 (1 - L - 0.015 - 0.15 = 0 => L = 0.835)
export const MAX_LUCRO_LIQUIDO_PERMITIDO = 83.0; // 83% de margem é o limite seguro recomendado

export class CalculosService {
  private formatarMoeda(valor: number): number {
    return Number(valor.toFixed(2));
  }

  private calcularDimensionamentoInterno(mediacalcWh: number, consumo_mes: number, valor_tarifa: number) {
    const consumo_mensal_kwh = consumo_mes / valor_tarifa;
    const mediacalc = mediacalcWh / 1000;
    const hsp_mensal = mediacalc * 30;
    const kwp_minimo = consumo_mensal_kwh / hsp_mensal;

    return {
      consumo_mensal_kwh,
      mediacalc,
      hsp_mensal,
      kwp_minimo
    };
  }

  async calcularDimensionamentoMinimo(pbInstance: any, input: DimensionamentoMinimoInput): Promise<DimensionamentoMinimoOutput> {
    const { id_cidade, consumo_mes, valor_tarifa } = input;

    const record = await pbInstance.collection('cidades_hsp').getOne(id_cidade);

    if (!record) {
      throw new Error('HSP não encontrado para esta localidade');
    }

    const calculos = this.calcularDimensionamentoInterno(record.mediacalc, consumo_mes, valor_tarifa);

    return {
      consumo_mensal_kwh: this.formatarMoeda(calculos.consumo_mensal_kwh),
      mediacalc: calculos.mediacalc,
      hsp_mensal: this.formatarMoeda(calculos.hsp_mensal),
      kwp_minimo: this.formatarMoeda(calculos.kwp_minimo),
      localidade: { 
        cidade: record.cidade, 
        estado: record.estado 
      }
    };
  }

  calcularSistemaReal(input: SistemaRealInput): SistemaRealOutput {
    const { potencia_painel, quantidade_paineis } = input;
    const kwp_sistema = (potencia_painel * quantidade_paineis) / 1000;
    return { kwp_sistema: this.formatarMoeda(kwp_sistema) };
  }

  calcularGeracaoERetorno(input: GeracaoERetornoInput): GeracaoERetornoOutput {
    const { kwp_sistema, mediacalc, valor_tarifa, consumo_mes_rs, padrao, valor_investido, quantidade_paineis } = input;

    // 1. Geração Baseada em Irradiação (Sem o fator 0.7 conforme pedido)
    // mediacalc já vem como HSP Diário do front (ex: 4.276)
    const hsp_diario = mediacalc; 
    
    // Média do Mês (Valor real com decimais)
    const media_mes_kwh = kwp_sistema * hsp_diario * 30;
    const geracao_mensal_kwh = Math.round(media_mes_kwh); 
    const geracao_anual_kwh = media_mes_kwh * 12;

    // 2. Área Estimada (Fator 2.5 solicitado)
    const area_estimada = (quantidade_paineis || 0) * 2.5;

    // 3. Economia e Valor Pago (Nova Regra baseada em TUSD)
    // TUSD = Valor do kWh * Geração * 0.51
    // Imposto = TUSD * 0.18
    // Fio B = TUSD * 0.22
    // Valor pago mês = Fio B + Imposto
    
    const tusd_interno = valor_tarifa * media_mes_kwh * 0.51;
    const imposto_faturamento = tusd_interno * 0.18;
    const fio_b_faturamento = tusd_interno * 0.22;
    
    // O valor pago é a soma dos encargos sobre a geração (Fio B + Impostos TUSD)
    // Nota: Se houver consumo excedente (Geração < Consumo), somamos a diferença.
    const consumo_kwh = consumo_mes_rs / valor_tarifa;
    const saldo_devedor_kwh = Math.max(consumo_kwh - media_mes_kwh, 0);
    const custo_energia_restante = saldo_devedor_kwh * valor_tarifa;

    const valor_pago_mes = this.formatarMoeda(custo_energia_restante + imposto_faturamento + fio_b_faturamento);
    const valor_pago_ano = this.formatarMoeda(valor_pago_mes * 12);

    // 4. Redução Real e Retorno Financeiro
    const economia_mensal_rs = this.formatarMoeda(consumo_mes_rs - valor_pago_mes);
    const economia_anual_rs = this.formatarMoeda(economia_mensal_rs * 12);
    const porcentagem_reducao = Number((economia_mensal_rs / (consumo_mes_rs || 1)).toFixed(2));

    // Payback = Valor Investido / Economia Mensal
    let tempo_retorno = "N/A";
    if (economia_mensal_rs > 0 && valor_investido > 0) {
      const mesesTotal = valor_investido / economia_mensal_rs;
      let anos = Math.floor(mesesTotal / 12);
      let mesesRemaining = Math.ceil(mesesTotal % 12); 

      if (mesesRemaining === 12) {
        anos += 1;
        mesesRemaining = 0;
      }
      
      let tempoStr = "";
      if (anos > 0) tempoStr += `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
      if (mesesRemaining > 0) tempoStr += `${tempoStr ? ' e ' : ''}${mesesRemaining} ${mesesRemaining === 1 ? 'mês' : 'meses'}`;
      if (!tempoStr) tempoStr = "Imediato";
      tempo_retorno = tempoStr;
    }

    const result = {
      hsp_diario: Number(hsp_diario.toFixed(3)),
      hsp_mensal: Number((hsp_diario * 30).toFixed(2)),
      geracao_mensal_kwh, 
      geracao_anual_kwh: Number(geracao_anual_kwh.toFixed(2)),
      area_estimada: Number(area_estimada.toFixed(2)),
      porcentagem_reducao,
      valor_pago_mes,
      valor_pago_ano,
      economia_mensal_rs,
      economia_anual_rs,
      tempo_retorno,
      media_mes_kwh: Number(media_mes_kwh.toFixed(2))
    };
    
    return result;
  }

  // Seção 3: Dinâmica do Kit
  calcularLicenciamentoKit(input: LicenciamentoKitInput): LicenciamentoKitOutput {
    const { valorKit, valorPorcentagem } = input;
    const lucroEquipamentoFinal = valorKit * (valorPorcentagem / 100);
    const valorKitLicenciado = valorKit + lucroEquipamentoFinal;

    return {
      lucroEquipamentoFinal: this.formatarMoeda(lucroEquipamentoFinal),
      valorKitLicenciado: this.formatarMoeda(valorKitLicenciado)
    };
  }

  // Seção 4: Cascata do Projeto (Matemática Corrigida)
  calcularPrecoFinal(input: PrecoFinalInput): PrecoFinalOutput {
    const { 
      valorKitLicenciado, 
      valorMaoDeObra, 
      valorEquipamentoLocal, 
      valorHomologacao, 
      porcentagemLucroLiquido,
      quantidade_paineis
    } = input;

    if (porcentagemLucroLiquido > MAX_LUCRO_LIQUIDO_PERMITIDO) {
      throw new Error(`A porcentagem de lucro líquido desejada excede o limite máximo permitido de ${MAX_LUCRO_LIQUIDO_PERMITIDO}%.`);
    }

    const valorMaoDeObraTotal = valorMaoDeObra * (quantidade_paineis || 0);
    const valorEquipamentoLocalTotal = valorEquipamentoLocal * (quantidade_paineis || 0);

    const custoDireto = valorKitLicenciado + valorMaoDeObraTotal + valorEquipamentoLocalTotal + valorHomologacao;
    const margemSeguranca = (valorKitLicenciado / 0.97) - valorKitLicenciado;
    const divisor = 1 - (porcentagemLucroLiquido / 100) - TAXA_SEGURO - TAXA_IMPOSTO;
    const precoFinalSugerido = (custoDireto + margemSeguranca - (TAXA_IMPOSTO * valorKitLicenciado)) / divisor;

    const seguro = precoFinalSugerido * TAXA_SEGURO;
    const lucroLiquidoRs = precoFinalSugerido * (porcentagemLucroLiquido / 100);
    const imposto = (precoFinalSugerido - valorKitLicenciado) * TAXA_IMPOSTO;
    const custoProjeto = precoFinalSugerido - lucroLiquidoRs;

    return {
      custoDireto: this.formatarMoeda(custoDireto),
      custoProjeto: this.formatarMoeda(custoProjeto),
      margemSeguranca: this.formatarMoeda(margemSeguranca),
      seguro: this.formatarMoeda(seguro),
      lucroLiquidoRs: this.formatarMoeda(lucroLiquidoRs),
      imposto: this.formatarMoeda(imposto),
      precoFinalSugerido: this.formatarMoeda(precoFinalSugerido),
      valorMaoDeObraTotal: this.formatarMoeda(valorMaoDeObraTotal),
      valorEquipamentoLocalTotal: this.formatarMoeda(valorEquipamentoLocalTotal)
    };
  }

  async criarSolicitacaoInicial(pbInstance: any, input: CriarSolicitacaoInput): Promise<any> {
    const { id_cidade, consumo_mes, valor_tarifa } = input;

    const recordCidade = await pbInstance.collection('cidades_hsp').getOne(id_cidade);

    if (!recordCidade) {
      throw new Error('Localidade não encontrada para cálculo de HSP.');
    }

    const calculos = this.calcularDimensionamentoInterno(recordCidade.mediacalc, consumo_mes, valor_tarifa);
    const kwp_minimo = this.formatarMoeda(calculos.kwp_minimo);

    const payload = {
      ...input,
      kwp_minimo,
      situacao: 'Aberto'
    };

    const record = await pbInstance.collection('orcamentos').create(payload);
    return record;
  }

  async salvarRefinamentoGerencial(pbInstance: any, input: SalvarRefinamentoInput): Promise<any> {
    const { 
      orcamentoId,
      potencia_painel,
      quantidade_paineis,
      peso_painel,
      marca_modulo,
      quantidade_inversores,
      potencia_inversor,
      modelo_inversor,
      marca_inversor,
      tensao_inversor,
      valorKit,
      valorPorcentagem,
      valorMaoDeObra,
      valorEquipamentoLocal,
      valorHomologacao,
      porcentagemLucroLiquido,
      kwp_minimo,
      kwp_sistema,
      valor_kit_final,
      lucro_equipamento,
      valor_mao_obra_final,
      valor_equip_local_final,
      seguro,
      custo_projeto,
      imposto,
      margem_seguranca,
      lucro_liquido_previsto,
      preco_final_venda,
      situacao,
      observacao,
      area_estimada,
      geracao_mes,
      geracao_ano,
      valor_pago_mes,
      valor_pago_ano,
      porcentagem_reducao,
      tempo_retorno,
      garantia_fabrica_modulo,
      garantia_eficiencia_modulo,
      garantia_inversor,
      garantia_instalacao,
      garantia_estrutura,
      monitoramento_inversor,
      material_estrutura,
      caracteristica_estrutura_1,
      caracteristica_estrutura_2,
      caracteristica_estrutura_3,
      caracteristica_estrutura_4,
      caracteristica_estrutura_5,
      composicao_1,
      composicao_2,
      composicao_3,
      composicao_4,
      composicao_5,
      nome_cliente,
      id_cidade,
      cidade,
      estado,
      estrutura,
      padrao,
      consumo_mes,
      valor_tarifa
    } = input;

    const orcamentoOriginal = await pbInstance.collection('orcamentos').getOne(orcamentoId);
    if (!orcamentoOriginal) {
      throw new Error('Orçamento não encontrado.');
    }

    const kwpSistemaVal = typeof kwp_sistema === 'number' ? kwp_sistema : (parseFloat(kwp_sistema) || 0);
    const composicao1 = `${quantidade_paineis} Painéis, ${marca_modulo}, ${kwpSistemaVal.toFixed(2)} kWp`;

    const payloadPocketBase = {
      nome_cliente: nome_cliente !== undefined ? nome_cliente : orcamentoOriginal.nome_cliente,
      id_cidade: id_cidade !== undefined ? id_cidade : orcamentoOriginal.id_cidade,
      cidade: cidade !== undefined ? cidade : orcamentoOriginal.cidade,
      estado: estado !== undefined ? estado : orcamentoOriginal.estado,
      estrutura: estrutura !== undefined ? estrutura : orcamentoOriginal.estrutura,
      padrao: padrao !== undefined ? padrao : orcamentoOriginal.padrao,
      consumo_mes: consumo_mes !== undefined ? consumo_mes : orcamentoOriginal.consumo_mes,
      valor_tarifa: valor_tarifa !== undefined ? valor_tarifa : orcamentoOriginal.valor_tarifa,
      potencia_painel,
      qtd_paineis: quantidade_paineis,
      peso_painel,
      marca_painel: marca_modulo,
      valor_kit: valorKit,
      porcentagem_kit: valorPorcentagem,
      lucro_liquido_perc: porcentagemLucroLiquido,
      mao_obra: valorMaoDeObra,
      equipamento_local: valorEquipamentoLocal,
      valor_homologacao: valorHomologacao,
      chpzdpth: composicao1,
      observacao: observacao || orcamentoOriginal.observacao,
      
      qtd_inversores: quantidade_inversores,
      potencia_inversor,
      modelo_inversor: modelo_inversor || "",
      marca_inversor: marca_inversor || "",
      tensao_inversor: typeof tensao_inversor === 'string' ? (parseInt(tensao_inversor) || 0) : (tensao_inversor || 0),

      kwp_minimo,
      kwp_sistema,
      valor_kit_final,
      lucro_equipamento,
      valor_mao_obra_final,
      valor_equip_local_final,
      seguro,
      custo_projeto,
      imposto,
      margem_seguranca,
      lucro_liquido_previsto,
      preco_final_venda,
      situacao: situacao || orcamentoOriginal.situacao || "Aberto",
      area_estimada,
      geracao_mes,
      geracao_ano,
      valor_pago_mes,
      valor_pago_ano,
      porcentagem_reducao,
      tempo_retorno,

      // Novos campos de Garantias e Suporte
      garantia_fabrica_modulo,
      garantia_eficiencia_modulo,
      garantia_inversor,
      garantia_instalacao,
      garantia_estrutura,
      monitoramento_inversor,
      material_structure: material_estrutura,

      // Novos campos de Características da Estrutura
      caracteristica_estrutura_1,
      caracteristica_estrutura_2,
      caracteristica_estrutura_3,
      caracteristica_estrutura_4,
      caracteristica_estrutura_5,

      // Novos campos de Composição
      composicao_1,
      composicao_2,
      composicao_3,
      composicao_4,
      composicao_5
    };

    const registroAtualizado = await pbInstance.collection('orcamentos').update(orcamentoId, payloadPocketBase);
    return registroAtualizado;
  }

  async obterMetricasDashboard(pbInstance: any, userId?: string, isAdmin?: boolean): Promise<any> {
    
    let filter = '';
    if (!isAdmin && userId) {
      filter = `user_id = "${userId}"`;
    }

    // Buscamos apenas os campos necessários (id, situacao, nome_cliente, estado) para poupar rede/banco
    const records = await pbInstance.collection('orcamentos').getFullList({
      filter,
      fields: 'id,situacao,nome_cliente,estado,user_id'
    });

    const total = records.length;
    const abertos = records.filter((r: any) => r.situacao === 'Aberto').length;
    const concluidos = records.filter((r: any) => r.situacao === 'Técnico Finalizado').length;
    const uniqueClientNames = new Set(
      records
        .map((r: any) => r.nome_cliente ? r.nome_cliente.trim().toLowerCase() : '')
        .filter(Boolean)
    );
    const clientes = uniqueClientNames.size;

    // Calcular dados demográficos
    const stats: Record<string, number> = {};
    records.forEach((r: any) => {
      if (r.estado) {
        const estado = r.estado.toUpperCase();
        stats[estado] = (stats[estado] || 0) + 1;
      }
    });

    const demographics = Object.entries(stats)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4); // Top 4 UFs como no DemographicCard

    return {
      kpis: {
        total,
        abertos,
        concluidos,
        clientes
      },
      demographics
    };
  }

  async obterTodosUsuarios(pbInstance: any): Promise<any> {
    const records = await pbInstance.collection('users').getFullList();
    return records;
  }

  async listarTodosOrcamentos(pbInstance: any, userId?: string, isAdmin?: boolean): Promise<any> {
    let filter = '';
    if (!isAdmin && userId) {
      filter = `user_id = "${userId}"`;
    }
    const records = await pbInstance.collection('orcamentos').getFullList({
      sort: '-created',
      expand: 'user_id',
      filter
    });
    return records;
  }

  async obterCidadesHSP(pbInstance: any, search?: string): Promise<any> {
    let filter = '';
    if (search) {
      const lowerSearch = search.trim().toLowerCase();
      filter = pbInstance.filter('cidade ~ {:search} || estado ~ {:search}', { search: lowerSearch });
    }
    const records = await pbInstance.collection('cidades_hsp').getFullList({
      filter,
      sort: 'cidade'
    });
    return records;
  }

  async obterOrcamentoPorId(pbInstance: any, id: string): Promise<any> {
    const record = await pbInstance.collection('orcamentos').getOne(id, {
      expand: 'user_id'
    });
    return record;
  }

  async criarNovoUsuario(pbInstance: any, input: any): Promise<any> {
    const record = await pbInstance.collection('users').create(input);
    return record;
  }

  async obterCidadePorId(pbInstance: any, id: string): Promise<any> {
    const record = await pbInstance.collection('cidades_hsp').getOne(id);
    return record;
  }

  async atualizarOrcamentoParcial(pbInstance: any, id: string, data: any): Promise<any> {
    const record = await pbInstance.collection('orcamentos').update(id, data);
    return record;
  }
}

export default new CalculosService();
