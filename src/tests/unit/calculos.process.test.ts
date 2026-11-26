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
      expect(result.precoFinalSugerido).toBe(18511.12); // margem de 3% sobre o custo direto: 448,45
    });

    it('deve calcular corretamente com alíquota de seguro customizada (ex: 2.5%)', () => {
      const input = {
        valorKitLicenciado: 10000,
        valorMaoDeObra: 1000,
        valorEquipamentoLocal: 500,
        valorHomologacao: 500,
        porcentagemLucroLiquido: 20,
        quantidade_paineis: 1,
        porcentagem_seguro: 2.5,
        porcentagem_imposto: 8
      };

      const result = CalculosProcess.calcularPrecoFinal(input);
      expect(result.porcentagem_seguro).toBe(2.5);
      expect(result.seguro).toBeCloseTo(result.precoFinalSugerido * 0.025, 1);
    });

    it('margem de segurança padrão é 3% "por dentro" sobre o custo direto sem km', () => {
      const base = {
        valorKitLicenciado: 13440,
        valorMaoDeObra: 100,
        valorEquipamentoLocal: 60,
        valorHomologacao: 500,
        porcentagemLucroLiquido: 20,
        quantidade_paineis: 10,
      };

      const padrao = CalculosProcess.calcularPrecoFinal(base);
      // (13.440 + 1.000 + 600 + 500) / 0,97 - 15.540; o km não entra na base
      expect(padrao.margemSeguranca).toBe(480.62);
      const comKm = CalculosProcess.calcularPrecoFinal({ ...base, km: 300, custo_km: 2 });
      expect(comKm.margemSeguranca).toBe(480.62);
      expect(padrao.porcentagem_margem_seguranca).toBe(3);

      // Informar 3% explicitamente dá o mesmo resultado que o padrão
      const tresPorCento = CalculosProcess.calcularPrecoFinal({ ...base, porcentagem_margem_seguranca: 3 });
      expect(tresPorCento).toEqual(padrao);
    });

    it('deve calcular com margem de segurança customizada e com margem zero', () => {
      const base = {
        valorKitLicenciado: 10000,
        valorMaoDeObra: 1000,
        valorEquipamentoLocal: 500,
        valorHomologacao: 500,
        porcentagemLucroLiquido: 20,
        quantidade_paineis: 1,
      };

      const cinco = CalculosProcess.calcularPrecoFinal({ ...base, porcentagem_margem_seguranca: 5 });
      expect(cinco.margemSeguranca).toBe(631.58); // 12.000 / 0,95 - 12.000
      expect(cinco.porcentagem_margem_seguranca).toBe(5);
      expect(Number((cinco.custoProjeto + cinco.lucroLiquidoRs).toFixed(2))).toBe(cinco.precoFinalSugerido);

      const zero = CalculosProcess.calcularPrecoFinal({ ...base, porcentagem_margem_seguranca: 0 });
      expect(zero.margemSeguranca).toBe(0);
      expect(zero.precoFinalSugerido).toBeLessThan(cinco.precoFinalSugerido);
    });

    it('deve recusar margem de segurança de 100% ou mais', () => {
      expect(() => CalculosProcess.calcularPrecoFinal({
        valorKitLicenciado: 10000,
        valorMaoDeObra: 1000,
        valorEquipamentoLocal: 500,
        valorHomologacao: 500,
        porcentagemLucroLiquido: 20,
        quantidade_paineis: 1,
        porcentagem_margem_seguranca: 100,
      })).toThrow('margem de segurança');
    });

    it('deve calcular corretamente o preço com KM e custo_km informados', () => {
      const input = {
        valorKitLicenciado: 11000,
        valorMaoDeObra: 2000,
        valorEquipamentoLocal: 500,
        valorHomologacao: 1000,
        porcentagemLucroLiquido: 15,
        quantidade_paineis: 1,
        km: 100,
        custo_km: 2.5
      };

      const result = CalculosProcess.calcularPrecoFinal(input);
      expect(result.custoKmTotal).toBe(250);
      expect(result.custoDireto).toBe(11000 + 2000 + 500 + 1000 + 250);

      const somaProvaReal = 
        result.custoDireto + 
        result.margemSeguranca + 
        result.seguro + 
        result.imposto + 
        result.lucroLiquidoRs;

      expect(somaProvaReal).toBeCloseTo(result.precoFinalSugerido, 1);

      // O km soma pelo valor de custo, sem seguro, imposto ou lucro
      const semKm = CalculosProcess.calcularPrecoFinal({ ...input, km: 0, custo_km: 0 });
      expect(result.precoFinalSugerido).toBeCloseTo(semKm.precoFinalSugerido + 250, 2);
      expect(result.seguro).toBe(semKm.seguro);
      expect(result.imposto).toBe(semKm.imposto);
      expect(result.lucroLiquidoRs).toBe(semKm.lucroLiquidoRs);
    });

    it('as parcelas arredondadas devem somar exatamente o preço final, sem sobra de centavos', () => {
      const result = CalculosProcess.calcularPrecoFinal({
        valorKitLicenciado: 12960,
        valorMaoDeObra: 80,
        valorEquipamentoLocal: 50,
        valorHomologacao: 500,
        porcentagemLucroLiquido: 15,
        quantidade_paineis: 15,
        km: 200,
        custo_km: 2,
        porcentagem_imposto: 6,
        porcentagem_seguro: 1,
      });

      const custoProjeto = result.custoDireto + result.margemSeguranca + result.seguro + result.imposto;
      expect(Number(custoProjeto.toFixed(2))).toBe(result.custoProjeto);
      expect(Number((result.custoProjeto + result.lucroLiquidoRs).toFixed(2))).toBe(result.precoFinalSugerido);
    });

    it('deve aumentar exatamente o custo do KM no preço final sem incidir margem de lucro, seguro ou imposto sobre o KM', () => {
      const baseInput = {
        valorKitLicenciado: 10000,
        valorMaoDeObra: 1000,
        valorEquipamentoLocal: 500,
        valorHomologacao: 500,
        porcentagemLucroLiquido: 20,
        quantidade_paineis: 1,
      };

      const semKm = CalculosProcess.calcularPrecoFinal(baseInput);
      const comKm = CalculosProcess.calcularPrecoFinal({
        ...baseInput,
        km: 400,
        custo_km: 2.0
      });

      expect(comKm.custoKmTotal).toBe(800);
      expect(comKm.precoFinalSugerido).toBeCloseTo(semKm.precoFinalSugerido + 800, 2);
      expect(comKm.lucroLiquidoRs).toBeCloseTo(semKm.lucroLiquidoRs, 2);
      expect(comKm.seguro).toBeCloseTo(semKm.seguro, 2);
      expect(comKm.imposto).toBeCloseTo(semKm.imposto, 2);
      expect(comKm.margemSeguranca).toBeCloseTo(semKm.margemSeguranca, 2);
    });

    it('deve calcular corretamente com alíquota de imposto customizada (ex: 10%)', () => {
      const input = {
        valorKitLicenciado: 10000,
        valorMaoDeObra: 1000,
        valorEquipamentoLocal: 500,
        valorHomologacao: 500,
        porcentagemLucroLiquido: 20,
        quantidade_paineis: 1,
        porcentagem_imposto: 10
      };

      const result = CalculosProcess.calcularPrecoFinal(input);
      expect(result.porcentagem_imposto).toBe(10);
      expect(result.imposto).toBeCloseTo((result.precoFinalSugerido - 10000) * 0.10, 1);
    });

    it('deve lançar erro se a porcentagem de lucro líquido desejada for maior que o limite permitido', () => {
      expect(() => {
        CalculosProcess.calcularPrecoFinal({
          valorKitLicenciado: 10000,
          valorMaoDeObra: 100,
          valorEquipamentoLocal: 50,
          valorHomologacao: 1000,
          porcentagemLucroLiquido: 92,
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
