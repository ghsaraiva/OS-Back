import pb, { authenticatePB } from './src/config/pocketbase';

async function findSP() {
  await authenticatePB();
  const records = await pb.collection('cidades_hsp').getFirstListItem(
    'cidade = "São Paulo" && estado = "SÃO PAULO"'
  );
  console.log(JSON.stringify(records, null, 2));
}

findSP();
