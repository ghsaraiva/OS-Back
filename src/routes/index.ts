import { Router } from 'express';
import calculosRoutes from './calculos.routes';

const router = Router();

// Agrupador de rotas
router.use('/calculos', calculosRoutes);

// Futuras rotas podem ser adicionadas aqui
// router.use('/auth', authRoutes);

export default router;
