import { Request, Response, NextFunction } from 'express';
import calculosService from '../services/calculos.service';

export class CalculosController {
  dimensionamentoMinimo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id_cidade, consumo_mes, valor_tarifa } = req.body;
      if (!id_cidade || !consumo_mes || !valor_tarifa) {
        return res.status(400).json({ error: 'Campos obrigatórios: id_cidade, consumo_mes, valor_tarifa' });
      }
      const result = await calculosService.calcularDimensionamentoMinimo(req.pb!, req.body);
      return res.json(result);
    } catch (error: any) {
      if (error.status === 404 || error.message.includes('not found') || error.message === 'HSP não encontrado para esta localidade') {
        return res.status(404).json({ error: 'Localidade não encontrada' });
      }
      next(error);
    }
  };

  criarSolicitacao = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user_id = req.user?.id;
      const { nome_cliente, id_cidade, consumo_mes, valor_tarifa } = req.body;
      
      if (!user_id || !nome_cliente || !id_cidade || !consumo_mes || !valor_tarifa) {
        return res.status(400).json({ error: 'Campos obrigatórios: nome_cliente, id_cidade, consumo_mes, valor_tarifa' });
      }

      const result = await calculosService.criarSolicitacaoInicial(req.pb!, { ...req.body, user_id });
      return res.status(201).json(result);
    } catch (error: any) {
      next(error);
    }
  };

  sistemaReal = (req: Request, res: Response) => {
    try {
      const { potencia_painel, quantidade_paineis } = req.body;
      if (!potencia_painel || !quantidade_paineis) {
        return res.status(400).json({ error: 'Potência e quantidade são obrigatórias' });
      }
      const result = calculosService.calcularSistemaReal({ potencia_painel, quantidade_paineis });
      return res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao calcular sistema real' });
    }
  };

  retornoFinanceiro = (req: Request, res: Response) => {
    try {
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
      res.status(500).json({ error: 'Erro ao calcular retorno financeiro' });
    }
  };

  licenciamentoKit = (req: Request, res: Response) => {
    try {
      const { valorKit, valorPorcentagem } = req.body;
      if (valorKit === undefined || valorPorcentagem === undefined) {
        return res.status(400).json({ error: 'Campos obrigatórios: valorKit, valorPorcentagem' });
      }
      const result = calculosService.calcularLicenciamentoKit({ valorKit, valorPorcentagem });
      return res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao calcular licenciamento do kit' });
    }
  };

  precoFinal = (req: Request, res: Response) => {
    try {
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
      if (error instanceof Error && error.message.includes('limite máximo permitido')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Erro ao calcular preço final' });
    }
  };

  salvarRefinamento = async (req: Request, res: Response) => {
    try {
      const { orcamentoId } = req.body;

      if (!orcamentoId) {
        return res.status(400).json({ error: 'O ID do orçamento é obrigatório para salvar o refinamento.' });
      }

      const result = await calculosService.salvarRefinamentoGerencial(req.pb!, req.body);
      return res.json({ 
        success: true, 
        message: 'Orçamento gerencial salvo com sucesso!', 
        data: result 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao salvar refinamento' });
    }
  };

  dashboardStats = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.tipo_acesso === 'admin';

      const result = await calculosService.obterMetricasDashboard(req.pb!, userId, isAdmin);
      return res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao obter estatísticas do dashboard' });
    }
  };

  listarUsuarios = async (req: Request, res: Response) => {
    try {
      if (req.user?.tipo_acesso !== 'admin') {
        return res.status(403).json({ error: 'Acesso Proibido: Permissão insuficiente.' });
      }
      const result = await calculosService.obterTodosUsuarios(req.pb!);
      return res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao listar usuários' });
    }
  };

  listarOrcamentos = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.tipo_acesso === 'admin';
      const result = await calculosService.listarTodosOrcamentos(req.pb!, userId, isAdmin);
      return res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao listar orçamentos' });
    }
  };

  listarCidades = async (req: Request, res: Response) => {
    try {
      const search = req.query.search as string;
      const result = await calculosService.obterCidadesHSP(req.pb!, search);
      return res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao listar cidades' });
    }
  };

  obterCidade = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const result = await calculosService.obterCidadePorId(req.pb!, id);
      return res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao obter cidade por ID' });
    }
  };

  obterOrcamento = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const result = await calculosService.obterOrcamentoPorId(req.pb!, id);
      return res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao obter orçamento' });
    }
  };

  atualizarOrcamento = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const result = await calculosService.atualizarOrcamentoParcial(req.pb!, id, req.body);
      return res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar orçamento' });
    }
  };

  criarUsuario = async (req: Request, res: Response) => {
    try {
      if (req.user?.tipo_acesso !== 'admin') {
        return res.status(403).json({ error: 'Acesso Proibido: Permissão insuficiente.' });
      }
      const result = await calculosService.criarNovoUsuario(req.pb!, req.body);
      return res.status(201).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao criar usuário' });
    }
  };
}

export default new CalculosController();
