import { describe, it, expect, vi } from 'vitest';
import calculosService from '../../services/calculos.service';
import pb from '../../config/pocketbase';

// Mock do PocketBase
vi.mock('../../config/pocketbase', () => ({
  default: {
    collection: vi.fn().mockReturnThis(),
    getFirstListItem: vi.fn(),
    getOne: vi.fn(),
    getFullList: vi.fn(),
  },
  authenticatePB: vi.fn().mockResolvedValue(true)
}));

describe('CalculosService Reestruturado (Unit)', () => {
  describe('Seção 1: Captação', () => {
    it('deve calcular o dimensionamento mínimo corretamente', async () => {
      const mockRecord = { mediacalc: 5000, cidade: 'FLORIANOPOLIS', estado: 'SC' };
      (pb.collection('cidades_hsp').getOne as any).mockResolvedValue(mockRecord);

      const result = await calculosService.calcularDimensionamentoMinimo(pb, {
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
        mediacalc: 5.0,
        valor_tarifa: 0.85,
        consumo_mes_rs: 701.25,
        padrao: 'Trifásico',
        valor_investido: 20000,
        quantidade_paineis: 10
      });
      expect(result.geracao_mensal_kwh).toBe(825);
      expect(result.economia_mensal_rs).toBe(558.19);
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
        quantidade_paineis: 1
      };

      const result = calculosService.calcularPrecoFinal(input);

      const somaProvaReal = 
        input.valorKitLicenciado + 
        input.valorMaoDeObra + 
        input.valorEquipamentoLocal + 
        input.valorHomologacao + 
        result.margemSeguranca + 
        result.seguro + 
        result.imposto + 
        result.lucroLiquidoRs;

      expect(somaProvaReal).toBeCloseTo(result.precoFinalSugerido, 1);
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
        valor_investido: 6642.46,
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
        valor_investido: 13340.74,
        quantidade_paineis: 10
      });
      expect(result.tempo_retorno).toBe('2 anos');
    });
  });

  describe('Salvar Refinamento - Validação de Integridade', () => {
    it('deve recalcular com precisão sem brechas para dízimas flutuantes durante o faturamento', () => {
      const resultadoMock = calculosService.calcularPrecoFinal({
        valorKitLicenciado: 12000,
        valorMaoDeObra: 2500,
        valorEquipamentoLocal: 800,
        valorHomologacao: 750,
        porcentagemLucroLiquido: 18,
        quantidade_paineis: 10
      });

      expect(Number((resultadoMock.precoFinalSugerido - resultadoMock.lucroLiquidoRs).toFixed(2))).toBeLessThan(resultadoMock.precoFinalSugerido);
      expect(resultadoMock.lucroLiquidoRs).toBe(Number((resultadoMock.precoFinalSugerido * 0.18).toFixed(2)));
    });

    it('deve lançar erro se a porcentagem de lucro líquido desejada for maior que o limite permitido', () => {
      expect(() => {
        calculosService.calcularPrecoFinal({
          valorKitLicenciado: 10000,
          valorMaoDeObra: 100,
          valorEquipamentoLocal: 50,
          valorHomologacao: 1000,
          porcentagemLucroLiquido: 85,
          quantidade_paineis: 10
        });
      }).toThrow('excede o limite máximo permitido');
    });
  });

  describe('Cálculo do Valor da Homologação (Regra da Potência do Inversor)', () => {
    it('deve retornar R$ 500 para potências de inversor até 10 kW', () => {
      expect(calculosService.calcularValorHomologacao(0)).toBe(500);
      expect(calculosService.calcularValorHomologacao(5)).toBe(500);
      expect(calculosService.calcularValorHomologacao(10)).toBe(500);
    });

    it('deve retornar R$ 750 para potências de inversor entre 10 e 20 kW', () => {
      expect(calculosService.calcularValorHomologacao(10.1)).toBe(750);
      expect(calculosService.calcularValorHomologacao(15)).toBe(750);
      expect(calculosService.calcularValorHomologacao(20)).toBe(750);
    });

    it('deve retornar R$ 1200 para potências de inversor entre 20 e 40 kW', () => {
      expect(calculosService.calcularValorHomologacao(20.1)).toBe(1200);
      expect(calculosService.calcularValorHomologacao(30)).toBe(1200);
      expect(calculosService.calcularValorHomologacao(40)).toBe(1200);
    });

    it('deve retornar R$ 1700 para potências de inversor entre 40 e 50 kW', () => {
      expect(calculosService.calcularValorHomologacao(40.1)).toBe(1700);
      expect(calculosService.calcularValorHomologacao(45)).toBe(1700);
      expect(calculosService.calcularValorHomologacao(50)).toBe(1700);
    });

    it('deve retornar R$ 2500 para potências de inversor entre 50 e 75 kW', () => {
      expect(calculosService.calcularValorHomologacao(50.1)).toBe(2500);
      expect(calculosService.calcularValorHomologacao(60)).toBe(2500);
      expect(calculosService.calcularValorHomologacao(75)).toBe(2500);
    });

    it('deve retornar R$ 10000 para potências de inversor maiores que 75 kW', () => {
      expect(calculosService.calcularValorHomologacao(75.1)).toBe(10000);
      expect(calculosService.calcularValorHomologacao(100)).toBe(10000);
    });
  });

  describe('Seção 5: Dashboard e Métricas', () => {
    it('deve obter métricas do dashboard e contar clientes de forma única e normalizada', async () => {
      const mockRecords = [
        { id: '1', situacao: 'Aberto', nome_cliente: 'Gabriel ', estado: 'SP' },
        { id: '2', situacao: 'Aberto', nome_cliente: 'gabriel', estado: 'SP' },
        { id: '3', situacao: 'Técnico Finalizado', nome_cliente: 'Gabriel', estado: 'RJ' },
        { id: '4', situacao: 'Outro', nome_cliente: 'Maria Silva', estado: 'rj' },
        { id: '5', situacao: 'Outro', nome_cliente: '', estado: '' }
      ];
      (pb.collection('orcamentos').getFullList as any).mockResolvedValue(mockRecords);

      const result = await calculosService.obterMetricasDashboard(pb, 'user123', true);

      expect(result.kpis.total).toBe(5);
      expect(result.kpis.abertos).toBe(2);
      expect(result.kpis.concluidos).toBe(1);
      expect(result.kpis.clientes).toBe(2);

      expect(result.demographics).toHaveLength(2);
      expect(result.demographics.find((d: any) => d.name === 'SP')?.count).toBe(2);
      expect(result.demographics.find((d: any) => d.name === 'RJ')?.count).toBe(2);
    });
  });
});
