import { Request, Response } from 'express';
import pb, { authenticatePB } from '../config/pocketbase';
import { EmailService } from '../services/email.service';

interface RecoveryCodeData {
  code: string;
  expiresAt: number;
}

// Armazenamento em memória para os códigos de recuperação (10 min de expiração)
const recoveryCodesStore = new Map<string, RecoveryCodeData>();

export class AuthController {
  /**
   * Passo 1: Solicitar código de recuperação por e-mail.
   * Não revela se o e-mail existe ou não por questões de segurança.
   */
  static async solicitarCodigo(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Informe um e-mail válido.' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      await authenticatePB();

      // Verifica se o usuário existe no PocketBase
      const user = await pb
        .collection('users')
        .getFirstListItem(`email = "${normalizedEmail}"`)
        .catch(() => null);

      if (user) {
        // Gerar código aleatório de 6 dígitos
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos

        recoveryCodesStore.set(normalizedEmail, { code, expiresAt });

        // Dispara o e-mail via Resend com o código formatado
        await EmailService.enviarCodigoRecuperacao(normalizedEmail, code);
      }

      // Mensagem genérica por privacidade (conforme especificado)
      return res.json({
        success: true,
        message:
          'Se o e-mail informado estiver cadastrado em nosso sistema, você receberá um código de confirmação em sua caixa de entrada.',
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Erro interno do servidor.' });
    }
  }

  /**
   * Passo 2: Validar o código de 6 dígitos informado pelo usuário.
   */
  static async validarCodigo(req: Request, res: Response) {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        return res.status(400).json({ error: 'E-mail e código são obrigatórios.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const storedData = recoveryCodesStore.get(normalizedEmail);

      if (!storedData) {
        return res
          .status(400)
          .json({ error: 'Nenhum código solicitado para este e-mail ou código expirado.' });
      }

      if (Date.now() > storedData.expiresAt) {
        recoveryCodesStore.delete(normalizedEmail);
        return res
          .status(400)
          .json({ error: 'O código de confirmação expirou (válido por 10 minutos). Solicite um novo código.' });
      }

      if (storedData.code !== code.trim()) {
        return res.status(400).json({ error: 'Código de confirmação incorreto. Verifique e tente novamente.' });
      }

      return res.json({ success: true, message: 'Código verificado com sucesso.' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Erro ao validar código.' });
    }
  }

  /**
   * Passo 3: Alterar a senha após validação do código.
   */
  static async redefinirSenha(req: Request, res: Response) {
    try {
      const { email, code, password, passwordConfirm } = req.body;

      if (!email || !code || !password || !passwordConfirm) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
      }

      if (password !== passwordConfirm) {
        return res.status(400).json({ error: 'As senhas não coincidem.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const storedData = recoveryCodesStore.get(normalizedEmail);

      if (!storedData || Date.now() > storedData.expiresAt || storedData.code !== code.trim()) {
        return res.status(400).json({
          error: 'Código inválido ou expirado. Não é possível alterar a senha sem um código válido.',
        });
      }

      await authenticatePB();

      const user = await pb
        .collection('users')
        .getFirstListItem(`email = "${normalizedEmail}"`)
        .catch(() => null);

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      // Atualiza a senha no PocketBase via admin e remove a flag de primeiro acesso se houver
      await pb.collection('users').update(user.id, {
        password,
        passwordConfirm,
        primeiro_acesso: false,
      });

      // Queima o código de recuperação para não ser reusado
      recoveryCodesStore.delete(normalizedEmail);

      return res.json({
        success: true,
        message: 'Senha redefinida com sucesso! Faça login com a sua nova senha.',
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Erro ao redefinir senha.' });
    }
  }
}
