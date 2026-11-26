import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AmbienteE2E } from './setup';
import { CalculosProcess } from '../../services/calculos.process';

/**
 * Fluxo completo do perfil Associado contra o backend real e o PocketBase de dev.
 * Rodar com: npm run test:e2e
 */

// Custo e margem do kit da Sofia são restritos ao admin (a margem de segurança é do associado e ele a vê)
const CAMPOS_SIGILOSOS = ['valor_kit', 'porcentagem_kit', 'lucro_equipamento'];

const custosIniciais = {
  mao_obra: 80,
  equipamento_local: 50,
  km: 200,
  custo_km: 2,
  porcentagem_imposto: 6,
  porcentagem_seguro: 1,
  porcentagem_margem_seguranca: 4,
  lucro_liquido_perc: 15,
};

const env = new AmbienteE2E();
let orcamentoAssociado = '';
let orcamentoVendedor = '';

function refinamentoAdmin(orcamentoId: string) {
  return {
    orcamentoId,
    potencia_painel: 550,
    quantidade_paineis: 10,
    peso_painel: 25,
    marca_modulo: 'E2E Solar',
    quantidade_inversores: 1,
    potencia_inversor: 5,
    modelo_inversor: 'E2E-5K',
    marca_inversor: 'E2E',
    tensao_inversor: 220,
    valorKit: 12000,
    valorPorcentagem: 12,
    // O admin mantém os custos que o associado preencheu
    valorMaoDeObra: custosIniciais.mao_obra,
    valorEquipamentoLocal: custosIniciais.equipamento_local,
    valorHomologacao: 500,
    porcentagemLucroLiquido: custosIniciais.lucro_liquido_perc,
    km: custosIniciais.km,
    custo_km: custosIniciais.custo_km,
    porcentagem_imposto: custosIniciais.porcentagem_imposto,
    porcentagem_seguro: custosIniciais.porcentagem_seguro,
    porcentagem_margem_seguranca: custosIniciais.porcentagem_margem_seguranca,
  };
}

describe('Perfil Associado (E2E API)', () => {
  beforeAll(async () => {
    await env.iniciar();
  }, 60_000);

  afterAll(async () => {
    await env.encerrar();
  }, 60_000);

  describe('B. Cadastro do orçamento', () => {
    it('B2: associado cria orçamento com os próprios custos e tudo é persistido', async () => {
      const res = await env.api('associado', 'POST', '/criar-solicitacao', {
        nome_cliente: 'TESTE E2E Associado',
        id_cidade: env.cidadeId,
        cidade: 'Cidade Teste',
        estado: 'MG',
        consumo_mes: 600,
        valor_tarifa: 1,
        estrutura: 'Telhado Cerâmico',
        padrao: 'Bifásico',
        ...custosIniciais,
      });

      expect(res.status).toBe(201);
      orcamentoAssociado = res.data.id;

      const salvo = await env.lerDoBanco(orcamentoAssociado);
      expect(salvo.user_id).toBe(env.usuarios.associado.id);
      expect(salvo.mao_obra).toBe(80);
      expect(salvo.equipamento_local).toBe(50);
      expect(salvo.km).toBe(200);
      expect(salvo.custo_km).toBe(2);
      expect(salvo.valor_total_km).toBe(400);
      expect(salvo.porcentagem_imposto).toBe(6);
      expect(salvo.porcentagem_seguro).toBe(1);
      expect(salvo.porcentagem_margem_seguranca).toBe(4);
      expect(salvo.lucro_liquido_perc).toBe(15);
      expect(salvo.preco_final_venda || 0).toBe(0);
    });

    it('B3: mão de obra 0 é salva como 0 (não vira o padrão 100)', async () => {
      const res = await env.api('associado', 'POST', '/criar-solicitacao', {
        nome_cliente: 'TESTE E2E Mao de Obra Zero',
        id_cidade: env.cidadeId,
        consumo_mes: 300,
        valor_tarifa: 1,
        ...custosIniciais,
        mao_obra: 0,
      });
      expect(res.status).toBe(201);
      expect((await env.lerDoBanco(res.data.id)).mao_obra).toBe(0);
    });

    it('vendedor cria orçamento sem custos e recebe os padrões', async () => {
      const res = await env.api('vendedor', 'POST', '/criar-solicitacao', {
        nome_cliente: 'TESTE E2E Vendedor',
        id_cidade: env.cidadeId,
        consumo_mes: 400,
        valor_tarifa: 1,
      });
      expect(res.status).toBe(201);
      orcamentoVendedor = res.data.id;
      const salvo = await env.lerDoBanco(orcamentoVendedor);
      expect(salvo.mao_obra).toBe(100);
      expect(salvo.equipamento_local).toBe(60);
      expect(salvo.porcentagem_margem_seguranca).toBe(3);
    });

    it('vendedor não define a margem de segurança; margem fora de 0–100% é rejeitada', async () => {
      const vendedor = await env.api('vendedor', 'POST', '/criar-solicitacao', {
        nome_cliente: 'TESTE E2E Vendedor Margem',
        id_cidade: env.cidadeId,
        consumo_mes: 400,
        valor_tarifa: 1,
        porcentagem_margem_seguranca: 50,
      });
      expect(vendedor.status).toBe(201);
      expect((await env.lerDoBanco(vendedor.data.id)).porcentagem_margem_seguranca).toBe(3);

      const invalida = await env.api('associado', 'POST', '/criar-solicitacao', {
        nome_cliente: 'TESTE E2E Margem Invalida',
        id_cidade: env.cidadeId,
        consumo_mes: 400,
        valor_tarifa: 1,
        ...custosIniciais,
        porcentagem_margem_seguranca: 100,
      });
      expect(invalida.status).toBe(400);
    });
  });

  describe('Antes da precificação', () => {
    it('PDF é bloqueado enquanto o kit não foi precificado', async () => {
      const res = await env.api('associado', 'POST', `/gerar-pdf/${orcamentoAssociado}`);
      expect(res.status).toBe(400);
    });

    it('associado edita custos sem kit: salva os custos e não gera preço', async () => {
      const res = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/custos`, {
        ...custosIniciais,
        km: 250,
      });
      expect(res.status).toBe(200);

      const salvo = await env.lerDoBanco(orcamentoAssociado);
      expect(salvo.km).toBe(250);
      expect(salvo.valor_total_km).toBe(500);
      expect(salvo.preco_final_venda || 0).toBe(0);

      // volta ao valor inicial para os próximos passos
      await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/custos`, custosIniciais);
    });
  });

  describe('C. Precificação pelo admin', () => {
    it('C2: admin precifica o kit e o preço é calculado mantendo os custos do associado', async () => {
      const res = await env.api('admin', 'POST', '/salvar-refinamento', refinamentoAdmin(orcamentoAssociado));
      expect(res.status).toBe(200);

      const salvo = await env.lerDoBanco(orcamentoAssociado);
      expect(salvo.valor_kit_final).toBe(13440);
      expect(salvo.preco_final_venda).toBeGreaterThan(0);
      expect(salvo.valor_total_km).toBe(400);
      expect(salvo.porcentagem_imposto).toBe(6);
      expect(salvo.mao_obra).toBe(80);
      // Margem de segurança do associado: 4% "por dentro" sobre o custo direto sem km
      expect(salvo.porcentagem_margem_seguranca).toBe(4);
      expect(salvo.margem_seguranca).toBe(635); // (13.440 + 800 + 500 + 500) / 0,96 - 15.240
    });

    it('associado não consegue usar a rota de refinamento do admin', async () => {
      const res = await env.api('associado', 'POST', '/salvar-refinamento', {
        ...refinamentoAdmin(orcamentoAssociado),
        valorKit: 1,
      });
      expect(res.status).toBe(403);
      expect((await env.lerDoBanco(orcamentoAssociado)).valor_kit).toBe(12000);
    });
  });

  describe('D. Associado depois da precificação', () => {
    it('D1/D5: detalhe e listagem não expõem os campos sigilosos do kit', async () => {
      const detalhe = await env.api('associado', 'GET', `/budgets/${orcamentoAssociado}`);
      expect(detalhe.status).toBe(200);
      for (const campo of CAMPOS_SIGILOSOS) expect(detalhe.data).not.toHaveProperty(campo);
      expect(detalhe.data.preco_final_venda).toBeGreaterThan(0);
      // A margem de segurança aparece como linha própria; o kit gerador é só o kit licenciado
      expect(detalhe.data.margem_seguranca).toBe(635);
      expect(detalhe.data.valor_kit_gerador).toBe(13440);

      const lista = await env.api('associado', 'GET', '/budgets');
      expect(lista.status).toBe(200);
      const itens = Array.isArray(lista.data) ? lista.data : lista.data.items;
      for (const o of itens) for (const campo of CAMPOS_SIGILOSOS) expect(o).not.toHaveProperty(campo);
    });

    it('D2: editar o km recalcula o preço preservando o kit do admin', async () => {
      const antes = await env.lerDoBanco(orcamentoAssociado);

      const res = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/custos`, {
        ...custosIniciais,
        km: 400,
      });
      expect(res.status).toBe(200);
      for (const campo of CAMPOS_SIGILOSOS) expect(res.data).not.toHaveProperty(campo);

      const depois = await env.lerDoBanco(orcamentoAssociado);
      const esperado = CalculosProcess.calcularPrecoFinal({
        valorKitLicenciado: 13440,
        valorMaoDeObra: 80,
        valorEquipamentoLocal: 50,
        valorHomologacao: antes.valor_homologacao,
        porcentagemLucroLiquido: 15,
        quantidade_paineis: 10,
        km: 400,
        custo_km: 2,
        porcentagem_imposto: 6,
        porcentagem_seguro: 1,
        porcentagem_margem_seguranca: 4,
      });

      expect(depois.valor_kit).toBe(12000);
      expect(depois.porcentagem_kit).toBe(12);
      expect(depois.valor_kit_final).toBe(13440);
      expect(depois.valor_total_km).toBe(800);
      expect(depois.preco_final_venda).toBe(esperado.precoFinalSugerido);
      expect(depois.preco_final_venda).toBeGreaterThan(antes.preco_final_venda);
    });

    it('o km soma só no valor final, sem margem/imposto (+R$ 400 para +200 km a R$ 2)', async () => {
      const antes = await env.lerDoBanco(orcamentoAssociado); // 400 km
      await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/custos`, { ...custosIniciais, km: 600 });
      const depois = await env.lerDoBanco(orcamentoAssociado);
      expect(Number((depois.preco_final_venda - antes.preco_final_venda).toFixed(2))).toBe(400);
    });

    it('associado muda a própria margem de segurança e o preço é recalculado', async () => {
      const antes = await env.lerDoBanco(orcamentoAssociado);
      const res = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/custos`, {
        ...custosIniciais,
        km: 600,
        porcentagem_margem_seguranca: 0,
      });
      expect(res.status).toBe(200);
      expect(res.data.margem_seguranca).toBe(0);
      const depois = await env.lerDoBanco(orcamentoAssociado);
      expect(depois.porcentagem_margem_seguranca).toBe(0);
      expect(depois.preco_final_venda).toBeLessThan(antes.preco_final_venda);

      // volta aos 4%
      await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/custos`, { ...custosIniciais, km: 600 });
      expect((await env.lerDoBanco(orcamentoAssociado)).preco_final_venda).toBe(antes.preco_final_venda);
    });

    it('D3: lucro acima do limite é rejeitado e nada é salvo', async () => {
      const antes = await env.lerDoBanco(orcamentoAssociado);
      const res = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/custos`, {
        ...custosIniciais,
        porcentagem_imposto: 70, // limite de lucro vira 28,5%
        lucro_liquido_perc: 35,
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toContain('limite máximo permitido');
      expect((await env.lerDoBanco(orcamentoAssociado)).preco_final_venda).toBe(antes.preco_final_venda);
    });

    it('campos fora da lista permitida são ignorados na edição de custos', async () => {
      const res = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/custos`, {
        ...custosIniciais,
        valor_kit_final: 1,
        preco_final_venda: 1,
        user_id: env.usuarios.vendedor.id,
      });
      expect(res.status).toBe(200);
      const salvo = await env.lerDoBanco(orcamentoAssociado);
      expect(salvo.valor_kit_final).toBe(13440);
      expect(salvo.preco_final_venda).toBeGreaterThan(1);
      expect(salvo.user_id).toBe(env.usuarios.associado.id);
    });

    it('valores negativos ou ausentes são rejeitados', async () => {
      const negativo = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/custos`, {
        ...custosIniciais,
        km: -10,
      });
      expect(negativo.status).toBe(400);

      const { km: _km, ...semKm } = custosIniciais;
      const ausente = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/custos`, semKm);
      expect(ausente.status).toBe(400);
    });

    it('D4: associado gera o PDF depois da precificação', async () => {
      const res = await env.api('associado', 'POST', `/gerar-pdf/${orcamentoAssociado}`);
      expect(res.status).toBe(200);
      expect(res.data.pdfUrl).toContain(orcamentoAssociado);
    }, 60_000);
  });

  describe('E. Isolamento entre usuários', () => {
    it('E1: associado só lista os próprios orçamentos', async () => {
      const lista = await env.api('associado', 'GET', '/budgets');
      const itens = Array.isArray(lista.data) ? lista.data : lista.data.items;
      expect(itens.length).toBeGreaterThan(0);
      for (const o of itens) expect(o.user_id).toBe(env.usuarios.associado.id);
    });

    it('E2: associado não abre orçamento de outro usuário', async () => {
      const res = await env.api('associado', 'GET', `/budgets/${orcamentoVendedor}`);
      expect(res.status).toBe(403);
    });

    it('associado não edita custos de orçamento de outro usuário', async () => {
      const res = await env.api('associado', 'PATCH', `/budgets/${orcamentoVendedor}/custos`, custosIniciais);
      expect(res.status).toBe(403);
      expect((await env.lerDoBanco(orcamentoVendedor)).mao_obra).toBe(100);
    });

    it('E4: vendedor não usa a rota de edição de custos, nem no próprio orçamento', async () => {
      const res = await env.api('vendedor', 'PATCH', `/budgets/${orcamentoVendedor}/custos`, custosIniciais);
      expect(res.status).toBe(403);
    });

    it('admin também não usa a rota de custos do associado (usa o refinamento)', async () => {
      const res = await env.api('admin', 'PATCH', `/budgets/${orcamentoAssociado}/custos`, custosIniciais);
      expect(res.status).toBe(403);
    });
  });

  describe('B4. Correção da solicitação pelo associado', () => {
    const solicitacao = {
      nome_cliente: 'TESTE E2E Associado corrigido',
      telefone_cliente: '(31) 99999-0000',
      email_cliente: 'cliente@teste.local',
      id_cidade: '',
      observacao: 'Observação corrigida',
      estrutura: 'Laje',
      padrao: 'Trifásico',
      consumo_mes: 900,
      valor_tarifa: 1.2,
      ...custosIniciais,
    };

    it('salva os dados corrigidos e recalcula, ignorando campos que o associado não pode mexer', async () => {
      const antes = await env.lerDoBanco(orcamentoAssociado);
      const res = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/solicitacao`, {
        ...solicitacao,
        id_cidade: env.cidadeId,
        cidade: 'Cidade Inventada',
        preco_final_venda: 1,
        valor_kit: 1,
        valor_kit_final: 1,
        user_id: 'outro_usuario',
        situacao: 'Fechado',
      });
      expect(res.status).toBe(200);
      for (const campo of CAMPOS_SIGILOSOS) expect(res.data).not.toHaveProperty(campo);

      const depois = await env.lerDoBanco(orcamentoAssociado);
      expect(depois.nome_cliente).toBe('TESTE E2E Associado corrigido');
      expect(depois.consumo_mes).toBe(900);
      expect(depois.valor_tarifa).toBe(1.2);
      expect(depois.padrao).toBe('Trifásico');
      expect(depois.observacao).toBe('Observação corrigida');
      expect(depois.cidade).not.toBe('Cidade Inventada'); // vem do cadastro da cidade
      expect(depois.user_id).toBe(antes.user_id);
      expect(depois.situacao).toBe(antes.situacao);
      expect(depois.valor_kit).toBe(antes.valor_kit);
      expect(depois.valor_kit_final).toBe(antes.valor_kit_final);
      expect(depois.preco_final_venda).toBeGreaterThan(1);
      expect(depois.valor_pago_mes).not.toBe(antes.valor_pago_mes);
    });

    it('consumo zerado é rejeitado e nada é salvo', async () => {
      const antes = await env.lerDoBanco(orcamentoAssociado);
      const res = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/solicitacao`, {
        ...solicitacao,
        id_cidade: env.cidadeId,
        nome_cliente: 'Não deveria salvar',
        consumo_mes: 0,
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toContain('consumo mensal');
      expect((await env.lerDoBanco(orcamentoAssociado)).nome_cliente).toBe(antes.nome_cliente);
    });

    it('associado não corrige solicitação de outro usuário', async () => {
      const antes = await env.lerDoBanco(orcamentoVendedor);
      const res = await env.api('associado', 'PATCH', `/budgets/${orcamentoVendedor}/solicitacao`, {
        ...solicitacao,
        id_cidade: env.cidadeId,
      });
      expect(res.status).toBe(403);
      expect((await env.lerDoBanco(orcamentoVendedor)).nome_cliente).toBe(antes.nome_cliente);
    });

    it('vendedor e admin não usam a rota de correção do associado', async () => {
      const body = { ...solicitacao, id_cidade: env.cidadeId };
      expect((await env.api('vendedor', 'PATCH', `/budgets/${orcamentoVendedor}/solicitacao`, body)).status).toBe(403);
      expect((await env.api('admin', 'PATCH', `/budgets/${orcamentoAssociado}/solicitacao`, body)).status).toBe(403);
    });
  });

  describe('F. Segurança: PocketBase direto e rotas genéricas', () => {
    it('associado e vendedor não leem orçamentos direto no PocketBase, nem os próprios', async () => {
      for (const [perfil, id] of [['associado', orcamentoAssociado], ['vendedor', orcamentoVendedor]] as const) {
        const direto = env.pocketbaseDoUsuario(perfil).collection('orcamentos');
        await expect(direto.getOne(id)).rejects.toMatchObject({ status: 404 });
        expect((await direto.getList(1, 50)).totalItems).toBe(0);
      }
    });

    it('associado não grava campos financeiros direto no PocketBase', async () => {
      const antes = await env.lerDoBanco(orcamentoAssociado);
      await expect(
        env.pocketbaseDoUsuario('associado').collection('orcamentos').update(orcamentoAssociado, { valor_kit_final: 1, preco_final_venda: 1 }),
      ).rejects.toMatchObject({ status: 404 });
      const depois = await env.lerDoBanco(orcamentoAssociado);
      expect(depois.valor_kit_final).toBe(antes.valor_kit_final);
      expect(depois.preco_final_venda).toBe(antes.preco_final_venda);
    });

    it('associado e vendedor não criam orçamento direto no PocketBase', async () => {
      for (const perfil of ['associado', 'vendedor'] as const) {
        await expect(
          env.pocketbaseDoUsuario(perfil).collection('orcamentos').create({ nome_cliente: 'Direto', user_id: env.usuarios[perfil].id }),
        ).rejects.toMatchObject({ status: 400 });
      }
    });

    it('admin continua acessando a coleção direto (realtime do painel)', async () => {
      const registro = await env.pocketbaseDoUsuario('admin').collection('orcamentos').getOne(orcamentoAssociado);
      expect(registro.valor_kit).toBeGreaterThan(0);
    });

    it('PATCH /budgets/:id só aceita email_cliente e confere o dono', async () => {
      const antes = await env.lerDoBanco(orcamentoAssociado);

      const comKit = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}`, { email_cliente: 'a@b.com', valor_kit_final: 1 });
      expect(comKit.status).toBe(400);

      const deOutro = await env.api('vendedor', 'PATCH', `/budgets/${orcamentoAssociado}`, { email_cliente: 'x@y.com' });
      expect(deOutro.status).toBe(403);

      const ok = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}`, { email_cliente: ' novo@cliente.com ' });
      expect(ok.status).toBe(200);
      CAMPOS_SIGILOSOS.forEach((campo) => expect(ok.data).not.toHaveProperty(campo));

      const depois = await env.lerDoBanco(orcamentoAssociado);
      expect(depois.email_cliente).toBe('novo@cliente.com');
      expect(depois.valor_kit_final).toBe(antes.valor_kit_final);
    });

    it('criar-solicitacao ignora kit e preço vindos do corpo; vendedor não define custos', async () => {
      const base = { nome_cliente: 'TESTE E2E Campos', id_cidade: env.cidadeId, consumo_mes: 500, valor_tarifa: 1, estrutura: 'Cerâmico', padrao: 'Bifásico' };
      const extras = { valor_kit: 1, valor_kit_final: 1, preco_final_venda: 1, lucro_equipamento: 1, user_id: env.usuarios.admin.id };

      const doAssociado = await env.api('associado', 'POST', '/criar-solicitacao', { ...base, ...extras, mao_obra: 70 });
      expect(doAssociado.status).toBe(201);
      const salvoAssociado = await env.lerDoBanco(doAssociado.data.id);
      expect(salvoAssociado.user_id).toBe(env.usuarios.associado.id);
      expect(salvoAssociado.mao_obra).toBe(70);
      expect(salvoAssociado.valor_kit || 0).toBe(0);
      expect(salvoAssociado.valor_kit_final || 0).toBe(0);
      expect(salvoAssociado.preco_final_venda || 0).toBe(0);

      const doVendedor = await env.api('vendedor', 'POST', '/criar-solicitacao', { ...base, mao_obra: 1, lucro_liquido_perc: 50 });
      expect(doVendedor.status).toBe(201);
      const salvoVendedor = await env.lerDoBanco(doVendedor.data.id);
      expect(salvoVendedor.mao_obra).toBe(100);
      expect(salvoVendedor.lucro_liquido_perc).toBe(20);
    });

    it('admin não edita o preço de orçamento de associado; associado edita e muda só o lucro', async () => {
      expect((await env.api('admin', 'PATCH', `/budgets/${orcamentoAssociado}/preco-venda`, { preco_final_venda: 99999 })).status).toBe(403);

      const antes = await env.lerDoBanco(orcamentoAssociado);
      const novoPreco = antes.preco_final_venda + 1000;
      const res = await env.api('associado', 'PATCH', `/budgets/${orcamentoAssociado}/preco-venda`, { preco_final_venda: novoPreco });
      expect(res.status).toBe(200);

      const depois = await env.lerDoBanco(orcamentoAssociado);
      expect(depois.preco_final_venda).toBe(novoPreco);
      expect(depois.imposto).toBe(antes.imposto);
      expect(depois.seguro).toBe(antes.seguro);
      expect(depois.custo_projeto).toBe(antes.custo_projeto);
      expect(depois.lucro_liquido_previsto).toBeCloseTo(antes.lucro_liquido_previsto + 1000, 2);
    });
  });
});
