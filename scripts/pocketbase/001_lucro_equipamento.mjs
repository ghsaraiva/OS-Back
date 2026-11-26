// 001: cria o campo orcamentos.lucro_equipamento (number) e preenche os orçamentos já precificados
// com valor_kit_final - valor_kit. Pode rodar mais de uma vez.
import { conectar, dryRun, arredondar } from './_conexao.mjs';

const pb = await conectar();
const colecao = await pb.collections.getOne('orcamentos');

if (colecao.fields.some((f) => f.name === 'lucro_equipamento')) {
  console.log('Campo lucro_equipamento já existe.');
} else {
  console.log('Criando campo lucro_equipamento (number, opcional).');
  if (!dryRun) {
    await pb.collections.update(colecao.id, {
      fields: [...colecao.fields, { name: 'lucro_equipamento', type: 'number', required: false }],
    });
  }
}

const orcamentos = await pb.collection('orcamentos').getFullList({ fields: 'id,valor_kit,valor_kit_final,lucro_equipamento' });
let atualizados = 0;
for (const o of orcamentos) {
  if (!(o.valor_kit > 0 && o.valor_kit_final > 0)) continue;
  const lucro = arredondar(o.valor_kit_final - o.valor_kit);
  if (o.lucro_equipamento === lucro) continue;
  console.log(`  ${o.id}: lucro_equipamento ${o.lucro_equipamento ?? '(vazio)'} -> ${lucro}`);
  if (!dryRun) await pb.collection('orcamentos').update(o.id, { lucro_equipamento: lucro });
  atualizados++;
}
console.log(`Orçamentos atualizados: ${atualizados} de ${orcamentos.length}`);
