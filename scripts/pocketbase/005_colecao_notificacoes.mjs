// 005: cria a coleção notificacoes (aviso ao admin quando vendedor/associado cria um orçamento).
// Acesso só pelo backend (superusuário): todas as regras ficam fechadas (null).
// Apagar o usuário ou o orçamento apaga as notificações ligadas a ele. Pode rodar mais de uma vez.
import { conectar, dryRun } from './_conexao.mjs';

const pb = await conectar();
const existentes = await pb.collections.getFullList({ fields: 'name' });
if (existentes.some((c) => c.name === 'notificacoes')) {
  console.log('Coleção notificacoes já existe.');
  process.exit(0);
}

const orcamentos = await pb.collections.getOne('orcamentos');
const colecao = {
  name: 'notificacoes',
  type: 'base',
  listRule: null,
  viewRule: null,
  createRule: null,
  updateRule: null,
  deleteRule: null,
  fields: [
    { name: 'user_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, cascadeDelete: true, required: true },
    { name: 'orcamento_id', type: 'relation', collectionId: orcamentos.id, maxSelect: 1, cascadeDelete: true, required: false },
    { name: 'titulo', type: 'text', required: true },
    { name: 'mensagem', type: 'text', required: false },
    { name: 'lida', type: 'bool', required: false },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
  indexes: ['CREATE INDEX idx_notificacoes_user_lida ON notificacoes (user_id, lida)'],
};

console.log('Criando coleção notificacoes:', colecao.fields.map((f) => `${f.name} (${f.type})`).join(', '));
if (!dryRun) {
  await pb.collections.create(colecao);
  console.log('Coleção criada.');
}
