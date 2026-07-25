import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalculosDataFetcher } from '../../services/calculos.dataFetcher';

describe('Calculos DataFetcher (PocketBase)', () => {
  let pbMock: any;

  beforeEach(() => {
    pbMock = {
      collection: vi.fn().mockReturnThis(),
      getOne: vi.fn(),
      getFullList: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      filter: vi.fn()
    };
  });

  it('deve obter cidade por ID e lançar erro se não encontrar', async () => {
    pbMock.getOne.mockResolvedValue({ id: 'cid123', mediacalc: 5.0 });
    const res = await CalculosDataFetcher.obterCidadePorId(pbMock, 'cid123');
    expect(pbMock.collection).toHaveBeenCalledWith('cidades_hsp');
    expect(pbMock.getOne).toHaveBeenCalledWith('cid123');
    expect(res.id).toBe('cid123');

    pbMock.getOne.mockResolvedValue(null);
    await expect(CalculosDataFetcher.obterCidadePorId(pbMock, 'invalido')).rejects.toThrow('Localidade não encontrada.');
  });

  it('deve obter orçamento por ID', async () => {
    pbMock.getOne.mockResolvedValue({ id: 'orc1', nome_cliente: 'João' });
    const res = await CalculosDataFetcher.obterOrcamentoPorId(pbMock, 'orc1');
    expect(pbMock.collection).toHaveBeenCalledWith('orcamentos');
    expect(pbMock.getOne).toHaveBeenCalledWith('orc1', { expand: 'user_id' });
    expect(res.nome_cliente).toBe('João');
  });

  it('deve listar cidades aplicando filtro de pesquisa caso enviado', async () => {
    pbMock.getFullList.mockResolvedValue([{ cidade: 'Rio de Janeiro' }]);
    pbMock.filter.mockReturnValue('filter_string');
    
    await CalculosDataFetcher.obterCidadesHSP(pbMock, 'rio');
    
    expect(pbMock.filter).toHaveBeenCalledWith('cidade ~ {:search} || estado ~ {:search}', { search: 'rio' });
    expect(pbMock.getFullList).toHaveBeenCalledWith({ filter: 'filter_string', sort: 'cidade' });
  });

  it('deve listar orçamentos', async () => {
    pbMock.getFullList.mockResolvedValue([]);
    await CalculosDataFetcher.listarOrcamentos(pbMock, 'user_id = "1"');
    expect(pbMock.getFullList).toHaveBeenCalledWith({
      sort: '-created',
      expand: 'user_id',
      filter: 'user_id = "1"'
    });
  });

  it('deve atualizar um orçamento', async () => {
    pbMock.update.mockResolvedValue({ status: 'ok' });
    await CalculosDataFetcher.atualizarOrcamento(pbMock, 'orc1', { situacao: 'Fechado' });
    expect(pbMock.update).toHaveBeenCalledWith('orc1', { situacao: 'Fechado' });
  });
});
