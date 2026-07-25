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
  CriarSolicitacaoInput,
  ConfigMargensLucroOutput
} from '../models/calculos.model';
import { CalculosDataFetcher } from './calculos.dataFetcher';
import { CalculosProcess } from './calculos.process';
import { CalculosFormatter } from './calculos.formatter';
import { formatarMoeda, TAXA_SEGURO, TAXA_IMPOSTO } from '../utils/calculos.utils';

export class CalculosService {
  async calcularDimensionamentoMinimo(pbInstance: any, input: DimensionamentoMinimoInput): Promise<DimensionamentoMinimoOutput> {
    const { id_cidade, consumo_mes, valor_tarifa } = input;
    const record = await CalculosDataFetcher.obterCidadePorId(pbInstance, id_cidade);

    const calculos = CalculosProcess.calcularDimensionamentoInterno(record.mediacalc, consumo_mes, valor_tarifa);

    return {
      consumo_mensal_kwh: formatarMoeda(calculos.consumo_mensal_kwh),
      mediacalc: calculos.mediacalc,
      hsp_mensal: formatarMoeda(calculos.hsp_mensal),
      kwp_minimo: formatarMoeda(calculos.kwp_minimo),
      localidade: { 
        cidade: record.cidade, 
        estado: record.estado 
      }
    };
  }

  calcularSistemaReal(input: SistemaRealInput): SistemaRealOutput {
    return CalculosProcess.calcularSistemaReal(input);
  }

  calcularGeracaoERetorno(input: GeracaoERetornoInput): GeracaoERetornoOutput {
    return CalculosProcess.calcularGeracaoERetorno(input);
  }

  calcularLicenciamentoKit(input: LicenciamentoKitInput): LicenciamentoKitOutput {
    return CalculosProcess.calcularLicenciamentoKit(input);
  }

  calcularPrecoFinal(input: PrecoFinalInput): PrecoFinalOutput {
    return CalculosProcess.calcularPrecoFinal(input);
  }

  calcularValorHomologacao(potenciaInversor: number): number {
    if (potenciaInversor <= 10) return 500;
    if (potenciaInversor <= 20) return 750;
    if (potenciaInversor <= 40) return 1200;
    if (potenciaInversor <= 50) return 1700;
    if (potenciaInversor <= 75) return 2500;
    return 10000;
  }

  async criarSolicitacaoInicial(pbInstance: any, input: CriarSolicitacaoInput): Promise<any> {
    const { id_cidade, consumo_mes, valor_tarifa } = input;
    const recordCidade = await CalculosDataFetcher.obterCidadePorId(pbInstance, id_cidade);

    const calculos = CalculosProcess.calcularDimensionamentoInterno(recordCidade.mediacalc, consumo_mes, valor_tarifa);
    const kwp_minimo = formatarMoeda(calculos.kwp_minimo);

    const payload = {
      ...input,
      kwp_minimo,
      situacao: 'Aberto'
    };

    return await CalculosDataFetcher.criarOrcamento(pbInstance, payload);
  }

  async salvarRefinamentoGerencial(pbInstance: any, input: SalvarRefinamentoInput): Promise<any> {
    const orcamentoOriginal = await CalculosDataFetcher.obterOrcamentoPorId(pbInstance, input.orcamentoId);
    
    const resolvedIdCidade = input.id_cidade || orcamentoOriginal.id_cidade;
    const resolvedConsumoMes = input.consumo_mes !== undefined ? input.consumo_mes : orcamentoOriginal.consumo_mes;
    const resolvedValorTarifa = input.valor_tarifa !== undefined ? input.valor_tarifa : orcamentoOriginal.valor_tarifa;
    const resolvedPadrao = input.padrao || orcamentoOriginal.padrao || 'Trifásico';

    const recordCidade = await CalculosDataFetcher.obterCidadePorId(pbInstance, resolvedIdCidade);
    const mediacalcNormalizado = CalculosFormatter.normalizarHSP(recordCidade.mediacalc);
    
    const dimInterno = CalculosProcess.calcularDimensionamentoInterno(mediacalcNormalizado * 1000, resolvedConsumoMes, resolvedValorTarifa);
    const kwp_minimo = formatarMoeda(dimInterno.kwp_minimo);

    const sistemaReal = CalculosProcess.calcularSistemaReal({ 
      potencia_painel: input.potencia_painel, 
      quantidade_paineis: input.quantidade_paineis 
    });
    const kwp_sistema = sistemaReal.kwp_sistema;

    const licenciamento = CalculosProcess.calcularLicenciamentoKit({ 
      valorKit: input.valorKit, 
      valorPorcentagem: input.valorPorcentagem || 0 
    });

    const valorHomologacaoCalculado = CalculosProcess.calcularValorHomologacao(
      input.quantidade_inversores,
      input.potencia_inversor
    );

    const cascata = CalculosProcess.calcularPrecoFinal({
      valorKitLicenciado: licenciamento.valorKitLicenciado,
      valorMaoDeObra: input.valorMaoDeObra,
      valorEquipamentoLocal: input.valorEquipamentoLocal,
      valorHomologacao: valorHomologacaoCalculado,
      porcentagemLucroLiquido: input.porcentagemLucroLiquido,
      quantidade_paineis: input.quantidade_paineis,
    });

    const retorno = CalculosProcess.calcularGeracaoERetorno({
      kwp_sistema,
      mediacalc: mediacalcNormalizado,
      valor_tarifa: resolvedValorTarifa,
      consumo_mes_rs: resolvedConsumoMes,
      padrao: resolvedPadrao,
      valor_investido: cascata.precoFinalSugerido,
      quantidade_paineis: input.quantidade_paineis,
    });

    const formComercial = CalculosFormatter.formatarComposicaoComercial(
      input.quantidade_paineis,
      input.marca_modulo,
      input.potencia_painel,
      input.quantidade_inversores,
      input.marca_inversor || '',
      input.modelo_inversor || '',
      input.potencia_inversor,
      kwp_sistema
    );

    const potenciaInversorVal = typeof potencia_inversor === 'number' ? potencia_inversor : (parseFloat(potencia_inversor) || 0);
    const qtdInversoresVal = typeof quantidade_inversores === 'number' ? quantidade_inversores : (parseInt(quantidade_inversores) || 1);
    const potenciaTotal = potenciaInversorVal * qtdInversoresVal;
    const calculatedHomologacao = this.calcularValorHomologacao(potenciaTotal);

    const payloadPocketBase = {
      nome_cliente: input.nome_cliente !== undefined ? input.nome_cliente : orcamentoOriginal.nome_cliente,
      id_cidade: resolvedIdCidade,
      cidade: input.cidade !== undefined ? input.cidade : orcamentoOriginal.cidade,
      estado: input.estado !== undefined ? input.estado : orcamentoOriginal.estado,
      estrutura: input.estrutura !== undefined ? input.estrutura : orcamentoOriginal.estrutura,
      padrao: resolvedPadrao,
      consumo_mes: resolvedConsumoMes,
      valor_tarifa: resolvedValorTarifa,
      potencia_painel: input.potencia_painel,
      qtd_paineis: input.quantidade_paineis,
      peso_painel: input.peso_painel,
      marca_painel: input.marca_modulo,
      valor_kit: input.valorKit,
      porcentagem_kit: input.valorPorcentagem,
      lucro_liquido_perc: input.porcentagemLucroLiquido,
      mao_obra: input.valorMaoDeObra,
      equipamento_local: input.valorEquipamentoLocal,
      valor_homologacao: valorHomologacaoCalculado,
      chpzdpth: formComercial.composicao_resumo,
      observacao: input.observacao || orcamentoOriginal.observacao,

      qtd_inversores: input.quantidade_inversores,
      potencia_inversor: input.potencia_inversor,
      modelo_inversor: input.modelo_inversor || '',
      marca_inversor: input.marca_inversor || '',
      tensao_inversor: typeof input.tensao_inversor === 'string' ? (parseInt(input.tensao_inversor) || 0) : (input.tensao_inversor || 0),

      kwp_minimo,
      kwp_sistema,
      valor_kit_final: licenciamento.valorKitLicenciado,
      lucro_equipamento: licenciamento.lucroEquipamentoFinal,
      valor_mao_obra_final: cascata.valorMaoDeObraTotal,
      valor_equip_local_final: cascata.valorEquipamentoLocalTotal,
      seguro: cascata.seguro,
      custo_projeto: cascata.custoProjeto,
      imposto: cascata.imposto,
      margem_seguranca: cascata.margemSeguranca,
      lucro_liquido_previsto: cascata.lucroLiquidoRs,
      preco_final_venda: cascata.precoFinalSugerido,
      situacao: orcamentoOriginal.situacao || 'Aberto',
      area_estimada: retorno.area_estimada,
      geracao_mes: retorno.media_mes_kwh,
      geracao_ano: retorno.geracao_anual_kwh,
      valor_pago_mes: retorno.valor_pago_mes,
      valor_pago_ano: retorno.valor_pago_ano,
      porcentagem_reducao: retorno.porcentagem_reducao,
      tempo_retorno: retorno.tempo_retorno,

      garantia_fabrica_modulo: input.garantia_fabrica_modulo,
      garantia_eficiencia_modulo: input.garantia_eficiencia_modulo,
      garantia_inversor: input.garantia_inversor,
      garantia_instalacao: input.garantia_instalacao,
      garantia_estrutura: input.garantia_estrutura,
      monitoramento_inversor: input.monitoramento_inversor,
      material_structure: input.material_estrutura,

      caracteristica_estrutura_1: input.caracteristica_estrutura_1,
      caracteristica_estrutura_2: input.caracteristica_estrutura_2,
      caracteristica_estrutura_3: input.caracteristica_estrutura_3,
      caracteristica_estrutura_4: input.caracteristica_estrutura_4,
      caracteristica_estrutura_5: input.caracteristica_estrutura_5,

      composicao_1: formComercial.composicao_1,
      composicao_2: formComercial.composicao_2,
      composicao_3: formComercial.composicao_3,
      composicao_4: '',
      composicao_5: '',
    };

    return await CalculosDataFetcher.atualizarOrcamento(pbInstance, input.orcamentoId, payloadPocketBase);
  }

  async obterMetricasDashboard(pbInstance: any, userId?: string, isAdmin?: boolean): Promise<any> {
    let filter = '';
    if (!isAdmin && userId) {
      filter = `user_id = "${userId}"`;
    }
    
    const records = await CalculosDataFetcher.listarOrcamentosSimplificados(pbInstance, filter);
    const processado = CalculosProcess.processarMetricasDashboard(records);
    return CalculosFormatter.formatarDashboardResult(
      processado.total, 
      processado.abertos, 
      processado.concluidos, 
      processado.clientes, 
      processado.stats
    );
  }

  async atualizarPrecoVenda(pbInstance: any, id: string, preco_final_venda: number): Promise<any> {
    const orcamento = await CalculosDataFetcher.obterOrcamentoPorId(pbInstance, id);

    const seguro = formatarMoeda(preco_final_venda * TAXA_SEGURO);
    const kitLicenciado = orcamento.valor_kit_final || 0;
    const imposto = formatarMoeda(Math.max(preco_final_venda - kitLicenciado, 0) * TAXA_IMPOSTO);
    const margemSeguranca = orcamento.margem_seguranca || 0;
    const custoDireto =
      (orcamento.valor_kit_final || 0) +
      (orcamento.valor_mao_obra_final || 0) +
      (orcamento.valor_equip_local_final || 0) +
      (orcamento.valor_homologacao || 0);
    const custoProjeto = formatarMoeda(custoDireto + margemSeguranca + seguro + imposto);
    const lucroLiquidoPrevisto = formatarMoeda(preco_final_venda - custoProjeto);
    const lucroLiquidoPerc = formatarMoeda(preco_final_venda > 0 ? (lucroLiquidoPrevisto / preco_final_venda) * 100 : 0);

    const updateData = {
      preco_final_venda,
      seguro,
      imposto,
      custo_projeto: custoProjeto,
      lucro_liquido_previsto: lucroLiquidoPrevisto,
      lucro_liquido_perc: lucroLiquidoPerc,
    };

    return await CalculosDataFetcher.atualizarOrcamento(pbInstance, id, updateData);
  }

  async obterTodosUsuarios(pbInstance: any): Promise<any> {
    return await CalculosDataFetcher.listarUsuarios(pbInstance);
  }

  async listarTodosOrcamentos(pbInstance: any, userId?: string, isAdmin?: boolean): Promise<any> {
    let filter = '';
    if (!isAdmin && userId) {
      filter = `user_id = "${userId}"`;
    }
    return await CalculosDataFetcher.listarOrcamentos(pbInstance, filter);
  }

  async obterCidadesHSP(pbInstance: any, search?: string): Promise<any> {
    const records = await CalculosDataFetcher.obterCidadesHSP(pbInstance, search);
    return records.map((r: any) => ({
      ...r,
      mediacalc: CalculosFormatter.normalizarHSP(r.mediacalc)
    }));
  }

  async obterOrcamentoPorId(pbInstance: any, id: string): Promise<any> {
    return await CalculosDataFetcher.obterOrcamentoPorId(pbInstance, id);
  }

  async criarNovoUsuario(pbInstance: any, input: any): Promise<any> {
    return await CalculosDataFetcher.criarUsuario(pbInstance, input);
  }

  async obterCidadePorId(pbInstance: any, id: string): Promise<any> {
    const record = await CalculosDataFetcher.obterCidadePorId(pbInstance, id);
    return {
      ...record,
      mediacalc: CalculosFormatter.normalizarHSP(record.mediacalc)
    };
  }

  async atualizarOrcamentoParcial(pbInstance: any, id: string, data: any): Promise<any> {
    return await CalculosDataFetcher.atualizarOrcamento(pbInstance, id, data);
  }

  obterConfigMargensLucro(): ConfigMargensLucroOutput {
    return CalculosProcess.obterConfigMargensLucro();
  }
}

export default new CalculosService();

