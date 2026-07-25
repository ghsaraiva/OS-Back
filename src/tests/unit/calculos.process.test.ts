import { describe, it, expect } from 'vitest';
import { CalculosProcess } from '../../services/calculos.process';

describe('Calculos Process (Business Logic)', () => {
  describe('Dimensionamento Interno', () => {
    it('deve calcular o dimensionamento interno com base no consumo e HSP', () => {
      const result = CalculosProcess.calcularDimensionamentoInterno(5000, 500, 1.0);
      expect(result.consumo_mensal_kwh).toBe(500);
      expect(result.mediacalc).toBe(5);
      expect(result.hsp_mensal).toBe(150);
      expect(result.kwp_minimo).toBeCloseTo(3.333, 3);
    });
  });

  describe('Sistema Real', () => {
    it('deve calcular o kwp do sistema real', () => {
      const result = CalculosProcess.calcularSistemaReal({ potencia_painel: 550, quantidade_paineis: 10 });
      expect(result.kwp_sistema).toBe(5.5);
    });
  });

  describe('Geração e Retorno', () => {
    it('deve calcular geração baseada na irradiação e economia', () => {
      const result = CalculosProcess.calcularGeracaoERetorno({
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

    it('deve normalizar 11.9 meses de payback para 1 ano (evitando 0 anos e 12 meses)', () => {
      const result = CalculosProcess.calcularGeracaoERetorno({
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
      const result = CalculosProcess.calcularGeracaoERetorno({
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

  describe('Licenciamento do Kit', () => {
    it('deve calcular a margem sobre o kit do fornecedor', () => {
      const result = CalculosProcess.calcularLicenciamentoKit({
        valorKit: 10000,
        valorPorcentagem: 10
      });
      expect(result.lucroEquipamentoFinal).toBe(1000);
      expect(result.valorKitLicenciado).toBe(11000);
    });
  });

  describe('Cascata do Projeto (Prova Real)', () => {
    it('deve fechar a conta exatamente no centavo (Soma das partes = Preço Final)', () => {
      const input = {
        valorKitLicenciado: 11000,
        valorMaoDeObra: 2000,
        valorEquipamentoLocal: 500,
        valorHomologacao: 1000,
        porcentagemLucroLiquido: 15,
        quantidade_paineis: 1
      };

      const result = CalculosProcess.calcularPrecoFinal(input);

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

    it('deve lançar erro se a porcentagem de lucro líquido desejada for maior que o limite permitido', () => {
      expect(() => {
        CalculosProcess.calcularPrecoFinal({
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

  describe('Configurações de Margem de Lucro', () => {
    it('deve retornar configuração de margens de lucro de 10% a 25%', () => {
      const result = CalculosProcess.obterConfigMargensLucro();
      expect(result.min).toBe(10);
      expect(result.max).toBe(25);
      expect(result.opcoes).toHaveLength(16);
      expect(result.opcoes[0].label).toBe('10%');
      expect(result.opcoes[15].label).toBe('25%');
    });
  });

  describe('Processar Métricas', () => {
    it('deve processar registros brutos e contar kpis e stats agrupadas', () => {
      const records = [
        { situacao: 'Aberto', nome_cliente: 'Gabriel ', estado: 'SP' },
        { situacao: 'Aberto', nome_cliente: 'gabriel', estado: 'SP' },
        { situacao: 'Técnico Finalizado', nome_cliente: 'Gabriel', estado: 'RJ' },
        { situacao: 'Outro', nome_cliente: 'Maria Silva', estado: 'rj' }
      ];
      const result = CalculosProcess.processarMetricasDashboard(records);
      
      expect(result.total).toBe(4);
      expect(result.abertos).toBe(2);
      expect(result.concluidos).toBe(1);
      expect(result.clientes).toBe(2); // unique Gabriel, Maria
      expect(result.stats['SP']).toBe(2);
      expect(result.stats['RJ']).toBe(2);
    });
  });
});
