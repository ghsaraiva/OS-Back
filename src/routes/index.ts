import { Router } from 'express';
import calculosRoutes from './calculos.routes';
import authRoutes from './auth.routes';

const router = Router();

// Rotas públicas de autenticação
router.use('/auth', authRoutes);

// Rotas protegidas do sistema
router.use('/calculos', calculosRoutes);

export default router;
