import pb, { authenticatePB } from './src/config/pocketbase';

async function checkCampoGrande() {
  await authenticatePB();
  const records = await pb.collection('cidades_hsp').getList(1, 10, {
    filter: 'cidade ~ "Campo Grande" && estado ~ "MATO GROSSO"'
  });
  console.log('--- RESULTADOS PARA CAMPO GRANDE NO BANCO ---');
  console.log(JSON.stringify(records.items, null, 2));
}

checkCampoGrande();
