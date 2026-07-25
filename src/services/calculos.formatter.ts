export class CalculosFormatter {
  static normalizarHSP(mediacalc: number): number {
    return mediacalc > 100 ? mediacalc / 1000 : mediacalc;
  }

  static formatarComposicaoComercial(quantidade_paineis: number, marca_modulo: string, potencia_painel: number, quantidade_inversores: number, marca_inversor: string, modelo_inversor: string, potencia_inversor: number, kwp_sistema: number) {
    return {
      composicao_1: `${quantidade_paineis} módulos solares fotovoltaicos ${marca_modulo} de ${potencia_painel}W`,
      composicao_2: `${quantidade_inversores} Inversor Fotovoltaico – ${marca_inversor} – ${modelo_inversor} - ${potencia_inversor}kW`,
      composicao_3: `Conjunto de estrutura para fixação de ${quantidade_paineis} módulos`,
      composicao_resumo: `${quantidade_paineis} Painéis, ${marca_modulo}, ${kwp_sistema.toFixed(2)} kWp`
    };
  }

  static formatarDashboardResult(total: number, abertos: number, concluidos: number, clientes: number, stats: Record<string, number>) {
    const demographics = Object.entries(stats)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

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
}
