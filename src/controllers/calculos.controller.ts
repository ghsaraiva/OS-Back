import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import calculosService from '../services/calculos.service';
import { PdfService } from '../services/pdf.service';
import { EmailService } from '../services/email.service';
import pb, { authenticatePB } from '../config/pocketbase';

export class CalculosController {
  private pdfService = new PdfService();

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
        potencia_inversor
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
        potencia_inversor
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

  atualizarPrecoVenda = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { preco_final_venda } = req.body;

      if (!id || preco_final_venda === undefined || preco_final_venda <= 0) {
        return res.status(400).json({ error: 'ID do orçamento e preco_final_venda (maior que zero) são obrigatórios.' });
      }

      const result = await calculosService.atualizarPrecoVenda(req.pb!, id, preco_final_venda);
      return res.json(result);
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

      // Dispara e-mail de boas-vindas assíncrono com dados de acesso e senha temporária
      if (req.body.email && req.body.password) {
        EmailService.enviarBoasVindasNovoUsuario({
          toEmail: req.body.email,
          userName: req.body.name || 'Colaborador',
          tempPassword: req.body.password,
          tipoAcesso: req.body.tipo_acesso === 'admin' ? 'Administrador' : 'Vendedor',
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

      const orcamento = await calculosService.obterOrcamentoPorId(req.pb!, id);
      if (!orcamento) {
        return res.status(404).json({ error: 'Orçamento não encontrado.' });
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
      const updatedRecord = await req.pb!.collection('orcamentos').update(id, {
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

      // Baixa o PDF direto do PocketBase interno (autenticado) para evitar 404 da URL pública
      let pdfBuffer: Buffer | undefined;
      if (budgetId && pdfFilename) {
        try {
          const pbBaseUrl = (process.env.POCKETBASE_URL || 'http://127.0.0.1:8090').replace(/\/$/, '');
          const internalPdfUrl = `${pbBaseUrl}/api/files/orcamentos/${budgetId}/${pdfFilename}`;
          // Usa o token do usuário autenticado na requisição atual
          const pbToken = req.pb?.authStore?.token;
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
}

export default new CalculosController();

