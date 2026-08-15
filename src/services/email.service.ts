import axios from 'axios';

export interface NovoUsuarioEmailData {
  toEmail: string;
  userName: string;
  tempPassword: string;
  tipoAcesso: string;
}

export interface OrcamentoClienteEmailData {
  toEmail: string;
  clientName: string;
  budgetTitle: string;
  pdfUrl?: string;
}

export class EmailService {
  /**
   * Retorna o remetente para e-mails de sistema/notificações (nao-responda@)
   */
  private static getSystemFromEmail(): string {
    return (
      process.env.RESEND_SYSTEM_FROM_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      'Sofia Engenharia <nao-responda@sofiaengenharia.g-sys.app.br>'
    );
  }

  /**
   * Retorna o remetente para envio de orçamentos para clientes (orcamentos@)
   */
  private static getBudgetFromEmail(): string {
    return (
      process.env.RESEND_BUDGET_FROM_EMAIL ||
      'Sofia Engenharia <orcamentos@sofiaengenharia.g-sys.app.br>'
    );
  }

  /**
   * Envia e-mail de recuperação de senha com código de 6 dígitos usando a API do Resend.
   */
  static async enviarCodigoRecuperacao(toEmail: string, code: string): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;

    const fromEmail = this.getSystemFromEmail();

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #1e293b; }
          .card { max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .logo { text-align: center; font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px; }
          .logo span { color: #f59e0b; }
          .title { font-size: 18px; font-weight: 600; text-align: center; margin-bottom: 12px; color: #0f172a; }
          .text { font-size: 14px; color: #64748b; line-height: 1.6; text-align: center; margin-bottom: 24px; }
          .code-box { background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; margin-bottom: 24px; font-family: monospace; }
          .no-reply-banner { background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #475569; text-align: center; margin-top: 20px; font-weight: 500; }
          .warning { font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">SOFIA <span>ENGENHARIA</span></div>
          <div class="title">Recuperação de Senha</div>
          <div class="text">
            Você solicitou a redefinição de senha para sua conta. Use o código de verificação abaixo para continuar:
          </div>
          <div class="code-box">${code}</div>
          <div class="text" style="margin-bottom: 0;">
            Este código é válido por <strong>10 minutos</strong>. Se você não solicitou a alteração de senha, ignore este e-mail.
          </div>
          <div class="no-reply-banner">
            ⚠️ Este é um e-mail automático do sistema. Por favor, <strong>não responda</strong> a esta mensagem.
          </div>
          <div class="warning">
            Por motivos de segurança, nunca compartilhe este código com ninguém.
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: fromEmail,
          to: [toEmail],
          subject: `${code} é o seu código de recuperação - Sofia Engenharia`,
          html: htmlContent,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return true;
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Envia e-mail de boas-vindas para novos usuários com dados de acesso e senha temporária.
   */
  static async enviarBoasVindasNovoUsuario(data: NovoUsuarioEmailData): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;

    const fromEmail = this.getSystemFromEmail();
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const loginUrl = `${frontendUrl}/login`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #1e293b; }
          .card { max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .logo { text-align: center; font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px; }
          .logo span { color: #f59e0b; }
          .title { font-size: 20px; font-weight: 600; text-align: center; margin-bottom: 16px; color: #0f172a; }
          .text { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 20px; }
          .credentials-box { background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
          .field { font-size: 13px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
          .value { font-size: 15px; color: #0f172a; font-weight: 600; margin-bottom: 16px; font-family: monospace; background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block; width: 100%; box-sizing: border-box; }
          .btn-container { text-align: center; margin-top: 24px; margin-bottom: 24px; }
          .btn { background-color: #f59e0b; color: #ffffff !important; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; font-size: 14px; }
          .notice { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 4px; font-size: 13px; color: #92400e; line-height: 1.5; margin-bottom: 20px; }
          .no-reply-banner { background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #475569; text-align: center; margin-bottom: 20px; font-weight: 500; }
          .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">SOFIA <span>ENGENHARIA</span></div>
          <div class="title">Bem-vindo ao Sistema!</div>
          <div class="text">
            Olá <strong>${data.userName}</strong>,<br><br>
            Sua conta de acesso ao sistema de orçamentos da Sofia Engenharia foi criada com sucesso como perfil <strong>${data.tipoAcesso}</strong>.
          </div>

          <div class="credentials-box">
            <div class="field">E-mail de Acesso</div>
            <div class="value">${data.toEmail}</div>

            <div class="field" style="margin-top: 12px;">Senha de Primeiro Acesso</div>
            <div class="value" style="color: #ea580c; font-size: 16px;">${data.tempPassword}</div>
          </div>

          <div class="notice">
            🔒 <strong>Primeiro Acesso Obrigatório:</strong> Por motivos de segurança, ao realizar seu primeiro acesso com a senha temporária acima, o sistema exigirá obrigatoriamente a definição de uma nova senha permanente.
          </div>

          <div class="btn-container">
            <a href="${loginUrl}" target="_blank" class="btn">Acessar o Sistema</a>
          </div>

          <div class="no-reply-banner">
            ⚠️ Este é um e-mail automático do sistema. Por favor, <strong>não responda</strong> a esta mensagem.
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Sofia Engenharia Elétrica. Todos os direitos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: fromEmail,
          to: [data.toEmail],
          subject: `Sua conta na Sofia Engenharia foi criada - Dados de Acesso`,
          html: htmlContent,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return true;
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Método preparado para envio de propostas de orçamentos aos clientes finais (usando orcamentos@).
   */
  static async enviarOrcamentoCliente(data: OrcamentoClienteEmailData): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;

    const fromEmail = this.getBudgetFromEmail();

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #1e293b; }
          .card { max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .logo { text-align: center; font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 1px; }
          .logo span { color: #f59e0b; }
          .title { font-size: 20px; font-weight: 600; text-align: center; margin-bottom: 16px; color: #0f172a; }
          .text { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 20px; }
          .btn-container { text-align: center; margin-top: 24px; margin-bottom: 24px; }
          .btn { background-color: #f59e0b; color: #0f172a !important; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; font-size: 14px; }
          .no-reply-banner { background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #475569; text-align: center; margin-bottom: 20px; font-weight: 500; }
          .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">SOFIA <span>ENGENHARIA</span></div>
          <div class="title">Proposta de Energia Solar</div>
          <div class="text">
            Olá <strong>${data.clientName}</strong>,<br><br>
            Agradecemos a oportunidade! Preparamos a sua proposta técnica e comercial de energia solar fotovoltaica com todo o estudo de economia e retorno do investimento.
          </div>

          ${
            data.pdfUrl
              ? `
            <div class="btn-container">
              <a href="${data.pdfUrl}" target="_blank" class="btn">Visualizar Proposta (PDF)</a>
            </div>
          `
              : ''
          }

          <div class="no-reply-banner">
            ⚠️ Este é um e-mail automático do sistema. Por favor, <strong>não responda</strong> a esta mensagem. Para dúvidas ou atendimento, entre em contato pelo nosso telefone/WhatsApp corporativo.
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Sofia Engenharia Elétrica. Todos os direitos reservados.
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: fromEmail,
          to: [data.toEmail],
          subject: `Proposta de Energia Solar - ${data.clientName} | Sofia Engenharia`,
          html: htmlContent,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return true;
    } catch (error: any) {
      return false;
    }
  }
}
