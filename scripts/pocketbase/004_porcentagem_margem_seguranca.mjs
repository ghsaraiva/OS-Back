// 004: cria o campo orcamentos.porcentagem_margem_seguranca (number, min 0) e preenche os orçamentos
// existentes. Quem já tem margem em R$ recebe a % deduzida dela ("por dentro" sobre o kit licenciado:
// margem / (kit licenciado + margem)), que dá 3% nos orçamentos calculados até aqui; os demais recebem 3.
// Só altera registros com a % vazia/0. Pode rodar mais de uma vez.
import { conectar, dryRun, arredondar } from './_conexao.mjs';

const pb = await conectar();
const colecao = await pb.collections.getOne('orcamentos');

if (colecao.fields.some((f) => f.name === 'porcentagem_margem_seguranca')) {
  console.log('Campo porcentagem_margem_seguranca já existe.');
} else {
  console.log('Criando campo porcentagem_margem_seguranca (number, min 0, opcional).');
  if (!dryRun) {
    await pb.collections.update(colecao.id, {
      fields: [...colecao.fields, { name: 'porcentagem_margem_seguranca', type: 'number', required: false, min: 0 }],
    });
  }
}

const orcamentos = await pb.collection('orcamentos').getFullList({
  fields: 'id,nome_cliente,valor_kit_final,margem_seguranca,porcentagem_margem_seguranca',
});
let atualizados = 0;
for (const o of orcamentos) {
  if (o.porcentagem_margem_seguranca > 0) continue;
  const base = (o.valor_kit_final || 0) + (o.margem_seguranca || 0);
  const porcentagem = o.margem_seguranca > 0 && base > 0 ? arredondar((o.margem_seguranca / base) * 100) : 3;
  console.log(`  ${o.id} (${o.nome_cliente}): porcentagem_margem_seguranca ${o.porcentagem_margem_seguranca ?? '(vazio)'} -> ${porcentagem}`);
  if (!dryRun) await pb.collection('orcamentos').update(o.id, { porcentagem_margem_seguranca: porcentagem });
  atualizados++;
}
console.log(`Orçamentos atualizados: ${atualizados} de ${orcamentos.length}`);
