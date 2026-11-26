import pb, { authenticatePB } from '../config/pocketbase';

export class CalculosDataFetcher {
  static async obterCidadePorId(pbInstance: any, id: string): Promise<any> {
    try {
      const record = await pbInstance.collection('cidades_hsp').getOne(id);
      if (!record) {
        throw new Error('Localidade não encontrada.');
      }
      return record;
    } catch (err: any) {
      if (err?.status === 403 || err?.status === 404) {
        await authenticatePB();
        const record = await pb.collection('cidades_hsp').getOne(id);
        if (!record) {
          throw new Error('Localidade não encontrada.');
        }
        return record;
      }
      throw err;
    }
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
    try {
      return await pbInstance.collection('orcamentos').getOne(id, { expand: 'user_id' });
    } catch (err: any) {
      if (err?.status === 404) return null;
      throw err;
    }
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

  // Quem chama decide a instância: o admin usa a própria sessão e os demais perfis passam pelo
  // superusuário do backend depois das checagens de perfil e dono no controller.
  static async criarOrcamento(pbInstance: any, data: any): Promise<any> {
    return pbInstance.collection('orcamentos').create(data, { expand: 'user_id' });
  }

  static async atualizarOrcamento(pbInstance: any, id: string, data: any): Promise<any> {
    return pbInstance.collection('orcamentos').update(id, data);
  }

  static async listarUsuarios(pbInstance: any): Promise<any> {
    return pbInstance.collection('users').getFullList();
  }

  static async obterUsuarioPorId(pbInstance: any, id: string): Promise<any> {
    return pbInstance.collection('users').getOne(id);
  }

  static async criarUsuario(pbInstance: any, data: any): Promise<any> {
    return pbInstance.collection('users').create({
      ...data,
      primeiro_acesso: true,
    });
  }

  /**
   * Usa a instância admin (backend@orcamentos.com como superusuário no PocketBase)
   * para atualizar a senha, contornando a updateRule da coleção users.
   * O controller já garante que o usuário só altera a própria senha.
   */
  static async alterarSenhaPrimeiroAcesso(
    _pbInstance: any,
    userId: string,
    password: string,
    passwordConfirm: string
  ): Promise<any> {
    await authenticatePB();

    return pb.collection('users').update(userId, {
      password,
      passwordConfirm,
      primeiro_acesso: false,
    });
  }
}
