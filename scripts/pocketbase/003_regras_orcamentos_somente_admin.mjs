// 003: a coleção orcamentos passa a ser acessível direto no PocketBase só pelo admin.
// Associado e vendedor leem e gravam pelo backend, que confere perfil e dono e esconde os campos sigilosos
// (valor_kit, porcentagem_kit, lucro_equipamento, margem_seguranca).
// Requer o backend/front da mesma versão já no ar. Pode rodar mais de uma vez.
// Para desfazer: node scripts/pocketbase/003_regras_orcamentos_somente_admin.mjs --reverter
import { conectar, dryRun } from './_conexao.mjs';

const SOMENTE_ADMIN = '@request.auth.tipo_acesso = "admin"';

const NOVAS = {
  listRule: SOMENTE_ADMIN,
  viewRule: SOMENTE_ADMIN,
  createRule: SOMENTE_ADMIN,
  updateRule: SOMENTE_ADMIN,
  deleteRule: SOMENTE_ADMIN,
};

// Regras que existiam antes desta mudança (dev, 2026-11-22)
const ANTERIORES = {
  listRule: '@request.auth.id != "" && (@request.auth.tipo_acesso = "admin" || user_id = @request.auth.id)',
  viewRule: '(@request.auth.id = user_id) || (@request.auth.tipo_acesso = "admin")',
  createRule: '(@request.auth.id != "")',
  updateRule: '@request.auth.tipo_acesso = "admin" || \n(\n  user_id = @request.auth.id && \n  situacao = "Aberto" && \n  @request.body.mao_obra:isset = false && \n  @request.body.equipamento_local:isset = false && \n  @request.body.lucro_liquido_perc:isset = false &&\n  @request.body.kwp_minimo:isset = false\n)',
  deleteRule: '@request.auth.tipo_acesso = "admin"',
};

const pb = await conectar();
const colecao = await pb.collections.getOne('orcamentos');
const alvo = process.argv.includes('--reverter') ? ANTERIORES : NOVAS;

for (const [regra, valor] of Object.entries(alvo)) {
  const atual = colecao[regra];
  console.log(`${regra}: ${atual === valor ? 'sem mudança' : `${JSON.stringify(atual)}\n    -> ${JSON.stringify(valor)}`}`);
}
if (!dryRun) {
  await pb.collections.update(colecao.id, alvo);
  console.log('Regras gravadas.');
}
