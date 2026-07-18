import { Router } from 'express';
import calculosController from '../controllers/calculos.controller';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Aplica o middleware de autenticação obrigatoriamente em todas as rotas
router.use(authenticateToken);

// Seção 1 (Captação)
router.post('/dimensionamento-minimo', calculosController.dimensionamentoMinimo);
router.post('/criar-solicitacao', calculosController.criarSolicitacao);

// Seção 2 (Equipamentos)
router.post('/sistema-real', calculosController.sistemaReal);
router.post('/retorno-financeiro', calculosController.retornoFinanceiro);
router.post('/homologacao', calculosController.homologacao);

// Seção 3 (Dinâmica do Kit)
router.post('/licenciamento-kit', calculosController.licenciamentoKit);

// Seção 4 (Cascata do Projeto)
router.post('/preco-final', calculosController.precoFinal);

// Persistência e Validação Final - Restrito apenas a administradores
router.post('/salvar-refinamento', authorizeRoles(['admin']), calculosController.salvarRefinamento);

// Métricas do Dashboard
router.get('/dashboard/stats', calculosController.dashboardStats);

// Listagem de Usuários e Orçamentos via API segura
router.get('/users', authorizeRoles(['admin']), calculosController.listarUsuarios);
router.post('/users', authorizeRoles(['admin']), calculosController.criarUsuario);
router.get('/budgets', calculosController.listarOrcamentos);
router.get('/budgets/:id', calculosController.obterOrcamento);
router.patch('/budgets/:id', calculosController.atualizarOrcamento);

// Listagem de Cidades com HSP
router.get('/cidades', calculosController.listarCidades);
router.get('/cidades/:id', calculosController.obterCidade);

export default router;
