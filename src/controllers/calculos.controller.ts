import { Request, Response, NextFunction } from 'express';
import calculosService from '../services/calculos.service';

export class CalculosController {
  dimensionamentoMinimo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('[DEBUG] Controller - dimensionamentoMinimo - Body:', req.body);
      const { id_cidade, consumo_mes, valor_tarifa } = req.body;
      if (!id_cidade || !consumo_mes || !valor_tarifa) {
        return res.status(400).json({ error: 'Campos obrigatórios: id_cidade, consumo_mes, valor_tarifa' });
      }
      const result = await calculosService.calcularDimensionamentoMinimo(req.body);
      return res.json(result);
    } catch (error: any) {
      console.error('[DEBUG] Controller - dimensionamentoMinimo - Error:', error);
      if (error.status === 404 || error.message.includes('not found') || error.message === 'HSP não encontrado para esta localidade') {
        return res.status(404).json({ error: 'Localidade não encontrada' });
      }
      next(error);
    }
  };

  criarSolicitacao = async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('[DEBUG] Controller - criarSolicitacao - Body:', req.body);
      const { user_id, nome_cliente, id_cidade, consumo_mes, valor_tarifa } = req.body;
      
      if (!user_id || !nome_cliente || !id_cidade || !consumo_mes || !valor_tarifa) {
        return res.status(400).json({ error: 'Campos obrigatórios: user_id, nome_cliente, id_cidade, consumo_mes, valor_tarifa' });
      }

      const result = await calculosService.criarSolicitacaoInicial(req.body);
      return res.status(201).json(result);
    } catch (error: any) {
      console.error('[DEBUG] Controller - criarSolicitacao - Error:', error);
      next(error);
    }
  };

  sistemaReal = (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Controller - sistemaReal - Body:', req.body);
      const { potencia_painel, quantidade_paineis } = req.body;
      if (!potencia_painel || !quantidade_paineis) {
        return res.status(400).json({ error: 'Potência e quantidade são obrigatórias' });
      }
      const result = calculosService.calcularSistemaReal({ potencia_painel, quantidade_paineis });
      return res.json(result);
    } catch (error: any) {
      console.error('[DEBUG] Controller - sistemaReal - Error:', error);
      res.status(500).json({ error: 'Erro ao calcular sistema real' });
    }
  };

  retornoFinanceiro = (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Controller - retornoFinanceiro - Body:', req.body);
      const { kwp_sistema, mediacalc, valor_tarifa, consumo_mes_rs, padrao, valor_investido, quantidade_paineis } = req.body;
      if (kwp_sistema === undefined || mediacalc === undefined || valor_tarifa === undefined) {
        return res.status(400).json({ error: 'Campos obrigatórios: kwp_sistema, mediacalc, valor_tarifa' });
      }
      const result = calculosService.calcularGeracaoERetorno({ 
        kwp_sistema, 
        mediacalc, 
        valor_tarifa,
        consumo_mes_rs: consumo_mes_rs || 0,
        padrao: padrao || 'Trifásico',
        valor_investido: valor_investido || 0,
        quantidade_paineis: quantidade_paineis || 0
      });
      return res.json(result);
    } catch (error: any) {
      console.error('[DEBUG] Controller - retornoFinanceiro - Error:', error);
      res.status(500).json({ error: 'Erro ao calcular retorno financeiro' });
    }
  };

  licenciamentoKit = (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Controller - licenciamentoKit - Body:', req.body);
      const { valorKit, valorPorcentagem } = req.body;
      if (valorKit === undefined || valorPorcentagem === undefined) {
        return res.status(400).json({ error: 'Campos obrigatórios: valorKit, valorPorcentagem' });
      }
      const result = calculosService.calcularLicenciamentoKit({ valorKit, valorPorcentagem });
      return res.json(result);
    } catch (error: any) {
      console.error('[DEBUG] Controller - licenciamentoKit - Error:', error);
      res.status(500).json({ error: 'Erro ao calcular licenciamento do kit' });
    }
  };

  precoFinal = (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Controller - precoFinal - Body:', req.body);
      const { 
        valorKitLicenciado, 
        valorMaoDeObra, 
        valorEquipamentoLocal, 
        valorHomologacao, 
        porcentagemLucroLiquido,
        quantidade_paineis
      } = req.body;

      if (
        valorKitLicenciado === undefined || 
        valorMaoDeObra === undefined || 
        valorEquipamentoLocal === undefined || 
        valorHomologacao === undefined || 
        porcentagemLucroLiquido === undefined ||
        quantidade_paineis === undefined
      ) {
        return res.status(400).json({ error: 'Todos os campos de precificação são obrigatórios, incluindo quantidade_paineis' });
      }

      const result = calculosService.calcularPrecoFinal({
        valorKitLicenciado,
        valorMaoDeObra,
        valorEquipamentoLocal,
        valorHomologacao,
        porcentagemLucroLiquido,
        quantidade_paineis
      });

      return res.json(result);
    } catch (error: any) {
      console.error('[DEBUG] Controller - precoFinal - Error:', error);
      if (error instanceof Error && error.message.includes('limite máximo permitido')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Erro ao calcular preço final' });
    }
  };

  salvarRefinamento = async (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Controller - salvarRefinamento - Body:', req.body);
      const { orcamentoId } = req.body;

      if (!orcamentoId) {
        return res.status(400).json({ error: 'O ID do orçamento é obrigatório para salvar o refinamento.' });
      }

      const result = await calculosService.salvarRefinamentoGerencial(req.body);
      return res.json({ 
        success: true, 
        message: 'Orçamento gerencial salvo com sucesso!', 
        data: result 
      });
    } catch (error: any) {
      console.error('[DEBUG] Controller - salvarRefinamento - Error:', error);
      res.status(500).json({ error: error.message || 'Erro ao salvar refinamento' });
    }
  };

  dashboardStats = async (req: Request, res: Response) => {
    try {
      console.log('[DEBUG] Controller - dashboardStats - Query:', req.query);
      const userId = (req.query.userId || req.query.user_id) as string;
      const isAdminQuery = (req.query.isAdmin || req.query.is_admin) as string;
      const isAdmin = isAdminQuery === 'true';

      const result = await calculosService.obterMetricasDashboard(userId, isAdmin);
      return res.json(result);
    } catch (error: any) {
      console.error('[DEBUG] Controller - dashboardStats - Error:', error);
      res.status(500).json({ error: error.message || 'Erro ao obter estatísticas do dashboard' });
    }
  };
}

export default new CalculosController();
