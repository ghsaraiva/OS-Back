import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  pdfBuffer?: Buffer; // Buffer do PDF já baixado pelo controller (evita 404 da URL pública)
}

export class EmailService {
  private static getSystemFromEmail(): string {
    return (
      process.env.RESEND_SYSTEM_FROM_EMAIL ||
      process.env.RESEND_FROM_EMAIL ||
      "Sofia Engenharia <nao-responda@sofiaengenharia.g-sys.app.br>"
    );
  }

  /**
   * Lê a logo lightmode do disco e retorna como anexo inline CID para o Resend.
   */
  private static getLogoAttachment(): {
    filename: string;
    content: string;
    content_id: string;
  } | null {
    const filename = "logo_horizontal_darkmode.png";

    const candidatePaths = [
      path.join(__dirname, "..", "assets", filename),
      path.join(__dirname, "assets", filename),
      path.join(__dirname, filename),
      path.join(process.cwd(), "src", "assets", filename),
      path.join(process.cwd(), "dist", filename),
      path.join(process.cwd(), "admin-page", "public", "images", filename),
      path.join(
        process.cwd(),
        "..",
        "admin-page",
        "public",
        "images",
        filename,
      ),
    ];

    for (const filePath of candidatePaths) {
      try {
        if (fs.existsSync(filePath)) {
          return {
            filename,
            content: fs.readFileSync(filePath).toString("base64"),
            content_id: "logo_sofia",
          };
        }
      } catch {
        /* tenta próximo */
      }
    }

    console.warn(`⚠️  Logo não encontrada para CID: ${filename}`);
    return null;
  }

  /**
   * Retorna o bloco HTML do header da logo referenciada via CID (cid:logo_sofia).
   * Usa linear-gradient + pill box para impedir que clientes de e-mail (Gmail iOS / Outlook)
   * invertam a cor do fundo da logo em Dark Mode.
   */
  private static getLogoHeader(widthPx: number): string {
    return `
      <div class="logo-header" style="background-color:#2e2e2e;background-image:linear-gradient(#2e2e2e,#2e2e2e);border-top:4px solid #fcde09;border-bottom:1px solid #cbd5e1;border-radius:12px 12px 0 0;padding:18px 24px;text-align:center;">
        <div style="background-color:#09090b;background-image:linear-gradient(#09090b,#09090b);border-radius:8px;padding:8px 18px;display:inline-block;">
          <img src="cid:logo_sofia" alt="Sofia Engenharia" width="${widthPx}"
            style="max-width:${widthPx}px;height:auto;border:0;display:block;margin:0 auto;" />
        </div>
      </div>
    `;
  }

  private static getDarkModeStyles(): string {
    return `
      @media (prefers-color-scheme: dark) {
        body { background-color: #0f172a !important; }
        .card { background-color: #1e293b !important; border-color: #334155 !important; }
        .logo-header { background-color: #e2e8f0 !important; background-image: linear-gradient(#e2e8f0, #e2e8f0) !important; border-top-color: #fcde09 !important; border-bottom-color: #cbd5e1 !important; }
        .title { color: #f1f5f9 !important; }
        .text { color: #94a3b8 !important; }
        .greeting { color: #f1f5f9 !important; }
        .code-box { background-color: #0f172a !important; border-color: #475569 !important; color: #f1f5f9 !important; }
        .credentials-box { background-color: #0f172a !important; border-color: #334155 !important; }
        .value { background-color: #1e293b !important; border-color: #334155 !important; color: #f1f5f9 !important; }
        .no-reply-banner { background-color: #0f172a !important; border-left-color: #475569 !important; color: #94a3b8 !important; }
        .footer { color: #64748b !important; border-top-color: #334155 !important; }
        .signature { color: #94a3b8 !important; border-top-color: #334155 !important; }
        .warning { color: #64748b !important; }
        /* Botão em dark mode com amarelo vivo (#eab308) e texto preto */
        .btn { background-color: #eab308 !important; color: #000000 !important; font-weight: 700 !important; }
        .btn:hover { background-color: #ca8a04 !important; }
      }
      [data-ogsc] .logo-header { background-color: #e2e8f0 !important; background-image: linear-gradient(#e2e8f0, #e2e8f0) !important; }
    `;
  }

  static async enviarCodigoRecuperacao(
    toEmail: string,
    code: string,
  ): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;

    const fromEmail = this.getSystemFromEmail();
    const currentYear = new Date().getFullYear();
    const logoHeader = this.getLogoHeader(200);
    const logoAttachment = this.getLogoAttachment();

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
          .wrapper { max-width: 480px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-radius: 12px; overflow: hidden; }
          .card { background-color: #ffffff; padding: 28px 32px 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; }
          .title { font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 12px; color: #0f172a; }
          .text { font-size: 14px; color: #64748b; line-height: 1.6; text-align: center; margin-bottom: 24px; }
          .code-box { background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; margin-bottom: 24px; font-family: monospace; }
          .no-reply-banner { background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #475569; text-align: center; margin-top: 20px; font-weight: 500; }
          .warning { font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; padding-top: 16px; margin-top: 16px; }
          .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 20px; }
          ${this.getDarkModeStyles()}
        </style>
      </head>
      <body>
        <div class="wrapper">
          ${logoHeader}
          <div class="card">
            <div class="title">Recuperação de Senha</div>
            <div class="text">Você solicitou a redefinição de senha para sua conta. Use o código de verificação abaixo para continuar:</div>
            <div class="code-box">${code}</div>
            <div class="text" style="margin-bottom: 0;">
              Este código é válido por <strong>10 minutos</strong>. Se você não solicitou a alteração de senha, ignore este e-mail.
            </div>
            <div class="no-reply-banner">⚠️ Este é um e-mail automático do sistema. Por favor, <strong>não responda</strong> a esta mensagem.</div>
            <div class="warning">Por motivos de segurança, nunca compartilhe este código com ninguém.</div>
            <div class="footer">&copy; ${currentYear} Sofia Engenharia Elétrica. Todos os direitos reservados.</div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const attachments: any[] = [];
      if (logoAttachment) attachments.push(logoAttachment);

      await axios.post(
        "https://api.resend.com/emails",
        {
          from: fromEmail,
          to: [toEmail],
          subject: `${code} é o seu código de recuperação - Sofia Engenharia`,
          html: htmlContent,
          attachments,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );
      return true;
    } catch (error: any) {
      console.error(
        "Erro ao enviar e-mail de recuperação:",
        error.response?.data || error.message,
      );
      return false;
    }
  }

  static async enviarBoasVindasNovoUsuario(
    data: NovoUsuarioEmailData,
  ): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;

    const fromEmail = this.getSystemFromEmail();
    const currentYear = new Date().getFullYear();
    const logoHeader = this.getLogoHeader(200);
    const logoAttachment = this.getLogoAttachment();
    const frontendUrl = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/$/, "");
    const loginUrl = `${frontendUrl}/login`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
          .wrapper { max-width: 520px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-radius: 12px; overflow: hidden; }
          .card { background-color: #ffffff; padding: 28px 32px 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; }
          .title { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 16px; color: #0f172a; }
          .text { font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 20px; }
          .credentials-box { background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
          .field { font-size: 13px; color: #64748b; margin-bottom: 4px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
          .value { font-size: 15px; color: #0f172a; font-weight: 600; margin-bottom: 16px; font-family: monospace; background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-block; width: 100%; box-sizing: border-box; }
          .btn-container { text-align: center; margin-top: 24px; margin-bottom: 24px; }
          .btn { background-color: #fcde09; color: #000000 !important; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; display: inline-block; font-size: 14px; }
          .notice { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 4px; font-size: 13px; color: #92400e; line-height: 1.5; margin-bottom: 20px; }
          .no-reply-banner { background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #475569; text-align: center; margin-bottom: 20px; font-weight: 500; }
          .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; }
          ${this.getDarkModeStyles()}
        </style>
      </head>
      <body>
        <div class="wrapper">
          ${logoHeader}
          <div class="card">
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
            <div class="notice">🔒 <strong>Primeiro Acesso Obrigatório:</strong> Por motivos de segurança, ao realizar seu primeiro acesso com a senha temporária acima, o sistema exigirá obrigatoriamente a definição de uma nova senha permanente.</div>
            <div class="btn-container"><a href="${loginUrl}" target="_blank" class="btn">Acessar o Sistema</a></div>
            <div class="no-reply-banner">⚠️ Este é um e-mail automático do sistema. Por favor, <strong>não responda</strong> a esta mensagem.</div>
            <div class="footer">&copy; ${currentYear} Sofia Engenharia Elétrica. Todos os direitos reservados.</div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const attachments: any[] = [];
      if (logoAttachment) attachments.push(logoAttachment);

      await axios.post(
        "https://api.resend.com/emails",
        {
          from: fromEmail,
          to: [data.toEmail],
          subject: `Sua conta na Sofia Engenharia foi criada - Dados de Acesso`,
          html: htmlContent,
          attachments,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );
      return true;
    } catch (error: any) {
      console.error(
        "Erro ao enviar e-mail de boas-vindas:",
        error.response?.data || error.message,
      );
      return false;
    }
  }

  static async enviarOrcamentoCliente(
    data: OrcamentoClienteEmailData,
  ): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;

    const fromEmail = this.getSystemFromEmail();
    const currentYear = new Date().getFullYear();
    const logoHeader = this.getLogoHeader(200);
    const logoAttachment = this.getLogoAttachment();

    const attachments: Array<{
      filename: string;
      content: string;
      content_id?: string;
    }> = [];
    if (logoAttachment) attachments.push(logoAttachment);

    if (data.pdfBuffer && data.pdfBuffer.length > 0) {
      const cleanName = data.clientName
        .trim()
        .replace(/\s+/g, "_")
        .toLowerCase();
      attachments.push({
        filename: `proposta_solar_${cleanName}.pdf`,
        content: data.pdfBuffer.toString("base64"),
      });
    } else if (data.pdfUrl) {
      try {
        const response = await axios.get(data.pdfUrl, {
          responseType: "arraybuffer",
        });
        const cleanName = data.clientName
          .trim()
          .replace(/\s+/g, "_")
          .toLowerCase();
        attachments.push({
          filename: `proposta_solar_${cleanName}.pdf`,
          content: Buffer.from(response.data).toString("base64"),
        });
      } catch (err: any) {
        console.error("Erro ao baixar PDF para anexo do e-mail:", err?.message);
      }
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
          .wrapper { max-width: 580px; margin: 0 auto; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border-radius: 12px; overflow: hidden; }
          .card { background-color: #ffffff; padding: 28px 36px 36px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; }
          .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
          .text { font-size: 14px; color: #334155; line-height: 1.7; margin-bottom: 20px; }
          .btn-container { text-align: center; margin-top: 28px; margin-bottom: 28px; }
          .btn { background-color: #fcde09; color: #000000 !important; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; display: inline-block; font-size: 15px; box-shadow: 0 2px 6px rgba(252,222,9,0.35); }
          .validity { background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #92400e; margin-bottom: 24px; text-align: center; }
          .signature { border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 28px; font-size: 14px; color: #334155; }
          .no-reply-banner { background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #475569; text-align: center; margin-top: 24px; line-height: 1.5; }
          .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 20px; }
          ${this.getDarkModeStyles()}
        </style>
      </head>
      <body>
        <div class="wrapper">
          ${logoHeader}
          <div class="card">
            <div class="greeting">Olá, ${data.clientName}.</div>
            <div class="text">Sua proposta de energia solar está pronta.</div>
            <div class="text">Preparamos uma solução personalizada para o seu projeto, com todos os detalhes do sistema, investimento, economia e prazo de retorno.</div>
            <div class="text">Você pode consultar a proposta online pelo botão abaixo. O arquivo completo da proposta também está anexado a este e-mail para sua consulta.</div>
            ${data.pdfUrl ? `<div class="btn-container"><a href="${data.pdfUrl}" target="_blank" class="btn">Visualizar Proposta</a></div>` : ""}
            <div class="validity"><strong>Validade da proposta:</strong> 15 dias.</div>
            <div class="text">Em caso de dúvidas ou se precisar de qualquer esclarecimento sobre a proposta, nossa equipe está à disposição.</div>
            <div class="signature">Atenciosamente,<br><strong>Sofia Engenharia Elétrica</strong></div>
            <div class="no-reply-banner"><em>Este é um e-mail automático. Por favor, não responda a esta mensagem.</em></div>
            <div class="footer">&copy; ${currentYear} Sofia Engenharia Elétrica. Todos os direitos reservados.</div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const payload: any = {
        from: fromEmail,
        to: [data.toEmail],
        subject: `Proposta de Energia Solar - ${data.clientName} | Sofia Engenharia`,
        html: htmlContent,
      };
      if (attachments.length > 0) payload.attachments = attachments;

      await axios.post("https://api.resend.com/emails", payload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      return true;
    } catch (error: any) {
      console.error(
        "Erro ao enviar e-mail via Resend:",
        error.response?.data || error.message,
      );
      return false;
    }
  }
}
