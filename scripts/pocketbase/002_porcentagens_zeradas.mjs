// 002: orçamentos antigos com porcentagem_imposto / porcentagem_seguro = 0 mas com imposto / seguro em R$.
// Deduz a porcentagem do valor gravado sobre a base em que ela incide (mesma regra de resolverTaxa no backend):
//   seguro  = (preço - km) × taxa
//   imposto = (preço - km - kit licenciado) × taxa
// Pode rodar mais de uma vez.
import { conectar, dryRun, arredondar } from './_conexao.mjs';

const pb = await conectar();
const orcamentos = await pb.collection('orcamentos').getFullList();
let atualizados = 0;

for (const o of orcamentos) {
  const precoSemKm = (o.preco_final_venda || 0) - (o.km || 0) * (o.custo_km || 0);
  const baseImposto = precoSemKm - (o.valor_kit_final || 0);
  const dados = {};

  if (!(o.porcentagem_seguro > 0) && o.seguro > 0 && precoSemKm > 0) {
    dados.porcentagem_seguro = arredondar((o.seguro / precoSemKm) * 100);
  }
  if (!(o.porcentagem_imposto > 0) && o.imposto > 0 && baseImposto > 0) {
    dados.porcentagem_imposto = arredondar((o.imposto / baseImposto) * 100);
  }
  if (Object.keys(dados).length === 0) continue;

  console.log(`  ${o.id} (${o.nome_cliente}):`, JSON.stringify(dados));
  if (!dryRun) await pb.collection('orcamentos').update(o.id, dados);
  atualizados++;
}
console.log(`Orçamentos atualizados: ${atualizados} de ${orcamentos.length}`);
