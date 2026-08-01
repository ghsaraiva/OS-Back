export class CalculosDataFetcher {
  static async obterCidadePorId(pbInstance: any, id: string): Promise<any> {
    const record = await pbInstance.collection('cidades_hsp').getOne(id);
    if (!record) {
      throw new Error('Localidade não encontrada.');
    }
    return record;
  }

  static async obterCidadesHSP(pbInstance: any, search?: string): Promise<any> {
    let filter = '';
    if (search) {
      const lowerSearch = search.trim().toLowerCase();
      filter = pbInstance.filter('cidade ~ {:search} || estado ~ {:search}', { search: lowerSearch });
    }
    return pbInstance.collection('cidades_hsp').getFullList({
      filter,
      sort: 'cidade'
    });
  }

  static async obterOrcamentoPorId(pbInstance: any, id: string): Promise<any> {
    const record = await pbInstance.collection('orcamentos').getOne(id, {
      expand: 'user_id'
    });
    if (!record) {
      throw new Error('Orçamento não encontrado.');
    }
    return record;
  }

  static async listarOrcamentos(pbInstance: any, filter: string): Promise<any> {
    return pbInstance.collection('orcamentos').getFullList({
      sort: '-created',
      expand: 'user_id',
      filter
    });
  }

  static async listarOrcamentosSimplificados(pbInstance: any, filter: string): Promise<any> {
    return pbInstance.collection('orcamentos').getFullList({
      filter,
      fields: 'id,situacao,nome_cliente,telefone_cliente,email_cliente,estado,user_id'
    });
  }

  static async criarOrcamento(pbInstance: any, data: any): Promise<any> {
    return pbInstance.collection('orcamentos').create(data);
  }

  static async atualizarOrcamento(pbInstance: any, id: string, data: any): Promise<any> {
    return pbInstance.collection('orcamentos').update(id, data);
  }

  static async listarUsuarios(pbInstance: any): Promise<any> {
    return pbInstance.collection('users').getFullList();
  }

  static async criarUsuario(pbInstance: any, data: any): Promise<any> {
    return pbInstance.collection('users').create(data);
  }
}
