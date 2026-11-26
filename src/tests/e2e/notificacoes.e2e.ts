import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AmbienteE2E } from './setup';

/**
 * Notificações do admin quando vendedor/associado cria um orçamento.
 * Rodar com: npm run test:e2e
 */

const env = new AmbienteE2E();

async function criarOrcamento(perfil: 'admin' | 'associado' | 'vendedor', nome: string) {
  const res = await env.api(perfil, 'POST', '/criar-solicitacao', {
    nome_cliente: nome,
    id_cidade: env.cidadeId,
    consumo_mes: 500,
    valor_tarifa: 1,
  });
  expect(res.status).toBe(201);
  return res.data.id as string;
}

/** A notificação é criada depois da resposta, então espera ela aparecer. */
async function notificacaoDoOrcamento(orcamentoId: string) {
  for (let i = 0; i < 20; i++) {
    const res = await env.api('admin', 'GET', '/notificacoes');
    const item = res.data.itens.find((n: any) => n.orcamento_id === orcamentoId);
    if (item) return { item, naoLidas: res.data.naoLidas as number };
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

describe('Notificações (E2E API)', () => {
  beforeAll(async () => {
    await env.iniciar();
  }, 60_000);

  afterAll(async () => {
    await env.encerrar();
  }, 60_000);

  it('associado cria orçamento e o admin recebe a notificação não lida', async () => {
    const id = await criarOrcamento('associado', 'TESTE E2E Notificacao Associado');
    const achada = await notificacaoDoOrcamento(id);
    expect(achada).not.toBeNull();
    expect(achada!.item.lida).toBe(false);
    expect(achada!.item.titulo).toContain('E2E associado');
    expect(achada!.item.mensagem).toContain('TESTE E2E Notificacao Associado');
    expect(achada!.naoLidas).toBeGreaterThan(0);
  });

  it('vendedor também gera notificação; orçamento do próprio admin não gera', async () => {
    const doVendedor = await criarOrcamento('vendedor', 'TESTE E2E Notificacao Vendedor');
    expect(await notificacaoDoOrcamento(doVendedor)).not.toBeNull();

    const doAdmin = await criarOrcamento('admin', 'TESTE E2E Notificacao Admin');
    await new Promise((r) => setTimeout(r, 1500));
    const res = await env.api('admin', 'GET', '/notificacoes');
    expect(res.data.itens.some((n: any) => n.orcamento_id === doAdmin)).toBe(false);
  });

  it('marcar uma como lida e depois todas', async () => {
    const id = await criarOrcamento('associado', 'TESTE E2E Notificacao Lida');
    const { item } = (await notificacaoDoOrcamento(id))!;

    const uma = await env.api('admin', 'PATCH', `/notificacoes/${item.id}/lida`);
    expect(uma.status).toBe(200);
    expect((await notificacaoDoOrcamento(id))!.item.lida).toBe(true);

    const todas = await env.api('admin', 'PATCH', '/notificacoes/lidas');
    expect(todas.status).toBe(200);
    expect((await env.api('admin', 'GET', '/notificacoes')).data.naoLidas).toBe(0);
  });

  it('associado e vendedor não acessam as notificações; ninguém lê a coleção direto', async () => {
    for (const perfil of ['associado', 'vendedor'] as const) {
      expect((await env.api(perfil, 'GET', '/notificacoes')).status).toBe(403);
      expect((await env.api(perfil, 'PATCH', '/notificacoes/lidas')).status).toBe(403);
    }
    for (const perfil of ['admin', 'associado'] as const) {
      const direto = await env.pocketbaseDoUsuario(perfil).collection('notificacoes').getList(1, 1).catch((e) => e);
      expect(direto.totalItems ?? 0).toBe(0);
    }
  });

  it('id de notificação inexistente responde 404', async () => {
    expect((await env.api('admin', 'PATCH', '/notificacoes/naoexiste12345/lida')).status).toBe(404);
  });
});
