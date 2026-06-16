import PocketBase from 'pocketbase';
import dotenv from 'dotenv';

dotenv.config();

const pb = new PocketBase(process.env.POCKETBASE_URL);

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
      await pb.collection('users').authWithPassword(
        process.env.POCKETBASE_ADMIN_EMAIL || '',
        process.env.POCKETBASE_ADMIN_PASSWORD || ''
      );
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

export default pb;

