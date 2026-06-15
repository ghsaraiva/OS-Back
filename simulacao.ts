import calculosService from './src/services/calculos.service';

async function simular() {
  try {
    console.log('--- INICIANDO SIMULAÇÃO SÃO PAULO ---');
    
    // Para chegar em 15.55 kWp com HSP de 3.783 e tarifa 0.85:
    // kwp_minimo = consumo_mensal / (hsp * 30)
    // 15.55 = consumo / (3.783 * 30)
    // 15.55 = consumo / 113.49
    // consumo = 15.55 * 113.49 = 1764.77 kWh
    // valor_conta = 1764.77 * 0.85 = 1500.05
    
    const dim = await calculosService.calcularDimensionamentoMinimo({
      cidade: 'São Paulo',
      estado: 'SÃO PAULO',
      valor_conta: 1500.05,
      valor_tarifa: 0.85
    });
    console.log('\n--- DIMENSIONAMENTO MÍNIMO ---');
    console.log(`Consumo: ${dim.consumo_mensal_kwh} kWh`);
    console.log(`HSP Mensal: ${dim.hsp_mensal}`);
    console.log(`kWp Mínimo: ${dim.kwp_minimo} kWp`);

    const real = calculosService.calcularSistemaReal({
      potencia_painel: 605,
      quantidade_paineis: 24
    });
    console.log('\n--- SISTEMA REAL ---');
    console.log(`Potência do Sistema: ${real.kwp_sistema} kWp`);

    const retorno = calculosService.calcularGeracaoERetorno({
      kwp_sistema: real.kwp_sistema,
      mediacalc: dim.mediacalc * 1000,
      valor_tarifa: 0.85
    });
    console.log('\n--- RETORNO FINANCEIRO ---');
    console.log(`Geração Mensal: ${retorno.geracao_mensal_kwh} kWh`);
    console.log(`Economia Mensal: R$ ${retorno.economia_mensal_rs}`);

    const comercial = calculosService.calcularCascataFinanceira({
      valorKit: 20323.27,
      valorPorcentagem: 0.10, 
      valorHomologacao: 1000,
      valorEquipamentoLocal: 75,
      valorMaoDeObra: 100,
      lucroDesejadoInteiro: 17
    });
    console.log('\n--- COMERCIAL COMPLETO ---');
    console.log(JSON.stringify(comercial, null, 2));

  } catch (error: any) {
    console.error('Erro na simulação:', error.message);
  }
}

simular();
