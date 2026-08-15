import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

// Rotas públicas de recuperação de senha (sem exigência de JWT)
router.post('/solicitar-codigo', AuthController.solicitarCodigo);
router.post('/validar-codigo', AuthController.validarCodigo);
router.post('/redefinir-senha', AuthController.redefinirSenha);

export default router;
