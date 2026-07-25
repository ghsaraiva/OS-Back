import { 
  SistemaRealInput, 
  SistemaRealOutput, 
  GeracaoERetornoInput, 
  GeracaoERetornoOutput, 
  LicenciamentoKitInput, 
  LicenciamentoKitOutput, 
  PrecoFinalInput, 
  PrecoFinalOutput,
  ConfigMargensLucroOutput
} from '../models/calculos.model';
import { 
  formatarMoeda, 
  TAXA_SEGURO, 
  TAXA_IMPOSTO, 
  MAX_LUCRO_LIQUIDO_PERMITIDO 
} from '../utils/calculos.utils';

export class CalculosProcess {
  static calcularDimensionamentoInterno(mediacalcRaw: number, consumo_mes: number, valor_tarifa: number) {
    const consumo_mensal_kwh = consumo_mes / valor_tarifa;
    // mediacalcRaw is already normalized if coming from formatters, but we add a safety check
    const mediacalc = mediacalcRaw > 100 ? mediacalcRaw / 1000 : mediacalcRaw;
    const hsp_mensal = mediacalc * 30;
    const kwp_minimo = consumo_mensal_kwh / hsp_mensal;

    return {
      consumo_mensal_kwh,
      mediacalc,
      hsp_mensal,
      kwp_minimo
    };
  }

  static calcularSistemaReal(input: SistemaRealInput): SistemaRealOutput {
    const { potencia_painel, quantidade_paineis } = input;
    const kwp_sistema = (potencia_painel * quantidade_paineis) / 1000;
    return { kwp_sistema: formatarMoeda(kwp_sistema) };
  }

  static calcularGeracaoERetorno(input: GeracaoERetornoInput): GeracaoERetornoOutput {
    const { kwp_sistema, mediacalc, valor_tarifa, consumo_mes_rs, padrao, valor_investido, quantidade_paineis } = input;

    const hsp_diario = mediacalc;
    const media_mes_kwh = kwp_sistema * hsp_diario * 30;
    const geracao_mensal_kwh = Number(media_mes_kwh.toFixed(2)); 
    const geracao_anual_kwh = media_mes_kwh * 12;

    const area_estimada = (quantidade_paineis || 0) * 2.5;

    const tusd_interno = valor_tarifa * media_mes_kwh * 0.51;
    const imposto_faturamento = tusd_interno * 0.18;
    const fio_b_faturamento = tusd_interno * 0.22;
    
    const consumo_kwh = consumo_mes_rs / valor_tarifa;
    const saldo_devedor_kwh = Math.max(consumo_kwh - media_mes_kwh, 0);
    const custo_energia_restante = saldo_devedor_kwh * valor_tarifa;

    const valor_pago_mes = formatarMoeda(custo_energia_restante + imposto_faturamento + fio_b_faturamento);
    const valor_pago_ano = formatarMoeda(valor_pago_mes * 12);

    const economia_mensal_rs = formatarMoeda(consumo_mes_rs - valor_pago_mes);
    const economia_anual_rs = formatarMoeda(economia_mensal_rs * 12);
    const porcentagem_reducao = Number((economia_mensal_rs / (consumo_mes_rs || 1)).toFixed(2));

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

    return {
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
  }

  static calcularLicenciamentoKit(input: LicenciamentoKitInput): LicenciamentoKitOutput {
    const { valorKit, valorPorcentagem } = input;
    const lucroEquipamentoFinal = valorKit * (valorPorcentagem / 100);
    const valorKitLicenciado = valorKit + lucroEquipamentoFinal;

    return {
      lucroEquipamentoFinal: formatarMoeda(lucroEquipamentoFinal),
      valorKitLicenciado: formatarMoeda(valorKitLicenciado)
    };
  }

  static calcularPrecoFinal(input: PrecoFinalInput): PrecoFinalOutput {
    const { 
      valorKitLicenciado, 
      valorMaoDeObra, 
      valorEquipamentoLocal, 
      valorHomologacao, 
      quantidade_inversores,
      potencia_inversor,
      porcentagemLucroLiquido,
      quantidade_paineis
    } = input;

    if (porcentagemLucroLiquido > MAX_LUCRO_LIQUIDO_PERMITIDO) {
      throw new Error(`A porcentagem de lucro líquido desejada excede o limite máximo permitido de ${MAX_LUCRO_LIQUIDO_PERMITIDO}%.`);
    }

    const valorMaoDeObraTotal = valorMaoDeObra * (quantidade_paineis || 0);
    const valorEquipamentoLocalTotal = valorEquipamentoLocal * (quantidade_paineis || 0);

    const valorHomologacaoReal = (quantidade_inversores !== undefined && potencia_inversor !== undefined && quantidade_inversores > 0)
      ? CalculosProcess.calcularValorHomologacao(quantidade_inversores, potencia_inversor)
      : (valorHomologacao || 500);

    const custoDireto = valorKitLicenciado + valorMaoDeObraTotal + valorEquipamentoLocalTotal + valorHomologacaoReal;
    const margemSeguranca = (valorKitLicenciado / 0.97) - valorKitLicenciado;
    const divisor = 1 - (porcentagemLucroLiquido / 100) - TAXA_SEGURO - TAXA_IMPOSTO;
    const precoFinalSugerido = (custoDireto + margemSeguranca - (TAXA_IMPOSTO * valorKitLicenciado)) / divisor;

    const seguro = precoFinalSugerido * TAXA_SEGURO;
    const lucroLiquidoRs = precoFinalSugerido * (porcentagemLucroLiquido / 100);
    const imposto = (precoFinalSugerido - valorKitLicenciado) * TAXA_IMPOSTO;
    const custoProjeto = precoFinalSugerido - lucroLiquidoRs;

    return {
      custoDireto: formatarMoeda(custoDireto),
      custoProjeto: formatarMoeda(custoProjeto),
      margemSeguranca: formatarMoeda(margemSeguranca),
      seguro: formatarMoeda(seguro),
      lucroLiquidoRs: formatarMoeda(lucroLiquidoRs),
      imposto: formatarMoeda(imposto),
      precoFinalSugerido: formatarMoeda(precoFinalSugerido),
      valorMaoDeObraTotal: formatarMoeda(valorMaoDeObraTotal),
      valorEquipamentoLocalTotal: formatarMoeda(valorEquipamentoLocalTotal),
      valorHomologacaoCalculado: formatarMoeda(valorHomologacaoReal)
    };
  }

  static calcularValorHomologacao(quantidade_inversores: number, potencia_inversor: number): number {
    const potencia_total = (quantidade_inversores || 0) * (potencia_inversor || 0);
    if (potencia_total <= 10) return 500;
    if (potencia_total <= 20) return 750;
    if (potencia_total <= 40) return 1200;
    if (potencia_total <= 50) return 1700;
    if (potencia_total <= 75) return 2500;
    return 10000;
  }

  static processarMetricasDashboard(records: any[]) {
    const total = records.length;
    const abertos = records.filter((r: any) => r.situacao === 'Aberto').length;
    const concluidos = records.filter((r: any) => r.situacao === 'Técnico Finalizado').length;
    const uniqueClientNames = new Set(
      records
        .map((r: any) => r.nome_cliente ? r.nome_cliente.trim().toLowerCase() : '')
        .filter(Boolean)
    );
    const clientes = uniqueClientNames.size;

    const stats: Record<string, number> = {};
    records.forEach((r: any) => {
      if (r.estado) {
        const estado = r.estado.toUpperCase();
        stats[estado] = (stats[estado] || 0) + 1;
      }
    });

    return { total, abertos, concluidos, clientes, stats };
  }

  static obterConfigMargensLucro(): ConfigMargensLucroOutput {
    const opcoes = Array.from({ length: 16 }, (_, i) => {
      const num = i + 10;
      return {
        value: num.toFixed(2).replace('.', ','),
        label: `${num}%`,
      };
    });
    return { opcoes, min: 10, max: 25 };
  }
}
