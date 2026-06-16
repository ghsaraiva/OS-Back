import { Request, Response, NextFunction } from 'express';
import PocketBase, { RecordModel } from 'pocketbase';

// Estendendo o objeto Request do Express para incluir nossa instância de PB por requisição
declare global {
  namespace Express {
    interface Request {
      pb?: PocketBase;
      user?: RecordModel;
    }
  }
}

/**
 * Middleware para validar o token de autenticação JWT enviado pelo frontend
 * e instanciar um cliente PocketBase isolado para a requisição.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado: Token ausente.' });
  }

  try {
    // Cria uma nova instância isolada do PocketBase para esta requisição específica (evita race conditions)
    const requestPB = new PocketBase(process.env.POCKETBASE_URL);
    requestPB.autoCancellation(false);

    // Carrega o token JWT na store da instância da requisição
    requestPB.authStore.save(token, null);

    // Valida se o token é ativo e atualiza a sessão
    await requestPB.collection('users').authRefresh();

    // Se o token for válido, injeta a instância do PocketBase e o usuário no Express
    req.pb = requestPB;
    req.user = requestPB.authStore.model || undefined;

    next();
  } catch (error: any) {
    return res.status(401).json({ error: 'Sessão expirada ou token inválido.' });
  }
}

/**
 * Middleware para autorização baseada no tipo de acesso (Roles)
 */
export function authorizeRoles(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const tipoAcesso = req.user.tipo_acesso;

    if (!allowedRoles.includes(tipoAcesso)) {
      return res.status(403).json({ error: 'Acesso Proibido: Permissão insuficiente para esta ação.' });
    }

    next();
  };
}
