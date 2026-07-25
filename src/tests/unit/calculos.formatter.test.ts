import { describe, it, expect } from 'vitest';
import { CalculosFormatter } from '../../services/calculos.formatter';

describe('Calculos Formatter', () => {
  it('deve normalizar HSP cru (Wh) dividindo por 1000', () => {
    expect(CalculosFormatter.normalizarHSP(5200)).toBe(5.2);
  });

  it('deve manter HSP normalizado (kWh) como está', () => {
    expect(CalculosFormatter.normalizarHSP(5.2)).toBe(5.2);
  });

  it('deve formatar composição comercial corretamente', () => {
    const result = CalculosFormatter.formatarComposicaoComercial(
      10, 'Canadian', 550, 1, 'Growatt', 'MIN', 5, 5.5
    );
    expect(result.composicao_1).toBe('10 módulos solares fotovoltaicos Canadian de 550W');
    expect(result.composicao_2).toBe('1 Inversor Fotovoltaico – Growatt – MIN - 5kW');
    expect(result.composicao_3).toBe('Conjunto de estrutura para fixação de 10 módulos');
    expect(result.composicao_resumo).toBe('10 Painéis, Canadian, 5.50 kWp');
  });

  it('deve formatar resultado do dashboard com limite de demographics e ordenação', () => {
    const stats = { 'SP': 3, 'RJ': 2, 'SC': 1, 'MG': 4, 'PR': 1 };
    const result = CalculosFormatter.formatarDashboardResult(11, 5, 6, 8, stats);

    expect(result.kpis.total).toBe(11);
    expect(result.demographics).toHaveLength(4); // Top 4
    expect(result.demographics[0].name).toBe('MG');
    expect(result.demographics[0].count).toBe(4);
    expect(result.demographics[0].percentage).toBe(36); // Math.round((4/11)*100) = 36
  });
});
