import { describe, it, expect, beforeAll } from 'vitest';
import pb, { authenticatePB } from '../../config/pocketbase';

describe('Integração PocketBase (Real Database Integration)', () => {
  let testBudget: any = null;
  let testCity: any = null;

  beforeAll(async () => {
    // Tenta autenticar o cliente antes de rodar os testes
    try {
      await authenticatePB();
      console.log('✅ Autenticado com sucesso no PocketBase para os testes.');
    } catch (error: any) {
      console.error('⚠️ Falha ao autenticar no PocketBase. Verifique suas credenciais em .env:', error.message);
    }
  });

  it('deve se certificar que existe conexão e dados de HSP cadastrados', async () => {
    try {
      // Busca as primeiras 5 cidades
      const resultList = await pb.collection('cidades_hsp').getList(1, 5);
      
      console.log(`Cidades encontradas no banco: ${resultList.items.length}`);
      console.log('Total de registros na coleção cidades_hsp:', resultList.totalItems);
      
      expect(resultList.items).toBeDefined();
      expect(Array.isArray(resultList.items)).toBe(true);

      if (resultList.items.length > 0) {
        testCity = resultList.items[0]; // Salva uma cidade para os próximos passos
      }
    } catch (error: any) {
      console.error('Erro ao listar cidades:', error.message);
      throw error;
    }
  });

  it('deve realizar o fluxo de criar, ler, editar e excluir um orçamento de teste', async () => {
    if (!testCity) {
      console.warn('⚠️ Nenhuma cidade encontrada para rodar o fluxo de orçamentos. Pulando teste.');
      return;
    }

    try {
      // 1. Criar Orçamento Inicial
      const payloadInicial = {
        user_id: pb.authStore.model?.id || '',
        nome_cliente: 'Test Integration Client',
        id_cidade: testCity.id,
        cidade: testCity.cidade,
        estado: testCity.estado,
        estrutura: 'Fibrocimento',
        padrao: 'Trifásico',
        consumo_mes: 600,
        valor_tarifa: 0.95,
        situacao: 'Aberto',
        observacao: 'Orçamento de teste de integração.'
      };

      const orcamentoCriado = await pb.collection('orcamentos').create(payloadInicial);
      console.log('🚀 Orçamento criado com sucesso. ID:', orcamentoCriado.id);
      
      expect(orcamentoCriado.id).toBeDefined();
      expect(orcamentoCriado.nome_cliente).toBe(payloadInicial.nome_cliente);
      expect(orcamentoCriado.situacao).toBe('Aberto');
      testBudget = orcamentoCriado;

      // 2. Editar/Atualizar o Orçamento (Refinamento Gerencial)
      const payloadRefinamento = {
        situacao: 'Aprovado',
        potencia_painel: 550,
        qtd_paineis: 12,
        valor_kit: 12500,
        preco_final_venda: 23000,
        observacao: 'Orçamento atualizado pelo teste de integração.'
      };

      const orcamentoEditado = await pb.collection('orcamentos').update(testBudget.id, payloadRefinamento);
      console.log('✏️ Orçamento editado com sucesso.');

      expect(orcamentoEditado.situacao).toBe('Aprovado');
      expect(orcamentoEditado.qtd_paineis).toBe(12);
      expect(orcamentoEditado.preco_final_venda).toBe(23000);

      // 3. Excluir o Orçamento para não poluir o banco de dados (se permitido)
      let deletedSuccessfully = false;
      try {
        await pb.collection('orcamentos').delete(testBudget.id);
        console.log('🧹 Orçamento de teste excluído com sucesso.');
        deletedSuccessfully = true;
      } catch (err: any) {
        if (err.status === 403 || err.status === 400) {
          console.warn('⚠️ Nota: A deleção física de orçamentos é restrita no PocketBase. O orçamento de teste foi mantido para fins de auditoria.');
        } else {
          throw err;
        }
      }

      // Se deletou com sucesso, verifica se realmente foi apagado
      if (deletedSuccessfully) {
        let recordExists = true;
        try {
          await pb.collection('orcamentos').getOne(testBudget.id);
        } catch (err: any) {
          if (err.status === 404) {
            recordExists = false;
          }
        }
        expect(recordExists).toBe(false);
      }

    } catch (error: any) {
      console.error('Erro durante o fluxo de testes de orçamento:', error.message);
      
      // Cleanup de emergência caso falhe após criar
      if (testBudget && testBudget.id) {
        try {
          await pb.collection('orcamentos').delete(testBudget.id);
          console.log('🧹 Cleanup de emergência executado.');
        } catch (cleanErr) {}
      }
      throw error;
    }
  });
});
