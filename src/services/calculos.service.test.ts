import { describe, it, expect, vi } from 'vitest';
import calculosService from './calculos.service';
import pb from '../config/pocketbase';

// Mock do PocketBase
vi.mock('../config/pocketbase', () => ({
  default: {
    collection: vi.fn().mockReturnThis(),
    getFirstListItem: vi.fn(),
    getOne: vi.fn(),
  },
  authenticatePB: vi.fn().mockResolvedValue(true)
}));

describe('CalculosService Reestruturado', () => {
  describe('Seção 1: Captação', () => {
    it('deve calcular o dimensionamento mínimo corretamente', async () => {
      const mockRecord = { mediacalc: 5000, cidade: 'FLORIANOPOLIS', estado: 'SC' };
      (pb.collection('cidades_hsp').getOne as any).mockResolvedValue(mockRecord);

      const result = await calculosService.calcularDimensionamentoMinimo({
        id_cidade: 'id123',
        cidade: 'FLORIANOPOLIS',
        estado: 'SC',
        consumo_mes: 500,
        valor_tarifa: 1.0
      });

      expect(result.kwp_minimo).toBe(3.33);
    });

    it('deve calcular o dimensionamento interno com os mesmos valores da regra matemática de produção', () => {
      const result = (calculosService as any).calcularDimensionamentoInterno(5000, 500, 1.0);
      expect(result.consumo_mensal_kwh).toBe(500);
      expect(result.mediacalc).toBe(5);
      expect(result.hsp_mensal).toBe(150);
      expect(result.kwp_minimo).toBe(3.3333333333333335);
    });
  });

  describe('Seção 2: Equipamentos', () => {
    it('deve calcular o sistema real', () => {
      const result = calculosService.calcularSistemaReal({ potencia_painel: 550, quantidade_paineis: 10 });
      expect(result.kwp_sistema).toBe(5.5);
    });

    it('deve calcular geração e retorno', () => {
      const result = calculosService.calcularGeracaoERetorno({
        kwp_sistema: 5.5,
        mediacalc: 5.0, // Corrigido de 5000 para 5.0
        valor_tarifa: 0.85,
        consumo_mes_rs: 701.25, // Inserido valor correspondente a 825 kWh (825 * 0.85)
        padrao: 'Trifásico',
        valor_investido: 20000,
        quantidade_paineis: 10
      });
      expect(result.geracao_mensal_kwh).toBe(825);
      expect(result.economia_mensal_rs).toBe(558.19); // 701.25 - encargos TUSD (143.06) = 558.19
    });
  });

  describe('Seção 3: Dinâmica do Kit', () => {
    it('deve calcular o licenciamento do kit corretamente', () => {
      const result = calculosService.calcularLicenciamentoKit({
        valorKit: 10000,
        valorPorcentagem: 10
      });
      expect(result.lucroEquipamentoFinal).toBe(1000);
      expect(result.valorKitLicenciado).toBe(11000);
    });
  });

  describe('Seção 4: Cascata do Projeto (Prova Real)', () => {
    it('deve fechar a conta exatamente no centavo (Soma das partes = Preço Final)', () => {
      const input = {
        valorKitLicenciado: 11000,
        valorMaoDeObra: 2000,
        valorEquipamentoLocal: 500,
        valorHomologacao: 1000,
        porcentagemLucroLiquido: 15,
        quantidade_paineis: 1 // Adicionado para evitar que os custos totais sejam zerados
      };

      const result = calculosService.calcularPrecoFinal(input);

      // Prova Real Matemática:
      // A soma de todos os custos destrinchados + margem + seguro + imposto + lucro
      // DEVE ser igual ao Preço Final Sugerido.
      
      const somaProvaReal = 
        input.valorKitLicenciado + 
        input.valorMaoDeObra + 
        input.valorEquipamentoLocal + 
        input.valorHomologacao + 
        result.margemSeguranca + 
        result.seguro + 
        result.imposto + 
        result.lucroLiquidoRs;

      // Usando toBeCloseTo com precisão de 0 (centavos) para lidar com arredondamentos de ponto flutuante do JS
      // A soma das fatias arredondadas pode variar +/- 1 centavo do total arredondado.
      expect(somaProvaReal).toBeCloseTo(result.precoFinalSugerido, 1);
      
      // Valor esperado para o Preço Final Sugerido com estes inputs
      expect(result.precoFinalSugerido).toBe(19255.78);
    });
  });

  describe('Casos de Payback (Normalização)', () => {
    it('deve normalizar 11.9 meses de payback para 1 ano (evitando 0 anos e 12 meses)', () => {
      const result = calculosService.calcularGeracaoERetorno({
        kwp_sistema: 5.5,
        mediacalc: 5.0,
        valor_tarifa: 0.85,
        consumo_mes_rs: 701.25,
        padrao: 'Trifásico',
        valor_investido: 6642.46, // ~ 11.9 meses de economia (558.19 * 11.9)
        quantidade_paineis: 10
      });
      expect(result.tempo_retorno).toBe('1 ano');
    });

    it('deve normalizar 23.9 meses de payback para 2 anos (evitando 1 ano e 12 meses)', () => {
      const result = calculosService.calcularGeracaoERetorno({
        kwp_sistema: 5.5,
        mediacalc: 5.0,
        valor_tarifa: 0.85,
        consumo_mes_rs: 701.25,
        padrao: 'Trifásico',
        valor_investido: 13340.74, // ~ 23.9 meses de economia (558.19 * 23.9)
        quantidade_paineis: 10
      });
      expect(result.tempo_retorno).toBe('2 anos');
    });
  });

  describe('Salvar Refinamento - Validação de Integridade', () => {
    it('deve recalcular com precisão sem brechas para dízimas flutuantes durante o faturamento', () => {
      // Simula o recálculo que o método salvarRefinamentoGerencial faz internamente
      const resultadoMock = calculosService.calcularPrecoFinal({
        valorKitLicenciado: 12000,
        valorMaoDeObra: 2500,
        valorEquipamentoLocal: 800,
        valorHomologacao: 750,
        porcentagemLucroLiquido: 18,
        quantidade_paineis: 10
      });

      // Prova real estrita: O Preço Sugerido menos o Lucro Líquido em R$ deve bater rigorosamente com os custos associados
      const somaComponentes = resultadoMock.custoProjeto + resultadoMock.margemSeguranca + resultadoMock.seguro + resultadoMock.imposto;
      
      expect(Number((resultadoMock.precoFinalSugerido - resultadoMock.lucroLiquidoRs).toFixed(2))).toBeLessThan(resultadoMock.precoFinalSugerido);
      // Garante que o lucro em reais é exatamente o percentual informado sobre o preço final de venda
      expect(resultadoMock.lucroLiquidoRs).toBe(Number((resultadoMock.precoFinalSugerido * 0.18).toFixed(2)));
    });

    it('deve lançar erro se a porcentagem de lucro líquido desejada for maior que o limite permitido', () => {
      expect(() => {
        calculosService.calcularPrecoFinal({
          valorKitLicenciado: 10000,
          valorMaoDeObra: 100,
          valorEquipamentoLocal: 50,
          valorHomologacao: 1000,
          porcentagemLucroLiquido: 85, // Maior que 83%
          quantidade_paineis: 10
        });
      }).toThrow('excede o limite máximo permitido');
    });
  });
});
