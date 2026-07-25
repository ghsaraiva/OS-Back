import { describe, it, expect } from 'vitest';
import { formatarMoeda, TAXA_SEGURO, TAXA_IMPOSTO, MAX_LUCRO_LIQUIDO_PERMITIDO } from '../../utils/calculos.utils';

describe('Calculos Utils', () => {
  it('deve ter as constantes corretas configuradas', () => {
    expect(TAXA_SEGURO).toBe(0.015);
    expect(TAXA_IMPOSTO).toBe(0.15);
    expect(MAX_LUCRO_LIQUIDO_PERMITIDO).toBe(83.0);
  });

  it('deve formatar moedas limitando em 2 casas decimais numericamente', () => {
    expect(formatarMoeda(123.456)).toBe(123.46);
    expect(formatarMoeda(100)).toBe(100.00);
    expect(formatarMoeda(0)).toBe(0);
  });
});
