import axios from 'axios';

async function verify() {
  console.log('🚀 Iniciando verificação final do servidor...');
  
  const payload = {
    cidade: "Ipameri",
    estado: "GOIÁS",
    valor_conta: 4000,
    valor_tarifa: 1
  };

  try {
    console.log('📡 Enviando requisição POST para /api/calculos/dimensionamento-minimo...');
    const response = await axios.post('http://localhost:3001/api/calculos/dimensionamento-minimo', payload);
    
    console.log('\n✅ SUCESSO! O servidor respondeu corretamente.');
    console.log('--------------------------------------------------');
    console.log('Resultados do Cálculo:');
    console.log(`- Cidade: ${response.data.localidade.cidade} (${response.data.localidade.estado})`);
    console.log(`- Consumo Mensal: ${response.data.consumo_mensal_kwh.toFixed(2)} kWh`);
    console.log(`- HSP Diário (ajustado): ${(response.data.mediacalc / 1000).toFixed(3)}`);
    console.log(`- HSP Mensal: ${response.data.hsp_mensal.toFixed(2)}`);
    console.log(`- kWp Mínimo Recomendado: ${response.data.kwp_minimo.toFixed(2)} kWp`);
    console.log('--------------------------------------------------');
    
  } catch (error: any) {
    console.error('\n❌ ERRO NO TESTE:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error('Mensagem:', error.message);
    }
    console.log('\nCertifique-se que o servidor está rodando em outro terminal com "npm run dev"');
  }
}

verify();
