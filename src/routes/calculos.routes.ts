import { Router } from 'express';
import calculosController from '../controllers/calculos.controller';

const router = Router();

// Seção 1 (Captação)
router.post('/dimensionamento-minimo', calculosController.dimensionamentoMinimo);
router.post('/criar-solicitacao', calculosController.criarSolicitacao);

// Seção 2 (Equipamentos)
router.post('/sistema-real', calculosController.sistemaReal);
router.post('/retorno-financeiro', calculosController.retornoFinanceiro);

// Seção 3 (Dinâmica do Kit)
router.post('/licenciamento-kit', calculosController.licenciamentoKit);

// Seção 4 (Cascata do Projeto)
router.post('/preco-final', calculosController.precoFinal);

// Persistência e Validação Final
router.post('/salvar-refinamento', calculosController.salvarRefinamento);

// Métricas do Dashboard
router.get('/dashboard/stats', calculosController.dashboardStats);

export default router;
