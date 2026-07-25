export const TAXA_SEGURO = 0.015; // 1.5%
export const TAXA_IMPOSTO = 0.15; // 15%
export const MAX_LUCRO_LIQUIDO_PERMITIDO = 83.0; // 83% de margem é o limite seguro recomendado

export function formatarMoeda(valor: number): number {
  return Number(valor.toFixed(2));
}
