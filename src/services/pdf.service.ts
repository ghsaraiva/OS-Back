import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fontkit from '@pdf-lib/fontkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PdfService {
  /**
   * Generates the PDF proposal replacing AcroForm TextFields with real formatted data.
   */
  static async gerarPdfProposta(dadosOrcamento: any): Promise<Buffer> {
    const templatePath = path.join(process.cwd(), 'src', 'assets', 'templates', 'proposta_sofia_template.pdf');
    const templateBytes = await fs.readFile(templatePath);
    
    // Load with pdf-lib
    const pdfDocLib = await PDFDocument.load(templateBytes);
    pdfDocLib.registerFontkit(fontkit);
    
    let customFont;
    try {
      const fontPath = path.join(process.cwd(), 'src', 'assets', 'fonts', 'Sora-Medium.ttf');
      const fontBytes = await fs.readFile(fontPath);
      customFont = await pdfDocLib.embedFont(fontBytes);
    } catch (err) {
      console.warn("Could not load custom font Sora-Medium.ttf, using default.", err);
    }

    const form = pdfDocLib.getForm();
    
    const formatCurrency = (val: number) => Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatNumber = (val: number) => val.toString().replace('.', ',');
    const formatTitleCase = (str: string) => {
      if (!str) return '';
      return str.toLowerCase().replace(/(?:^|[\s-])\S/g, (match) => match.toUpperCase());
    };
    
    // Calculate derived values
    const peso_total_paineis = (dadosOrcamento.peso_painel || 0) * (dadosOrcamento.qtd_paineis || 0);
    const consumo_ano = (dadosOrcamento.consumo_mes || 0) * 12;
    const economia_mensal_rs = (dadosOrcamento.consumo_mes || 0) - (dadosOrcamento.valor_pago_mes || 0);
    const economia_anual_rs = economia_mensal_rs * 12;

    const dataMap: { [key: string]: string } = {
      'nome_cliente': dadosOrcamento.nome_cliente || '',
      'cidade': formatTitleCase(dadosOrcamento.cidade || ''),
      'estado': formatTitleCase(dadosOrcamento.estado || ''),
      'created': new Date(dadosOrcamento.created).toLocaleDateString('pt-BR'),
      'kwp_sistema': `${formatNumber(dadosOrcamento.kwp_sistema || 0)} kWp`,
      'kwp_sistema1': `${formatNumber(dadosOrcamento.kwp_sistema || 0)} kWp`,
      'kwp_sistema2': `${formatNumber(dadosOrcamento.kwp_sistema || 0)} kWp`,
      'kwp_sistema3': `${formatNumber(dadosOrcamento.kwp_sistema || 0)} kWp`,
      'potencia_inversor': `${formatNumber(dadosOrcamento.potencia_inversor || 0)} kW`,
      'area_estimada': `${formatNumber(dadosOrcamento.area_estimada || 0)} m²`,
      'peso_total_paineis': `${formatNumber(peso_total_paineis)} kg`,
      'quantidade_paineis': `${dadosOrcamento.qtd_paineis || 0}`,
      'quantidade_inversores': `${dadosOrcamento.qtd_inversores || 0}`,
      'consumo_mes': formatCurrency(dadosOrcamento.consumo_mes || 0),
      'consumo_ano': formatCurrency(consumo_ano),
      'valor_tarifa': formatCurrency(dadosOrcamento.valor_tarifa || 0),
      'consumo_mensal_kwh': `${formatNumber(dadosOrcamento.geracao_mes || 0)} kWh`,
      'geracao_mensal_kwh': `${formatNumber(dadosOrcamento.geracao_mes || 0)} kWh`,
      'valor_pago_mes': formatCurrency(dadosOrcamento.valor_pago_mes || 0),
      'valor_pago_ano': formatCurrency(dadosOrcamento.valor_pago_ano || 0),
      'porcentagem_reducao': `${formatNumber((dadosOrcamento.porcentagem_reducao || 0) * 100)}%`,
      'economia_mensal_rs': formatCurrency(economia_mensal_rs),
      'economia_anual_rs': formatCurrency(economia_anual_rs),
      'tempo_retorno': dadosOrcamento.tempo_retorno || '',
      'preco_final_venda': Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(dadosOrcamento.preco_final_venda || 0),
      'observacao': `Fornecimento de sistema fotovoltaico com potência total de ${formatNumber(dadosOrcamento.kwp_sistema || 0)} kWp, inclusive serviço de engenharia, materiais e instalação.` + (dadosOrcamento.observacao ? `\n\n${dadosOrcamento.observacao}` : ''),
      'marca_modulo': dadosOrcamento.marca_painel || '',
      'potencia_painel': `${dadosOrcamento.potencia_painel || 0}W`,
      'peso_painel': `${dadosOrcamento.peso_painel || 0}kg`,
      'modelo_inversor': dadosOrcamento.modelo_inversor || '',
      'marca_inversor': dadosOrcamento.marca_inversor || '',
      'monitoramento_inversor': dadosOrcamento.monitoramento_inversor || '',
      'estrutura': dadosOrcamento.estrutura || '',
      'material_structure': dadosOrcamento.material_structure || '',
      'garantia_estrutura': dadosOrcamento.garantia_estrutura || '',
      'caracteristica_estrutura_1': dadosOrcamento.caracteristica_estrutura_1 || '',
      'caracteristica_estrutura_2': dadosOrcamento.caracteristica_estrutura_2 || '',
      'caracteristica_estrutura_3': dadosOrcamento.caracteristica_estrutura_3 || '',
      'caracteristica_estrutura_4': dadosOrcamento.caracteristica_estrutura_4 || '',
      'caracteristica_estrutura_5': dadosOrcamento.caracteristica_estrutura_5 || '',
      'tensao_inversor': `${dadosOrcamento.tensao_inversor || 0}V`,
      'garantia_inversor': dadosOrcamento.garantia_inversor || '',
      'garantia_fabrica_modulo': dadosOrcamento.garantia_fabrica_modulo || '',
      'garantia_eficiencia_modulo': dadosOrcamento.garantia_eficiencia_modulo || '',
      'garantia_instalacao': dadosOrcamento.garantia_instalacao || '',
      'composicao_1': (dadosOrcamento.composicao_1 || '').replace(new RegExp(`^${dadosOrcamento.qtd_paineis}\\s*`, 'i'), '').replace(/^m/i, 'M'),
      'composicao_2': (dadosOrcamento.composicao_2 || '').replace(new RegExp(`^${dadosOrcamento.qtd_inversores}\\s*`, 'i'), ''),
      'cidade_estado': `${formatTitleCase(dadosOrcamento.cidade || '')} - ${formatTitleCase(dadosOrcamento.estado || '')}`,
      'composicao_3': dadosOrcamento.composicao_3 || '',
      'composicao_4': 'Ano de Seguro',
      'quantidade_composicao_4': '1',
    };

    // Fill AcroForm TextFields based on their current text value (default value)
    const fields = form.getFields();
    for (const field of fields) {
      try {
        const fieldName = field.getName();
        const textField = form.getTextField(fieldName);
        if (textField) {
          const currentText = textField.getText()?.trim();
          if (currentText && dataMap[currentText] !== undefined) {
            let valueToSet = dataMap[currentText];
            
            // Habilita múltiplas linhas para campos de composição e observação
            if (currentText.startsWith('composicao_') || currentText === 'observacao' || currentText === 'material_structure') {
              textField.enableMultiline();
            }

            // Define tamanho de fonte dinâmico (auto-scaling) apenas para material_structure
            if (currentText === 'material_structure') {
              textField.setFontSize(0);
            }

            // Se for um dos campos de garantia da última página, removemos a palavra 'anos'
            const isLastPageGuarantee = [
              'garantia_inversor',
              'garantia_fabrica_modulo',
              'garantia_eficiencia_modulo',
              'garantia_instalacao'
            ].includes(fieldName);

            if (isLastPageGuarantee) {
              valueToSet = valueToSet.toString().replace(/\s*anos?/i, '').trim();
            }

            textField.setText(valueToSet);
          }
        }
      } catch (err) {
        // Ignora campos que não são text field
      }
    }

    if (customFont) {
      form.updateFieldAppearances(customFont);
    }
    
    form.flatten(); // Fixa o texto e remove o aspecto editável

    const pdfBytes = await pdfDocLib.save();
    return Buffer.from(pdfBytes);
  }
}
