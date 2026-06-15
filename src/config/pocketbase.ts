import PocketBase from 'pocketbase';
import dotenv from 'dotenv';

dotenv.config();

const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://150.136.18.45');

// Desabilitar autocancelamento para o backend
pb.autoCancellation(false);

let authPromise: Promise<void> | null = null;

// Função para garantir que o backend está autenticado
export async function authenticatePB() {
  if (pb.authStore.isValid) return;

  if (authPromise) {
    return authPromise;
  }

  authPromise = (async () => {
    try {
      await pb.collection('users').authWithPassword('admin@admin.com', 'admin123');
      console.log('✅ Backend autenticado no PocketBase');
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

export default pb;

