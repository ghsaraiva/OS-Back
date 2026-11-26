// Conexão comum dos scripts de migração do PocketBase.
// Usa POCKETBASE_URL / POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD do .env do backend,
// então para rodar em prod basta apontar essas variáveis para o PocketBase de produção.
import 'dotenv/config';
import PocketBase from 'pocketbase';

export const dryRun = process.argv.includes('--dry-run');

export async function conectar() {
  const pb = new PocketBase(process.env.POCKETBASE_URL);
  pb.autoCancellation(false);
  await pb.collection('_superusers').authWithPassword(
    process.env.POCKETBASE_ADMIN_EMAIL || '',
    process.env.POCKETBASE_ADMIN_PASSWORD || '',
  );
  console.log(`PocketBase: ${process.env.POCKETBASE_URL}${dryRun ? '  (dry-run: nada será gravado)' : ''}`);
  return pb;
}

export const arredondar = (valor) => Math.round(valor * 100) / 100;
