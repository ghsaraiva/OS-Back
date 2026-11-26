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
  CustosAssociadoInput,
  ConfigMargensLucroOutput
} from '../models/calculos.model';
import { CalculosDataFetcher } from './calculos.dataFetcher';
import { CalculosProcess } from './calculos.process';
import { CalculosFormatter } from './calculos.formatter';
import { formatarMoeda, resolverTaxa, resolverPorcentagemMargem, TAXA_SEGURO, TAXA_IMPOSTO } from '../utils/calculos.utils';

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

  calcularValorHomologacao(potenciaTotal: number): number {
    return CalculosProcess.calcularValorHomologacao(1, potenciaTotal);
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


  private async calcularKwpMinimo(pbInstance: any, id_cidade: string, consumo_mes: number, valor_tarifa: number) {
    const recordCidade = await CalculosDataFetcher.obterCidadePorId(pbInstance, id_cidade);
    const calculos = CalculosProcess.calcularDimensionamentoInterno(recordCidade.mediacalc, consumo_mes, valor_tarifa);
    return { recordCidade, kwp_minimo: formatarMoeda(calculos.kwp_minimo) };
  }

  async criarSolicitacaoInicial(pbInstance: any, input: CriarSolicitacaoInput): Promise<any> {
    const { id_cidade, consumo_mes, valor_tarifa } = input;
    const { kwp_minimo } = await this.calcularKwpMinimo(pbInstance, id_cidade, consumo_mes, valor_tarifa);

    const km = input.km !== undefined ? input.km : 0;
    const custo_km = input.custo_km !== undefined ? input.custo_km : 0;

    const payload = {
      ...input,
      mao_obra: input.mao_obra !== undefined ? input.mao_obra : 100,
      equipamento_local: input.equipamento_local !== undefined ? input.equipamento_local : 60,
      lucro_liquido_perc: input.lucro_liquido_perc !== undefined ? input.lucro_liquido_perc : 20,
      porcentagem_seguro: input.porcentagem_seguro !== undefined ? input.porcentagem_seguro : 1,
      porcentagem_imposto: input.porcentagem_imposto !== undefined ? input.porcentagem_imposto : 8,
      porcentagem_margem_seguranca: input.porcentagem_margem_seguranca !== undefined ? input.porcentagem_margem_seguranca : 3,
      km,
      custo_km,
      valor_total_km: formatarMoeda(km * custo_km),
      kwp_minimo,
      situacao: 'Aberto'
    };

    return await CalculosDataFetcher.criarOrcamento(pbInstance, payload);
  }

  sanitizarOrcamento(orcamento: any, tipoAcesso?: string): any {
    if (!orcamento || tipoAcesso === 'admin') {
      return orcamento;
    }

    const sanitized = { ...orcamento };

    // Para quem está fora do admin, o kit gerador é o kit licenciado; a margem de segurança é uma linha à parte
    sanitized.valor_kit_gerador = formatarMoeda(orcamento.valor_kit_final || 0);

    // Custo bruto, porcentagem e lucro do kit da Sofia nunca são visíveis fora do admin
    delete sanitized.valor_kit;
    delete sanitized.porcentagem_kit;
    delete sanitized.lucro_equipamento;

    // Se for vendedor, esconde também valor_kit_final, impostos e custos detalhados
    if (tipoAcesso === 'vendedor') {
      delete sanitized.valor_kit_final;
      delete sanitized.valor_kit_gerador;
      delete sanitized.imposto;
      delete sanitized.lucro_liquido_previsto;
      delete sanitized.lucro_liquido_perc;
      delete sanitized.custo_projeto;
      delete sanitized.seguro;
      delete sanitized.margem_seguranca;
      delete sanitized.porcentagem_margem_seguranca;
      delete sanitized.mao_obra;
      delete sanitized.equipamento_local;
      delete sanitized.valor_mao_obra_final;
      delete sanitized.valor_equip_local_final;
      delete sanitized.valor_homologacao;
      delete sanitized.km;
      delete sanitized.custo_km;
      delete sanitized.valor_total_km;
    }

    return sanitized;
  }

  async salvarRefinamentoGerencial(pbInstance: any, input: SalvarRefinamentoInput): Promise<any> {
    const orcamentoOriginal = await CalculosDataFetcher.obterOrcamentoPorId(pbInstance, input.orcamentoId);
    if (!orcamentoOriginal) {
      throw new Error('Orçamento não encontrado.');
    }

    const resolvedValorKit = input.valorKit || 0;
    const resolvedPorcentagemKit = input.valorPorcentagem || 0;

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
      valorKit: resolvedValorKit, 
      valorPorcentagem: resolvedPorcentagemKit 
    });

    const valorHomologacaoCalculado = CalculosProcess.calcularValorHomologacao(
      input.quantidade_inversores,
      input.potencia_inversor
    );

    const porcentagemMargemSeguranca = input.porcentagem_margem_seguranca !== undefined
      ? input.porcentagem_margem_seguranca
      : resolverPorcentagemMargem(orcamentoOriginal);

    const cascata = CalculosProcess.calcularPrecoFinal({
      valorKitLicenciado: licenciamento.valorKitLicenciado,
      valorMaoDeObra: input.valorMaoDeObra,
      valorEquipamentoLocal: input.valorEquipamentoLocal,
      valorHomologacao: valorHomologacaoCalculado,
      porcentagemLucroLiquido: input.porcentagemLucroLiquido,
      quantidade_paineis: input.quantidade_paineis,
      km: input.km,
      custo_km: input.custo_km,
      porcentagem_imposto: input.porcentagem_imposto,
      porcentagem_seguro: input.porcentagem_seguro,
      porcentagem_margem_seguranca: porcentagemMargemSeguranca,
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


    const payloadPocketBase = {
      nome_cliente: input.nome_cliente !== undefined ? input.nome_cliente : orcamentoOriginal.nome_cliente,
      telefone_cliente: input.telefone_cliente !== undefined ? input.telefone_cliente : orcamentoOriginal.telefone_cliente,
      email_cliente: input.email_cliente !== undefined ? input.email_cliente : orcamentoOriginal.email_cliente,
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
      valor_kit: resolvedValorKit,
      porcentagem_kit: resolvedPorcentagemKit,
      lucro_liquido_perc: input.porcentagemLucroLiquido,
      mao_obra: input.valorMaoDeObra,
      equipamento_local: input.valorEquipamentoLocal,
      valor_homologacao: valorHomologacaoCalculado,
      km: input.km !== undefined ? input.km : 0,
      custo_km: input.custo_km !== undefined ? input.custo_km : 0,
      valor_total_km: cascata.custoKmTotal,
      porcentagem_imposto: input.porcentagem_imposto !== undefined
        ? input.porcentagem_imposto
        : (orcamentoOriginal.porcentagem_imposto !== undefined ? orcamentoOriginal.porcentagem_imposto : 8),
      porcentagem_seguro: input.porcentagem_seguro !== undefined
        ? input.porcentagem_seguro
        : (orcamentoOriginal.porcentagem_seguro !== undefined ? orcamentoOriginal.porcentagem_seguro : 1),
      porcentagem_margem_seguranca: cascata.porcentagem_margem_seguranca,
      chpzdpth: formComercial.composicao_resumo,
      observacao: input.observacao ?? orcamentoOriginal.observacao,

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
      material_structure: input.material_structure,

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
    // Fora do admin, sempre filtra pelo dono; sem usuário o filtro não casa com nada
    const filter = isAdmin ? '' : pbInstance.filter('user_id = {:userId}', { userId: userId || '' });
    
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

  async atualizarPrecoVenda(pbInstance: any, id: string, preco_final_venda: number, somenteLucro = false): Promise<any> {
    const orcamento = await CalculosDataFetcher.obterOrcamentoPorId(pbInstance, id);

    // Associado: o preço que ele define mexe só no lucro dele; seguro, imposto e custo do projeto ficam como estão.
    if (somenteLucro) {
      const custoKm = (orcamento.km || 0) * (orcamento.custo_km || 0);
      const precoSemKm = preco_final_venda - custoKm;
      const lucroLiquidoPrevisto = formatarMoeda(preco_final_venda - (orcamento.custo_projeto || 0));
      return await CalculosDataFetcher.atualizarOrcamento(pbInstance, id, {
        preco_final_venda,
        lucro_liquido_previsto: lucroLiquidoPrevisto,
        lucro_liquido_perc: formatarMoeda(precoSemKm > 0 ? (lucroLiquidoPrevisto / precoSemKm) * 100 : 0),
      });
    }

    const kitLicenciado = orcamento.valor_kit_final || 0;

    // O km entra no preço sem seguro, imposto ou lucro, então as taxas incidem só sobre o preço sem o km.
    const custoKmTotal = (orcamento.km || 0) * (orcamento.custo_km || 0);
    const precoBaseAnterior = Math.max((orcamento.preco_final_venda || 0) - custoKmTotal, 0);
    const taxaSeguro = resolverTaxa(orcamento.porcentagem_seguro, orcamento.seguro, precoBaseAnterior, TAXA_SEGURO);
    const taxaImposto = resolverTaxa(
      orcamento.porcentagem_imposto, orcamento.imposto, Math.max(precoBaseAnterior - kitLicenciado, 0), TAXA_IMPOSTO,
    );

    const precoBase = Math.max(preco_final_venda - custoKmTotal, 0);
    const seguro = formatarMoeda(precoBase * taxaSeguro);

    const imposto = formatarMoeda(Math.max(precoBase - kitLicenciado, 0) * taxaImposto);
    const margemSeguranca = orcamento.margem_seguranca || 0;
    const custoDireto =
      (orcamento.valor_kit_final || 0) +
      (orcamento.valor_mao_obra_final || 0) +
      (orcamento.valor_equip_local_final || 0) +
      (orcamento.valor_homologacao || 0) +
      custoKmTotal;
    const custoProjeto = formatarMoeda(custoDireto + margemSeguranca + seguro + imposto);
    const lucroLiquidoPrevisto = formatarMoeda(preco_final_venda - custoProjeto);
    const lucroLiquidoPerc = formatarMoeda(precoBase > 0 ? (lucroLiquidoPrevisto / precoBase) * 100 : 0);

    const updateData = {
      preco_final_venda,
      seguro,
      imposto,
      custo_projeto: custoProjeto,
      lucro_liquido_previsto: lucroLiquidoPrevisto,
      lucro_liquido_perc: lucroLiquidoPerc,
      // Grava a taxa usada, o que também corrige orçamentos antigos com a porcentagem zerada
      porcentagem_seguro: formatarMoeda(taxaSeguro * 100),
      porcentagem_imposto: formatarMoeda(taxaImposto * 100),
    };

    return await CalculosDataFetcher.atualizarOrcamento(pbInstance, id, updateData);
  }

  async donoEhAssociado(pbInstance: any, userId?: string): Promise<boolean> {
    if (!userId) return false;
    const dono = await CalculosDataFetcher.obterUsuarioPorId(pbInstance, userId);
    return dono?.tipo_acesso === 'associado';
  }

  async obterTodosUsuarios(pbInstance: any): Promise<any> {
    return await CalculosDataFetcher.listarUsuarios(pbInstance);
  }

  async listarTodosOrcamentos(pbInstance: any, userId?: string, isAdmin?: boolean): Promise<any> {
    // Fora do admin, sempre filtra pelo dono; sem usuário o filtro não casa com nada
    const filter = isAdmin ? '' : pbInstance.filter('user_id = {:userId}', { userId: userId || '' });
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

  async alterarSenhaPrimeiroAcesso(
    pbInstance: any,
    userId: string,
    password: string,
    passwordConfirm: string
  ): Promise<any> {
    return await CalculosDataFetcher.alterarSenhaPrimeiroAcesso(
      pbInstance,
      userId,
      password,
      passwordConfirm
    );
  }

  async obterCidadePorId(pbInstance: any, id: string): Promise<any> {
    const record = await CalculosDataFetcher.obterCidadePorId(pbInstance, id);
    return {
      ...record,
      mediacalc: CalculosFormatter.normalizarHSP(record.mediacalc)
    };
  }

  /**
   * Atualiza apenas os campos operacionais que o associado tem direito a preencher.
   * Se o kit já foi precificado pela administração, recalcula a cascata e o retorno
   * mantendo o kit e a homologação definidos pelo admin.
   */
  async atualizarCustosAssociado(
    pbInstance: any,
    orcamento: any,
    input: CustosAssociadoInput,
    dadosSolicitacao: Record<string, any> = {},
  ): Promise<any> {
    const porcentagemMargemSeguranca = input.porcentagem_margem_seguranca ?? resolverPorcentagemMargem(orcamento);
    const updateData: Record<string, any> = {
      ...dadosSolicitacao,
      ...input,
      porcentagem_margem_seguranca: porcentagemMargemSeguranca,
      valor_total_km: formatarMoeda(input.km * input.custo_km),
    };

    const kitPrecificado = (orcamento.valor_kit_final || 0) > 0 && (orcamento.qtd_paineis || 0) > 0;

    // Roda a cascata mesmo sem kit para validar o limite de lucro líquido
    const cascata = CalculosProcess.calcularPrecoFinal({
      valorKitLicenciado: kitPrecificado ? orcamento.valor_kit_final : 0,
      valorMaoDeObra: input.mao_obra,
      valorEquipamentoLocal: input.equipamento_local,
      valorHomologacao: orcamento.valor_homologacao,
      porcentagemLucroLiquido: input.lucro_liquido_perc,
      quantidade_paineis: orcamento.qtd_paineis,
      km: input.km,
      custo_km: input.custo_km,
      porcentagem_imposto: input.porcentagem_imposto,
      porcentagem_seguro: input.porcentagem_seguro,
      porcentagem_margem_seguranca: porcentagemMargemSeguranca,
    });

    if (kitPrecificado) {
      const recordCidade = await CalculosDataFetcher.obterCidadePorId(pbInstance, orcamento.id_cidade);
      const retorno = CalculosProcess.calcularGeracaoERetorno({
        kwp_sistema: orcamento.kwp_sistema,
        mediacalc: CalculosFormatter.normalizarHSP(recordCidade.mediacalc),
        valor_tarifa: orcamento.valor_tarifa,
        consumo_mes_rs: orcamento.consumo_mes,
        padrao: orcamento.padrao,
        valor_investido: cascata.precoFinalSugerido,
        quantidade_paineis: orcamento.qtd_paineis,
      });

      Object.assign(updateData, {
        valor_mao_obra_final: cascata.valorMaoDeObraTotal,
        valor_equip_local_final: cascata.valorEquipamentoLocalTotal,
        seguro: cascata.seguro,
        custo_projeto: cascata.custoProjeto,
        imposto: cascata.imposto,
        margem_seguranca: cascata.margemSeguranca,
        lucro_liquido_previsto: cascata.lucroLiquidoRs,
        preco_final_venda: cascata.precoFinalSugerido,
        area_estimada: retorno.area_estimada,
        geracao_mes: retorno.media_mes_kwh,
        geracao_ano: retorno.geracao_anual_kwh,
        valor_pago_mes: retorno.valor_pago_mes,
        valor_pago_ano: retorno.valor_pago_ano,
        porcentagem_reducao: retorno.porcentagem_reducao,
        tempo_retorno: retorno.tempo_retorno,
      });
    }

    return await CalculosDataFetcher.atualizarOrcamento(pbInstance, orcamento.id, updateData);
  }

  /**
   * Correção da solicitação pelo associado: dados do cliente e da instalação mais os custos dele.
   * Cidade, consumo, tarifa e padrão mudam o dimensionamento e o retorno, então tudo é recalculado
   * sobre o orçamento já atualizado. O kit e a homologação definidos pelo admin são mantidos.
   */
  async atualizarSolicitacaoAssociado(
    pbInstance: any,
    orcamento: any,
    dados: Record<string, any>,
    custos: CustosAssociadoInput,
  ): Promise<any> {
    const { recordCidade, kwp_minimo } = await this.calcularKwpMinimo(
      pbInstance, dados.id_cidade, dados.consumo_mes, dados.valor_tarifa,
    );

    const dadosSolicitacao = {
      ...dados,
      cidade: recordCidade.cidade,
      estado: recordCidade.estado,
      kwp_minimo,
    };

    return await this.atualizarCustosAssociado(pbInstance, { ...orcamento, ...dadosSolicitacao }, custos, dadosSolicitacao);
  }

  async atualizarOrcamentoParcial(pbInstance: any, id: string, data: any): Promise<any> {
    return await CalculosDataFetcher.atualizarOrcamento(pbInstance, id, data);
  }

  obterConfigMargensLucro(): ConfigMargensLucroOutput {
    return CalculosProcess.obterConfigMargensLucro();
  }
}

export default new CalculosService();

