import { spawn, ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import PocketBase from 'pocketbase';
import dotenv from 'dotenv';

dotenv.config();

export const API_PORT = 3998;
export const API_URL = `http://localhost:${API_PORT}/api/calculos`;

type Perfil = 'admin' | 'associado' | 'vendedor';
export type UsuarioTeste = { id: string; email: string; token: string };

/**
 * Garante que os testes E2E nunca rodem contra o PocketBase de produção.
 */
export function garantirPocketBaseDev(): PocketBase {
  const url = process.env.POCKETBASE_URL || '';
  if (!new URL(url).hostname.startsWith('dev.')) {
    throw new Error(`Testes E2E só podem rodar contra o PocketBase de dev (atual: ${url})`);
  }
  return new PocketBase(url);
}

export class AmbienteE2E {
  private superPb = garantirPocketBaseDev();
  private server?: ChildProcess;
  private sufixo = `${Date.now()}${randomBytes(2).toString('hex')}`;
  readonly senha = `E2e!${randomBytes(6).toString('hex')}`;
  usuarios = {} as Record<Perfil, UsuarioTeste>;
  cidadeId = '';

  async iniciar() {
    this.superPb.autoCancellation(false);
    await this.superPb.collection('_superusers').authWithPassword(
      process.env.POCKETBASE_ADMIN_EMAIL || '',
      process.env.POCKETBASE_ADMIN_PASSWORD || ''
    );

    const cidade = await this.superPb.collection('cidades_hsp').getFirstListItem('');
    this.cidadeId = cidade.id;

    for (const perfil of ['admin', 'associado', 'vendedor'] as Perfil[]) {
      const email = `e2e.${perfil}.${this.sufixo}@teste.local`;
      const user = await this.superPb.collection('users').create({
        email,
        password: this.senha,
        passwordConfirm: this.senha,
        name: `E2E ${perfil}`,
        tipo_acesso: perfil,
        primeiro_acesso: false,
        verified: true,
      });
      const userPb = new PocketBase(process.env.POCKETBASE_URL);
      const auth = await userPb.collection('users').authWithPassword(email, this.senha);
      this.usuarios[perfil] = { id: user.id, email, token: auth.token };
    }

    await this.subirBackend();
  }

  private async subirBackend() {
    this.server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/server.ts'], {
      // RESEND_API_KEY vazia: o EmailService não envia nada durante os testes
      env: { ...process.env, PORT: String(API_PORT), RESEND_API_KEY: '' },
      stdio: 'ignore',
    });

    const limite = Date.now() + 30_000;
    while (Date.now() < limite) {
      try {
        const res = await fetch(`${API_URL}/budgets`);
        if (res.status === 401) return; // servidor no ar (rota exige token)
      } catch {
        // ainda subindo
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('Backend de teste não subiu em 30s');
  }

  async api(perfil: Perfil, metodo: string, rota: string, body?: unknown) {
    const res = await fetch(`${API_URL}${rota}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${this.usuarios[perfil].token}`,
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      // resposta não-JSON
    }
    return { status: res.status, data };
  }

  /** Cliente do PocketBase autenticado como o usuário, sem passar pelo backend (como pelo DevTools). */
  pocketbaseDoUsuario(perfil: Perfil): PocketBase {
    const userPb = new PocketBase(process.env.POCKETBASE_URL);
    userPb.autoCancellation(false);
    userPb.authStore.save(this.usuarios[perfil].token);
    return userPb;
  }

  /** Lê o registro direto do banco, sem a sanitização da API. */
  async lerDoBanco(orcamentoId: string) {
    return this.superPb.collection('orcamentos').getOne(orcamentoId);
  }

  async encerrar() {
    this.server?.kill();

    const ids = Object.values(this.usuarios).map((u) => u.id);
    if (!ids.length) return;

    const filtro = ids.map((id) => `user_id = "${id}"`).join(' || ');
    const orcamentos = await this.superPb.collection('orcamentos').getFullList({ filter: filtro });
    for (const o of orcamentos) await this.superPb.collection('orcamentos').delete(o.id);
    for (const id of ids) await this.superPb.collection('users').delete(id);
  }
}
