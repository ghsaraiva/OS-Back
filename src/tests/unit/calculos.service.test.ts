import { describe, it, expect, vi, beforeEach } from 'vitest';
import calculosService from '../../services/calculos.service';
import { CalculosDataFetcher } from '../../services/calculos.dataFetcher';

// Mock do DataFetcher (mockando a camada de acesso a dados)
vi.mock('../../services/calculos.dataFetcher', () => ({
  CalculosDataFetcher: {
    obterCidadePorId: vi.fn(),
    obterCidadesHSP: vi.fn(),
    obterOrcamentoPorId: vi.fn(),
    listarOrcamentosSimplificados: vi.fn(),
    atualizarOrcamento: vi.fn(),
    criarOrcamento: vi.fn(),
  }
}));

describe('CalculosService Orquestrador (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Integração - Salvamento e Edição (Refinamento Gerencial)', () => {
    it('deve recalcular valores inteiramente e orquestrar salvamento via salvarRefinamentoGerencial', async () => {
      const mockOrcamentoOriginal = {
        id: 'orc123',
        id_cidade: 'cid123',
        consumo_mes: 500,
        valor_tarifa: 1.0,
        situacao: 'Aberto'
      };
      const mockCidade = { id: 'cid123', mediacalc: 5.0 };
      
      (CalculosDataFetcher.obterOrcamentoPorId as any).mockResolvedValue(mockOrcamentoOriginal);
      (CalculosDataFetcher.obterCidadePorId as any).mockResolvedValue(mockCidade);
      (CalculosDataFetcher.atualizarOrcamento as any).mockResolvedValue({ id: 'orc123', status: 'updated' });

      const input: any = {
        orcamentoId: 'orc123',
        potencia_painel: 550,
        quantidade_paineis: 10,
        peso_painel: 25,
        marca_modulo: 'Canadian',
        quantidade_inversores: 1,
        potencia_inversor: 5,
        modelo_inversor: 'Growatt',
        marca_inversor: 'Growatt',
        tensao_inversor: 220,
        valorKit: 10000,
        valorPorcentagem: 10,
        valorMaoDeObra: 2000,
        valorEquipamentoLocal: 500,
        valorHomologacao: 1000,
        porcentagemLucroLiquido: 15,
      };

      const result = await calculosService.salvarRefinamentoGerencial({}, input);
      
      expect(CalculosDataFetcher.atualizarOrcamento).toHaveBeenCalledWith(expect.anything(), 'orc123', expect.objectContaining({
        kwp_sistema: 5.5,
        valor_kit_final: 11000,
        situacao: 'Aberto',
        composicao_1: '10 módulos solares fotovoltaicos Canadian de 550W'
      }));
      expect(result.status).toBe('updated');
    });

    it('deve orquestrar atualizarPrecoVenda e calcular impostos, lucro e custo de projeto', async () => {
      const mockOrcamentoOriginal = {
        id: 'orc123',
        valor_kit_final: 11000,
        valor_mao_obra_final: 2000,
        valor_equip_local_final: 500,
        valor_homologacao: 1000,
        margem_seguranca: 577.67
      };
      
      (CalculosDataFetcher.obterOrcamentoPorId as any).mockResolvedValue(mockOrcamentoOriginal);
      (CalculosDataFetcher.atualizarOrcamento as any).mockResolvedValue({ id: 'orc123', preco_final_venda: 20000 });

      const result = await calculosService.atualizarPrecoVenda({}, 'orc123', 20000);

      expect(CalculosDataFetcher.atualizarOrcamento).toHaveBeenCalledWith(expect.anything(), 'orc123', expect.objectContaining({
        preco_final_venda: 20000,
        seguro: 200,
        imposto: 720,
        custo_projeto: 15997.67,
        lucro_liquido_previsto: 4002.33,
        lucro_liquido_perc: 20.01
      }));
      expect(result.preco_final_venda).toBe(20000);
    });

    it('atualizarPrecoVenda deve deduzir as taxas do valor quando a porcentagem está zerada (orçamento antigo)', async () => {
      (CalculosDataFetcher.obterOrcamentoPorId as any).mockResolvedValue({
        id: 'orc123',
        km: 400,
        custo_km: 2,
        valor_kit_final: 117363.71,
        porcentagem_imposto: 0,
        porcentagem_seguro: 0,
        imposto: 16422.76,
        seguro: 3402.73,
        preco_final_venda: 227648.75,
      });
      (CalculosDataFetcher.atualizarOrcamento as any).mockResolvedValue({ id: 'orc123' });

      await calculosService.atualizarPrecoVenda({}, 'orc123', 227648.75);

      expect(CalculosDataFetcher.atualizarOrcamento).toHaveBeenCalledWith(expect.anything(), 'orc123', expect.objectContaining({
        porcentagem_imposto: 15,
        porcentagem_seguro: 1.5,
        imposto: 16422.76,
        seguro: 3402.73,
      }));
    });

    it('atualizarPrecoVenda deve manter imposto zero quando a porcentagem e o valor são zero', async () => {
      (CalculosDataFetcher.obterOrcamentoPorId as any).mockResolvedValue({
        id: 'orc123',
        valor_kit_final: 10000,
        porcentagem_imposto: 0,
        imposto: 0,
        porcentagem_seguro: 1,
        preco_final_venda: 15000,
      });
      (CalculosDataFetcher.atualizarOrcamento as any).mockResolvedValue({ id: 'orc123' });

      await calculosService.atualizarPrecoVenda({}, 'orc123', 16000);

      expect(CalculosDataFetcher.atualizarOrcamento).toHaveBeenCalledWith(expect.anything(), 'orc123', expect.objectContaining({
        imposto: 0,
        seguro: 160,
        porcentagem_imposto: 0,
        porcentagem_seguro: 1,
      }));
    });

    it('atualizarPrecoVenda do associado deve alterar só o lucro dele', async () => {
      (CalculosDataFetcher.obterOrcamentoPorId as any).mockResolvedValue({
        id: 'orc123',
        km: 200,
        custo_km: 2,
        custo_projeto: 16782.36,
        seguro: 192.73,
        imposto: 378.8,
      });
      (CalculosDataFetcher.atualizarOrcamento as any).mockResolvedValue({ id: 'orc123' });

      await calculosService.atualizarPrecoVenda({}, 'orc123', 21000, true);

      expect(CalculosDataFetcher.atualizarOrcamento).toHaveBeenCalledWith(expect.anything(), 'orc123', {
        preco_final_venda: 21000,
        lucro_liquido_previsto: 4217.64,
        lucro_liquido_perc: 20.47,
      });
    });
  });

  describe('Cidades com HSP', () => {
    it('deve buscar e normalizar HSP na listagem de cidades via obterCidadesHSP', async () => {
      const mockRecords = [
        { id: '1', cidade: 'Cidade A', mediacalc: 5.2 },
        { id: '2', cidade: 'Cidade B', mediacalc: 5200 } // Cru, precisa de normalização
      ];
      (CalculosDataFetcher.obterCidadesHSP as any).mockResolvedValue(mockRecords);

      const result = await calculosService.obterCidadesHSP({});

      expect(result).toHaveLength(2);
      expect(result[0].mediacalc).toBe(5.2);
      expect(result[1].mediacalc).toBe(5.2);
    });

    it('deve buscar e normalizar HSP ao obter uma cidade por ID', async () => {
      const mockRecord = { id: '2', cidade: 'Cidade B', mediacalc: 5200 };
      (CalculosDataFetcher.obterCidadePorId as any).mockResolvedValue(mockRecord);

      const result = await calculosService.obterCidadePorId({}, '2');
      expect(result.mediacalc).toBe(5.2);
    });
  });

  describe('Dashboard e Métricas', () => {
    it('deve orquestrar obterMetricasDashboard e formatar corretamente os retornos', async () => {
      const mockRecords = [
        { id: '1', situacao: 'Aberto', nome_cliente: 'Gabriel ', estado: 'SP' },
        { id: '2', situacao: 'Aberto', nome_cliente: 'gabriel', estado: 'SP' },
        { id: '3', situacao: 'Técnico Finalizado', nome_cliente: 'Gabriel', estado: 'RJ' },
        { id: '4', situacao: 'Outro', nome_cliente: 'Maria Silva', estado: 'rj' },
        { id: '5', situacao: 'Outro', nome_cliente: '', estado: '' } // Cliente vazio não conta
      ];
      (CalculosDataFetcher.listarOrcamentosSimplificados as any).mockResolvedValue(mockRecords);

      const result = await calculosService.obterMetricasDashboard({}, 'user123', true);

      expect(result.kpis.total).toBe(5);
      expect(result.kpis.abertos).toBe(2);
      expect(result.kpis.concluidos).toBe(1);
      expect(result.kpis.clientes).toBe(2); // Gabriel, Maria

      expect(result.demographics).toHaveLength(2);
      expect(result.demographics.find((d: any) => d.name === 'SP')?.count).toBe(2);
      expect(result.demographics.find((d: any) => d.name === 'RJ')?.count).toBe(2);
    });
  });

  describe('Segurança de Perfis e Sanitização (Associado e Vendedor)', () => {
    it('sanitizarOrcamento deve ocultar custo e margem do kit para Associado, mas mostrar a margem de segurança', () => {
      const orcamentoMock = {
        id: 'orc1',
        nome_cliente: 'Cliente Teste',
        valor_kit: 15000,
        porcentagem_kit: 15,
        valor_kit_final: 17250,
        lucro_equipamento: 2250,
        margem_seguranca: 500,
        valor_mao_obra_final: 3000,
        preco_final_venda: 25000,
      };

      const sanitized = calculosService.sanitizarOrcamento(orcamentoMock, 'associado');

      expect(sanitized.valor_kit).toBeUndefined();
      expect(sanitized.porcentagem_kit).toBeUndefined();
      expect(sanitized.lucro_equipamento).toBeUndefined();
      // A margem de segurança é do associado: aparece como linha própria, fora do kit gerador
      expect(sanitized.margem_seguranca).toBe(500);
      expect(sanitized.valor_kit_final).toBe(17250);
      expect(sanitized.valor_kit_gerador).toBe(17250);
      expect(sanitized.valor_mao_obra_final).toBe(3000);
      expect(sanitized.preco_final_venda).toBe(25000);
    });

    it('sanitizarOrcamento deve ocultar dados financeiros e custos para Vendedor', () => {
      const orcamentoMock = {
        id: 'orc1',
        valor_kit: 15000,
        porcentagem_kit: 15,
        valor_kit_final: 17250,
        lucro_equipamento: 2250,
        custo_projeto: 20000,
        lucro_liquido_previsto: 5000,
        margem_seguranca: 500,
        porcentagem_margem_seguranca: 3,
        preco_final_venda: 25000,
      };

      const sanitized = calculosService.sanitizarOrcamento(orcamentoMock, 'vendedor');
      expect(sanitized.margem_seguranca).toBeUndefined();
      expect(sanitized.porcentagem_margem_seguranca).toBeUndefined();

      expect(sanitized.valor_kit).toBeUndefined();
      expect(sanitized.valor_kit_gerador).toBeUndefined();
      expect(sanitized.custo_projeto).toBeUndefined();
      expect(sanitized.lucro_liquido_previsto).toBeUndefined();
      expect(sanitized.preco_final_venda).toBe(25000);
    });

    it('sanitizarOrcamento deve manter todos os campos intactos para Admin', () => {
      const orcamentoMock = {
        id: 'orc1',
        valor_kit: 15000,
        valor_kit_final: 17250,
      };

      const sanitized = calculosService.sanitizarOrcamento(orcamentoMock, 'admin');
      expect(sanitized.valor_kit).toBe(15000);
      expect(sanitized.valor_kit_final).toBe(17250);
    });

    describe('atualizarCustosAssociado', () => {
      const custos = {
        mao_obra: 100,
        equipamento_local: 50,
        km: 400,
        custo_km: 2,
        porcentagem_imposto: 8,
        porcentagem_seguro: 1,
        lucro_liquido_perc: 15,
      };

      it('deve salvar apenas os custos e o total do km quando o kit ainda não foi precificado', async () => {
        (CalculosDataFetcher.atualizarOrcamento as any).mockResolvedValue({ id: 'orc1' });

        await calculosService.atualizarCustosAssociado({}, { id: 'orc1', valor_kit_final: 0, qtd_paineis: 0 }, custos);

        const payload = (CalculosDataFetcher.atualizarOrcamento as any).mock.calls[0][2];
        expect(payload).toEqual({ ...custos, porcentagem_margem_seguranca: 3, valor_total_km: 800 });
        expect(payload.preco_final_venda).toBeUndefined();
        expect(CalculosDataFetcher.obterCidadePorId).not.toHaveBeenCalled();
      });

      it('deve recalcular a cascata preservando o kit do admin quando o kit já foi precificado', async () => {
        (CalculosDataFetcher.obterCidadePorId as any).mockResolvedValue({ id: 'cid1', mediacalc: 5.0 });
        (CalculosDataFetcher.atualizarOrcamento as any).mockResolvedValue({ id: 'orc1' });

        const orcamento = {
          id: 'orc1',
          id_cidade: 'cid1',
          valor_kit: 12000,
          porcentagem_kit: 12,
          valor_kit_final: 13440,
          valor_homologacao: 500,
          qtd_paineis: 10,
          kwp_sistema: 5.5,
          valor_tarifa: 1.0,
          consumo_mes: 600,
          padrao: 'Bifásico',
        };

        await calculosService.atualizarCustosAssociado({}, orcamento, custos);

        const esperado = calculosService.calcularPrecoFinal({
          valorKitLicenciado: 13440,
          valorMaoDeObra: 100,
          valorEquipamentoLocal: 50,
          valorHomologacao: 500,
          porcentagemLucroLiquido: 15,
          quantidade_paineis: 10,
          km: 400,
          custo_km: 2,
          porcentagem_imposto: 8,
          porcentagem_seguro: 1,
        });

        const payload = (CalculosDataFetcher.atualizarOrcamento as any).mock.calls[0][2];
        expect(payload.preco_final_venda).toBe(esperado.precoFinalSugerido);
        expect(payload.valor_mao_obra_final).toBe(1000);
        expect(payload.valor_total_km).toBe(800);
        expect(payload.tempo_retorno).toBeTypeOf('string');
        expect(payload.valor_kit).toBeUndefined();
        expect(payload.valor_kit_final).toBeUndefined();
        expect(payload.porcentagem_kit).toBeUndefined();
      });

      it('deve recalcular com a margem de segurança do associado e deduzir a % de orçamento antigo', async () => {
        const orcamento = {
          id: 'orc1',
          id_cidade: 'c1',
          valor_kit_final: 13440,
          margem_seguranca: 415.67,
          qtd_paineis: 10,
          valor_homologacao: 500,
          kwp_sistema: 5.5,
          valor_tarifa: 1.0,
          consumo_mes: 600,
          padrao: 'Bifásico',
        };

        await calculosService.atualizarCustosAssociado({}, orcamento, { ...custos, porcentagem_margem_seguranca: 5 });
        const comCinco = (CalculosDataFetcher.atualizarOrcamento as any).mock.calls[0][2];
        expect(comCinco.porcentagem_margem_seguranca).toBe(5);
        expect(comCinco.margem_seguranca).toBe(812.63); // (13.440 + 1.000 + 500 + 500) / 0,95 - 15.440

        // Sem a % na requisição e sem a % gravada: deduz 3% do valor antigo (que era sobre o kit)
        // e recalcula a margem sobre o custo direto
        await calculosService.atualizarCustosAssociado({}, orcamento, custos);
        const semPorcentagem = (CalculosDataFetcher.atualizarOrcamento as any).mock.calls[1][2];
        expect(semPorcentagem.porcentagem_margem_seguranca).toBe(3);
        expect(semPorcentagem.margem_seguranca).toBe(477.53);
      });

      it('deve rejeitar lucro líquido acima do limite mesmo sem kit precificado', async () => {
        await expect(
          calculosService.atualizarCustosAssociado({}, { id: 'orc1' }, { ...custos, lucro_liquido_perc: 95 })
        ).rejects.toThrow('limite máximo permitido');
        expect(CalculosDataFetcher.atualizarOrcamento).not.toHaveBeenCalled();
      });
    });
  });
});

