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
        seguro: 300,
        imposto: 1350,
        custo_projeto: 16727.67,
        lucro_liquido_previsto: 3272.33,
        lucro_liquido_perc: 16.36
      }));
      expect(result.preco_final_venda).toBe(20000);
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
});
