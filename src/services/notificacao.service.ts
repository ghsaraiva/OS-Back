import { EmailService } from './email.service';

const PERFIS_LABEL: Record<string, string> = { vendedor: 'Vendedor', associado: 'Associado' };

/**
 * Notificações para os admins. A coleção notificacoes só é acessível pelo superusuário,
 * então todas as funções recebem o PocketBase autenticado do backend.
 */
export class NotificacaoService {
  /** Avisa cada admin (sino do app + e-mail) que um vendedor/associado cadastrou um orçamento. */
  static async notificarNovoOrcamento(pb: any, orcamento: any, autor: { name?: string; email?: string; tipo_acesso?: string }) {
    const admins = await pb.collection('users').getFullList({
      filter: 'tipo_acesso = "admin"',
      fields: 'id,email',
    });
    if (admins.length === 0) return;

    const autorNome = autor.name?.trim() || autor.email || 'Usuário';
    const perfil = PERFIS_LABEL[autor.tipo_acesso || ''] || autor.tipo_acesso || '';
    const cidade = [orcamento.cidade, orcamento.estado].filter(Boolean).join(' - ');

    await Promise.all(
      admins.map((admin: any) =>
        pb.collection('notificacoes').create({
          user_id: admin.id,
          orcamento_id: orcamento.id,
          titulo: `Novo orçamento de ${autorNome}`,
          mensagem: `${perfil}: ${orcamento.nome_cliente}${cidade ? ` (${cidade})` : ''}. Aguardando precificação.`,
          lida: false,
        }),
      ),
    );

    await EmailService.enviarNovoOrcamentoAdmin({
      toEmails: admins.map((a: any) => a.email).filter(Boolean),
      autorNome,
      tipoAcesso: perfil,
      clienteNome: orcamento.nome_cliente,
      cidade,
      orcamentoId: orcamento.id,
    });
  }

  static async listar(pb: any, userId: string) {
    const resultado = await pb.collection('notificacoes').getList(1, 20, {
      filter: pb.filter('user_id = {:userId}', { userId }),
      sort: '-created',
    });
    const naoLidas = await pb.collection('notificacoes').getList(1, 1, {
      filter: pb.filter('user_id = {:userId} && lida = false', { userId }),
      fields: 'id',
    });
    return { itens: resultado.items, naoLidas: naoLidas.totalItems };
  }

  /** Marca como lida só se a notificação for do usuário; devolve false se não for. */
  static async marcarLida(pb: any, userId: string, id: string): Promise<boolean> {
    const notificacao = await pb.collection('notificacoes').getOne(id).catch(() => null);
    if (!notificacao || notificacao.user_id !== userId) return false;
    if (!notificacao.lida) await pb.collection('notificacoes').update(id, { lida: true });
    return true;
  }

  static async marcarTodasLidas(pb: any, userId: string) {
    const pendentes = await pb.collection('notificacoes').getFullList({
      filter: pb.filter('user_id = {:userId} && lida = false', { userId }),
      fields: 'id',
    });
    await Promise.all(pendentes.map((n: any) => pb.collection('notificacoes').update(n.id, { lida: true })));
    return pendentes.length;
  }
}
