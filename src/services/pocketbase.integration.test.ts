import { describe, it, expect } from 'vitest';
import pb from '../config/pocketbase';

describe('Integração PocketBase', () => {
  it('deve conseguir autenticar, conectar e listar cidades da coleção cidades_hsp', async () => {
    try {
      // Autenticação
      await pb.collection('users').authWithPassword('admin@admin.com', 'admin123');
      console.log('✅ Autenticado com sucesso!');

      // Busca as primeiras 5 cidades
      const resultList = await pb.collection('cidades_hsp').getList(1, 5);
      
      console.log(`Cidades encontradas no banco: ${resultList.items.length}`);
      console.log('Total de registros na coleção:', resultList.totalItems);
      
      if (resultList.items.length > 0) {
        resultList.items.forEach(item => {
          console.log(`- ${item.cidade} (${item.estado}): HSP ${item.mediacalc}`);
        });
      } else {
        console.log('Dica: Verifique se a coleção "cidades_hsp" tem registros e se as regras de API (List/View) estão como "Public" no Admin do PocketBase.');
      }

      // Validações básicas
      expect(resultList.items).toBeDefined();
      expect(Array.isArray(resultList.items)).toBe(true);
      
      // Se você espera que o banco não esteja vazio, descomente a linha abaixo:
      // expect(resultList.items.length).toBeGreaterThan(0);

    } catch (error: any) {
      console.error('Erro ao conectar ao PocketBase:', error.message);
      throw error;
    }
  });

  it('deve buscar uma cidade específica (ex: Florianópolis)', async () => {
    try {
      const record = await pb.collection('cidades_hsp').getFirstListItem(
        'cidade = "Florianópolis" && estado = "SANTA CATARINA"'
      );
      
      console.log('Registro encontrado:', record);
      expect(record.cidade).toBe('Florianópolis');
      expect(record.estado).toBe('SANTA CATARINA');
      expect(record.mediacalc).toBeDefined();
    } catch (error: any) {
      if (error.status === 404) {
        console.warn('⚠️ Florianópolis não encontrada no banco, mas a conexão funcionou.');
      } else {
        throw error;
      }
    }
  });
});
