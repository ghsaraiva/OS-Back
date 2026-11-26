import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import calculosService from '../services/calculos.service';
import { PdfService } from '../services/pdf.service';
import { EmailService } from '../services/email.service';
import { NotificacaoService } from '../services/notificacao.service';
import pb, { authenticatePB } from '../config/pocketbase';

// Campos que o usuário pode mandar ao criar uma solicitação; kit, preço e resultados de cálculo nunca vêm do cliente.
const CAMPOS_SOLICITACAO = [
  'nome_cliente', 'telefone_cliente', 'email_cliente', 'estado', 'cidade', 'id_cidade',
  'consumo_mes', 'valor_tarifa', 'estrutura', 'padrao', 'observacao',
] as const;
// Custos operacionais: só associado (e admin) definem; para o vendedor valem os padrões do backend.
const CAMPOS_CUSTOS = [
  'mao_obra', 'equipamento_local', 'lucro_liquido_perc', 'km', 'custo_km', 'porcentagem_imposto', 'porcentagem_seguro',
  'porcentagem_margem_seguranca',
] as const;

export class CalculosController {
  private pdfService = new PdfService();

  /**
   * A coleção orcamentos só é acessível ao admin no PocketBase. Para os demais perfis o backend
   * lê e grava como superusuário, sempre depois de conferir perfil e dono do orçamento.
   */
  private async pbServidor() {
    await authenticatePB();
    return pb;
  }

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
      
      if (!user_id) {
        return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
      }

      const faltando = [
        !nome_cliente && 'nome do cliente',
        !id_cidade && 'cidade',
        !(Number(consumo_mes) > 0) && 'consumo mensal (maior que zero)',
        !(Number(valor_tarifa) > 0) && 'tarifa de energia (maior que zero)',
      ].filter(Boolean);
      if (faltando.length > 0) {
        return res.status(400).json({ error: `Preencha: ${faltando.join(', ')}.` });
      }

      const podeDefinirCustos = req.user?.tipo_acesso === 'associado' || req.user?.tipo_acesso === 'admin';
      const campos: readonly string[] = podeDefinirCustos ? [...CAMPOS_SOLICITACAO, ...CAMPOS_CUSTOS] : CAMPOS_SOLICITACAO;
      const input = Object.fromEntries(campos.filter((c) => req.body[c] !== undefined).map((c) => [c, req.body[c]]));
      if (input.porcentagem_margem_seguranca !== undefined) {
        const margem = Number(input.porcentagem_margem_seguranca);
        if (!Number.isFinite(margem) || margem < 0 || margem >= 100) {
          return res.status(400).json({ error: 'A margem de segurança deve estar entre 0% e 100%.' });
        }
        input.porcentagem_margem_seguranca = margem;
      }

      const pbServidor = await this.pbServidor();
      const result = await calculosService.criarSolicitacaoInicial(pbServidor, { ...input, user_id } as any);

      // Avisa os admins (sino + e-mail) sem atrasar nem derrubar a criação do orçamento
      if (req.user?.tipo_acesso !== 'admin') {
        NotificacaoService.notificarNovoOrcamento(pbServidor, result, req.user as any).catch((erro) =>
          console.error('Erro ao notificar novo orçamento:', erro?.response?.data || erro?.message || erro),
        );
      }

      return res.status(201).json(calculosService.sanitizarOrcamento(result, req.user?.tipo_acesso));
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

  homologacao = (req: Request, res: Response) => {
    try {
      const { potencia_inversor, quantidade_inversores } = req.body;
      if (potencia_inversor === undefined) {
        return res.status(400).json({ error: 'Campo obrigatório: potencia_inversor' });
      }
      const pot = typeof potencia_inversor === 'number' ? potencia_inversor : parseFloat(potencia_inversor);
      const qtd = typeof quantidade_inversores === 'number' ? quantidade_inversores : parseInt(quantidade_inversores);
      const potenciaTotal = (pot || 0) * (qtd || 1);
      const valorHomologacao = calculosService.calcularValorHomologacao(potenciaTotal);
      return res.json({ valorHomologacao });
    } catch (error: any) {
      res.status(500).json({ error: 'Erro ao calcular valor da homologação' });
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
        quantidade_paineis,

        quantidade_inversores,
        potencia_inversor,
        km,
        custo_km,
        porcentagem_imposto,
        porcentagem_seguro,
        porcentagem_margem_seguranca
      } = req.body;

      if (
        valorKitLicenciado === undefined || 
        valorMaoDeObra === undefined || 
        valorEquipamentoLocal === undefined || 
        (valorHomologacao === undefined && potencia_inversor === undefined) || 
        porcentagemLucroLiquido === undefined ||
        quantidade_paineis === undefined
      ) {
        return res.status(400).json({ error: 'Todos os campos de precificação são obrigatórios, incluindo quantidade_paineis e homologação/inversor' });
      }

      const result = calculosService.calcularPrecoFinal({
        valorKitLicenciado,
        valorMaoDeObra,
        valorEquipamentoLocal,
        valorHomologacao,
        porcentagemLucroLiquido,
        quantidade_paineis,

        quantidade_inversores,
        potencia_inversor,
        km: km !== undefined ? Number(km) : undefined,
        custo_km: custo_km !== undefined ? Number(custo_km) : undefined,
        porcentagem_imposto: porcentagem_imposto !== undefined ? Number(porcentagem_imposto) : undefined,
        porcentagem_seguro: porcentagem_seguro !== undefined ? Number(porcentagem_seguro) : undefined,
        porcentagem_margem_seguranca: porcentagem_margem_seguranca !== undefined ? Number(porcentagem_margem_seguranca) : undefined
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
      console.error('Erro detalhado em salvarRefinamento:', {
        message: error?.message,
        status: error?.status,
        data: error?.response?.data || error?.data || error
      });
      res.status(500).json({ 
        error: error.message || 'Erro ao salvar refinamento',
        details: error?.response?.data || error?.data
      });
    }
  };

  private lerCustosAssociado(body: any): { input?: Record<string, number>; erro?: string } {
    const campos = ['mao_obra', 'equipamento_local', 'km', 'custo_km', 'porcentagem_imposto', 'porcentagem_seguro', 'lucro_liquido_perc'] as const;
    const input: Record<string, number> = {};
    for (const campo of campos) {
      const valor = Number(body[campo]);
      if (body[campo] === undefined || body[campo] === null || !Number.isFinite(valor) || valor < 0) {
        return { erro: `Campo inválido ou ausente: ${campo}` };
      }
      input[campo] = valor;
    }
    // Opcional: sem ela, vale a porcentagem já gravada no orçamento
    if (body.porcentagem_margem_seguranca !== undefined && body.porcentagem_margem_seguranca !== null) {
      const margem = Number(body.porcentagem_margem_seguranca);
      if (!Number.isFinite(margem) || margem < 0 || margem >= 100) {
        return { erro: 'Campo inválido: porcentagem_margem_seguranca' };
      }
      input.porcentagem_margem_seguranca = margem;
    }
    return { input };
  }

  private async obterOrcamentoDoAssociado(req: Request, res: Response) {
    const orcamento = await calculosService.obterOrcamentoPorId(await this.pbServidor(), req.params.id as string);
    if (!orcamento) {
      res.status(404).json({ error: 'Orçamento não encontrado.' });
      return null;
    }
    if (orcamento.user_id !== req.user?.id) {
      res.status(403).json({ error: 'Acesso Proibido: Você só pode editar seus próprios orçamentos.' });
      return null;
    }
    return orcamento;
  }

  private erroDeMargem(error: any) {
    return error instanceof Error && (error.message.includes('limite máximo permitido') || error.message.includes('não pode ser igual ou superior'));
  }

  atualizarCustosAssociado = async (req: Request, res: Response) => {
    try {
      const { input, erro } = this.lerCustosAssociado(req.body);
      if (erro) {
        return res.status(400).json({ error: erro });
      }

      const orcamento = await this.obterOrcamentoDoAssociado(req, res);
      if (!orcamento) return;

      const result = await calculosService.atualizarCustosAssociado(await this.pbServidor(), orcamento, input as any);

      return res.json(calculosService.sanitizarOrcamento(result, req.user?.tipo_acesso));
    } catch (error: any) {
      if (this.erroDeMargem(error)) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || 'Erro ao atualizar custos do orçamento' });
    }
  };

  atualizarSolicitacaoAssociado = async (req: Request, res: Response) => {
    try {
      const { nome_cliente, telefone_cliente, email_cliente, id_cidade, observacao, estrutura, padrao, consumo_mes, valor_tarifa } = req.body;

      const faltando = [
        !nome_cliente && 'nome do cliente',
        !id_cidade && 'cidade',
        !estrutura && 'estrutura',
        !padrao && 'padrão de entrada',
        !(Number(consumo_mes) > 0) && 'consumo mensal (maior que zero)',
        !(Number(valor_tarifa) > 0) && 'tarifa de energia (maior que zero)',
      ].filter(Boolean);
      if (faltando.length > 0) {
        return res.status(400).json({ error: `Preencha: ${faltando.join(', ')}.` });
      }

      const { input: custos, erro } = this.lerCustosAssociado(req.body);
      if (erro) {
        return res.status(400).json({ error: erro });
      }

      const orcamento = await this.obterOrcamentoDoAssociado(req, res);
      if (!orcamento) return;

      // Só os campos da solicitação: nada de kit, preço ou dono vindo do corpo da requisição.
      const dados = {
        nome_cliente: String(nome_cliente).trim(),
        telefone_cliente: telefone_cliente ? String(telefone_cliente) : '',
        email_cliente: email_cliente ? String(email_cliente).trim() : '',
        id_cidade: String(id_cidade),
        observacao: observacao ? String(observacao) : '',
        estrutura: String(estrutura),
        padrao: String(padrao),
        consumo_mes: Number(consumo_mes),
        valor_tarifa: Number(valor_tarifa),
      };

      const result = await calculosService.atualizarSolicitacaoAssociado(await this.pbServidor(), orcamento, dados, custos as any);

      return res.json(calculosService.sanitizarOrcamento(result, req.user?.tipo_acesso));
    } catch (error: any) {
      if (this.erroDeMargem(error)) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message || 'Erro ao atualizar a solicitação' });
    }
  };

  atualizarPrecoVenda = async (req: Request, res: Response) => {
    try {
      const tipoAcesso = req.user?.tipo_acesso;
      if (tipoAcesso !== 'admin' && tipoAcesso !== 'associado') {
        return res.status(403).json({ error: 'Acesso Proibido: Você não tem permissão para editar o preço de venda.' });
      }

      const id = req.params.id as string;
      const preco_final_venda = Number(req.body.preco_final_venda);

      if (!id || !Number.isFinite(preco_final_venda) || preco_final_venda <= 0) {
        return res.status(400).json({ error: 'ID do orçamento e preco_final_venda (maior que zero) são obrigatórios.' });
      }

      const pb = await this.pbServidor();
      const orcamento = await calculosService.obterOrcamentoPorId(pb, id);
      if (!orcamento) {
        return res.status(404).json({ error: 'Orçamento não encontrado.' });
      }

      if (tipoAcesso === 'associado') {
        if (orcamento.user_id !== req.user?.id) {
          return res.status(403).json({ error: 'Acesso Proibido: Você só pode editar seus próprios orçamentos.' });
        }
        if (!orcamento.valor_kit_final || orcamento.valor_kit_final <= 0) {
          return res.status(400).json({ error: 'O preço de venda só pode ser alterado depois que o kit for precificado pela administração.' });
        }
      } else if (await calculosService.donoEhAssociado(pb, orcamento.user_id)) {
        return res.status(403).json({ error: 'Acesso Proibido: O preço de venda de orçamentos de associados é definido pelo próprio associado.' });
      }

      const result = await calculosService.atualizarPrecoVenda(pb, id, preco_final_venda, tipoAcesso === 'associado');
      return res.json(calculosService.sanitizarOrcamento(result, tipoAcesso));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar preço de venda' });
    }
  };

  configMargensLucro = (req: Request, res: Response) => {
    try {
      const result = calculosService.obterConfigMargensLucro();
      return res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao obter configuração de margens' });
    }
  };

  dashboardStats = async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const isAdmin = req.user?.tipo_acesso === 'admin';

      const result = await calculosService.obterMetricasDashboard(await this.pbServidor(), userId, isAdmin);
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
      const result = await calculosService.listarTodosOrcamentos(await this.pbServidor(), userId, isAdmin);

      if (!isAdmin) {
        if (Array.isArray(result)) {
          return res.json(result.map(o => calculosService.sanitizarOrcamento(o, req.user?.tipo_acesso)));
        } else if (result && Array.isArray(result.items)) {
          return res.json({
            ...result,
            items: result.items.map((o: any) => calculosService.sanitizarOrcamento(o, req.user?.tipo_acesso))
          });
        }
      }

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
      const result = await calculosService.obterOrcamentoPorId(await this.pbServidor(), id);
      if (!result) {
        return res.status(404).json({ error: 'Orçamento não encontrado.' });
      }

      const isAdmin = req.user?.tipo_acesso === 'admin';
      if (!isAdmin && result.user_id !== req.user?.id) {
        return res.status(403).json({ error: 'Acesso Proibido: Você só tem permissão para visualizar seus próprios orçamentos.' });
      }

      return res.json(calculosService.sanitizarOrcamento(result, req.user?.tipo_acesso));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao obter orçamento' });
    }
  };

  atualizarOrcamento = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;

      // Rota genérica usada só para salvar o e-mail do cliente; as demais alterações têm rotas próprias.
      if (typeof req.body?.email_cliente !== 'string' || Object.keys(req.body).length !== 1) {
        return res.status(400).json({ error: 'Só o campo email_cliente pode ser alterado por esta rota.' });
      }

      const pb = await this.pbServidor();
      const orcamento = await calculosService.obterOrcamentoPorId(pb, id);
      if (!orcamento) {
        return res.status(404).json({ error: 'Orçamento não encontrado.' });
      }
      if (req.user?.tipo_acesso !== 'admin' && orcamento.user_id !== req.user?.id) {
        return res.status(403).json({ error: 'Acesso Proibido: Você só pode editar seus próprios orçamentos.' });
      }

      const result = await calculosService.atualizarOrcamentoParcial(pb, id, { email_cliente: req.body.email_cliente.trim() });
      return res.json(calculosService.sanitizarOrcamento(result, req.user?.tipo_acesso));
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

      // Dispara e-mail de boas-vindas assíncrono com dados de acesso e senha temporária
      if (req.body.email && req.body.password) {
        EmailService.enviarBoasVindasNovoUsuario({
          toEmail: req.body.email,
          userName: req.body.name || 'Colaborador',
          tempPassword: req.body.password,
          tipoAcesso: req.body.tipo_acesso === 'admin' ? 'Administrador' : req.body.tipo_acesso === 'associado' ? 'Associado' : 'Vendedor',
        }).catch(() => {});
      }

      return res.status(201).json(result);
    } catch (error: any) {
      const responseData = error?.response?.data || error?.data || {};

      if (
        responseData.email?.code === 'validation_not_unique' ||
        responseData.email?.message?.toLowerCase().includes('already') ||
        error?.message?.toLowerCase().includes('email')
      ) {
        return res.status(400).json({ error: 'Este e-mail já está cadastrado no sistema.' });
      }

      if (
        responseData.username?.code === 'validation_not_unique' ||
        responseData.username?.message?.toLowerCase().includes('already')
      ) {
        return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
      }

      const status = error?.status || error?.response?.status || 400;
      res.status(status).json({ error: error?.message || 'Erro ao criar usuário.' });
    }
  };

  alterarSenhaPrimeiroAcesso = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { password, passwordConfirm } = req.body;

      // Apenas o próprio usuário pode trocar sua senha de primeiro acesso
      if (req.user?.id !== id) {
        return res.status(403).json({ error: 'Acesso Proibido: você só pode alterar sua própria senha.' });
      }

      if (!password || !passwordConfirm) {
        return res.status(400).json({ error: 'Os campos senha e confirmação são obrigatórios.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
      }

      if (password !== passwordConfirm) {
        return res.status(400).json({ error: 'As senhas não coincidem.' });
      }

      const result = await calculosService.alterarSenhaPrimeiroAcesso(
        req.pb!,
        id,
        password,
        passwordConfirm
      );

      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('❌ Erro ao alterar senha de primeiro acesso:', error?.message, error?.response?.data);
      res.status(500).json({ error: error.message || 'Erro ao alterar senha' });
    }
  };

  gerarPdf = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!id) {
        return res.status(400).json({ error: 'ID do orçamento é obrigatório.' });
      }

      const pb = await this.pbServidor();
      const orcamento = await calculosService.obterOrcamentoPorId(pb, id);
      if (!orcamento) {
        return res.status(404).json({ error: 'Orçamento não encontrado.' });
      }

      const isAdmin = req.user?.tipo_acesso === 'admin';
      if (!isAdmin && orcamento.user_id !== req.user?.id) {
        return res.status(403).json({ error: 'Acesso Proibido: Você só tem permissão para gerar proposta dos seus próprios orçamentos.' });
      }

      if (!orcamento.valor_kit_final || orcamento.valor_kit_final <= 0) {
        return res.status(400).json({ error: 'A proposta comercial ainda não pode ser gerada. O kit solar aguarda cotação e aprovação da administração.' });
      }

      const pdfBuffer = await PdfService.gerarPdfProposta(orcamento);

      let nomeBase = 'cliente';
      if (orcamento.nome_cliente) {
        const parts = orcamento.nome_cliente.trim().split(/\s+/);
        if (parts.length >= 2) {
          nomeBase = `${parts[0]}_${parts[parts.length - 1]}`;
        } else if (parts.length === 1) {
          nomeBase = parts[0];
        }
      }
      
      // Remove caracteres especiais para evitar problemas na URL e deixa em letras minúsculas
      nomeBase = nomeBase.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const nomeArquivo = `proposta_${nomeBase}.pdf`;

      // Update record in PocketBase using plain object and File
      const pdfFile = new File([new Uint8Array(pdfBuffer)], nomeArquivo, { type: 'application/pdf' });
      const updatedRecord = await pb.collection('orcamentos').update(id, {
        pdf_proposta: pdfFile
      });

      const baseUrl = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
      const pdfUrl = `${baseUrl}/api/files/orcamentos/${id}/${updatedRecord.pdf_proposta}`;

      return res.json({ success: true, pdfUrl });
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      if (error.response?.data) {
        console.error('Detalhes do erro do PocketBase:', JSON.stringify(error.response.data, null, 2));
      }
      res.status(500).json({ error: error.message || 'Erro interno ao gerar PDF' });
    }
  };

  enviarEmailProposta = async (req: Request, res: Response) => {
    try {
      const { email, clientName, budgetTitle, pdfUrl, budgetId, pdfFilename } = req.body;

      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'Informe um e-mail de destino válido.' });
      }

      if (budgetId) {
        const orcamento = await calculosService.obterOrcamentoPorId(await this.pbServidor(), budgetId);
        if (orcamento) {
          const isAdmin = req.user?.tipo_acesso === 'admin';
          if (!isAdmin && orcamento.user_id !== req.user?.id) {
            return res.status(403).json({ error: 'Acesso Proibido: Você só tem permissão para enviar propostas dos seus próprios orçamentos.' });
          }
          if (!orcamento.valor_kit_final || orcamento.valor_kit_final <= 0) {
            return res.status(400).json({ error: 'A proposta comercial não pode ser enviada enquanto o kit aguardar cotação da administração.' });
          }
        }
      }

      // Baixa o PDF direto do PocketBase interno (autenticado) para evitar 404 da URL pública
      let pdfBuffer: Buffer | undefined;
      if (budgetId && pdfFilename) {
        try {
          const pbBaseUrl = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
          const internalPdfUrl = `${pbBaseUrl}/api/files/orcamentos/${budgetId}/${pdfFilename}`;
          // Token do superusuário: o arquivo é da coleção orcamentos, que só o admin acessa direto
          const pbToken = (await this.pbServidor()).authStore.token;
          const headers: Record<string, string> = {};
          if (pbToken) headers['Authorization'] = pbToken;
          const response = await axios.get(internalPdfUrl, { responseType: 'arraybuffer', headers });
          pdfBuffer = Buffer.from(response.data);
        } catch (pdfErr: any) {
          console.error('Aviso: não foi possível baixar o PDF para anexo:', pdfErr?.message);
          // Continua sem o PDF anexado
        }
      }

      const success = await EmailService.enviarOrcamentoCliente({
        toEmail: email.trim(),
        clientName: clientName || 'Cliente',
        budgetTitle: budgetTitle || 'Proposta de Energia Solar',
        pdfUrl,
        pdfBuffer,
      });

      if (!success) {
        return res.status(500).json({ error: 'Não foi possível enviar o e-mail. Verifique se a chave do Resend está configurada.' });
      }

      return res.json({ success: true, message: 'Proposta enviada com sucesso por e-mail!' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Erro ao enviar e-mail da proposta.' });
    }
  };

  atualizarPerfilUsuario = async (req: Request, res: Response) => {
    try {
      const rawId = req.params.id;
      const id = Array.isArray(rawId) ? rawId[0] : rawId;
      const { name } = req.body;

      if (req.user?.id !== id && req.user?.tipo_acesso !== 'admin') {
        return res.status(403).json({ error: 'Acesso Proibido: você só pode atualizar seu próprio perfil.' });
      }

      const formData = new FormData();
      if (name && typeof name === 'string' && name.trim()) {
        formData.append('name', name.trim());
      }

      if (req.file) {
        const fileBlob = new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype });
        formData.append('avatar', fileBlob, req.file.originalname);
      }

      await authenticatePB();
      const record = await pb.collection('users').update(id, formData);

      return res.json({ success: true, record });
    } catch (error: any) {
      console.error('❌ Erro ao atualizar perfil do usuário:', error);
      return res.status(500).json({ error: error.message || 'Erro ao atualizar perfil do usuário.' });
    }
  };

  listarNotificacoes = async (req: Request, res: Response) => {
    try {
      return res.json(await NotificacaoService.listar(await this.pbServidor(), req.user!.id));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao listar notificações' });
    }
  };

  marcarNotificacaoLida = async (req: Request, res: Response) => {
    try {
      const ok = await NotificacaoService.marcarLida(await this.pbServidor(), req.user!.id, req.params.id as string);
      if (!ok) return res.status(404).json({ error: 'Notificação não encontrada.' });
      return res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao marcar notificação' });
    }
  };

  marcarTodasNotificacoesLidas = async (req: Request, res: Response) => {
    try {
      const total = await NotificacaoService.marcarTodasLidas(await this.pbServidor(), req.user!.id);
      return res.json({ success: true, total });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao marcar notificações' });
    }
  };
}

export default new CalculosController();

