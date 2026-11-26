export const TAXA_SEGURO = 0.01; // 1%
export const TAXA_IMPOSTO = 0.08; // 8%
export const TAXA_MARGEM_SEGURANCA = 0.03; // 3% "por dentro" sobre o custo direto sem km
export const MAX_LUCRO_LIQUIDO_PERMITIDO = 83.0; // 83% de margem é o limite seguro recomendado

export function formatarMoeda(valor: number): number {
  return Number(valor.toFixed(2));
}

/**
 * Taxa (0 a 1) gravada no orçamento. O PocketBase grava 0 em campo numérico vazio, então
 * orçamentos antigos podem ter a porcentagem 0 com o valor em R$ preenchido: nesse caso a
 * taxa é deduzida do valor sobre a base em que ela incide.
 */
export function resolverTaxa(porcentagem: number | null | undefined, valor: number | undefined, base: number, padrao: number): number {
  if (porcentagem !== undefined && porcentagem !== null && porcentagem > 0) return porcentagem / 100;
  if ((valor || 0) > 0 && base > 0) return Number(((valor as number) / base).toFixed(4));
  if (porcentagem === 0) return 0;
  return padrao;
}

/**
 * Porcentagem (0 a 100) da margem de segurança do orçamento. Se a porcentagem estiver vazia, ela
 * é deduzida do valor gravado. Orçamentos anteriores ao campo calculavam a margem "por dentro"
 * sobre o kit licenciado, então a dedução usa essa base: margem / (kit licenciado + margem).
 */
export function resolverPorcentagemMargem(orcamento: { porcentagem_margem_seguranca?: number | null; margem_seguranca?: number; valor_kit_final?: number }): number {
  const base = (orcamento.valor_kit_final || 0) + (orcamento.margem_seguranca || 0);
  return formatarMoeda(resolverTaxa(orcamento.porcentagem_margem_seguranca, orcamento.margem_seguranca, base, TAXA_MARGEM_SEGURANCA) * 100);
}
