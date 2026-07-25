import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Usando importação dinâmica do pdfjs-dist para garantir que funcionará com ESM/CJS
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PdfService {
  /**
   * Generates the PDF proposal replacing invisible tags with real formatted data.
   */
  static async gerarPdfProposta(dadosOrcamento: any): Promise<Buffer> {
    const templatePath = path.resolve(__dirname, '../assets/templates/proposta_sofia_template.pdf.pdf');
    const templateBytes = await fs.readFile(templatePath);
    
    // Parse the PDF with pdfjs-dist to find the coordinates
    const data = new Uint8Array(templateBytes);
    const loadingTask = pdfjsLib.getDocument({
      data,
      useSystemFonts: true,
      standardFontDataUrl: path.join(__dirname, '../../../node_modules/pdfjs-dist/standard_fonts/')
    });
    
    const pdfDocument = await loadingTask.promise;
    
    // Create a mapping of {{tag}} to { pageIndex, x, y }
    const tagCoordinates: { [tag: string]: any[] } = {};
    
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      
      textContent.items.forEach((item: any) => {
        if (item.str && item.str.includes('{{')) {
          // Extrai todas as tags da string atual (ex: "{{nome_cliente}}")
          const regex = /{{[^}]+}}/g;
          const tags = item.str.match(regex);
          
          if (tags) {
            tags.forEach((tag: string) => {
              // transform: [ scaleX, skewY, skewX, scaleY, translateX, translateY ]
              const x = item.transform[4];
              const y = item.transform[5];
              
              if (!tagCoordinates[tag]) {
                tagCoordinates[tag] = [];
              }
              tagCoordinates[tag].push({ pageIndex: i - 1, x, y, pageHeight: page.view[3] });
            });
          }
        }
      });
    }

    // Now load with pdf-lib to draw
    const pdfDocLib = await PDFDocument.load(templateBytes);
    const pages = pdfDocLib.getPages();
    
    const formatCurrency = (val: number) => Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatNumber = (val: number) => val.toString().replace('.', ',');
    
    // Calculate derived values
    const peso_total_paineis = (dadosOrcamento.peso_painel || 0) * (dadosOrcamento.qtd_paineis || 0);
    const consumo_ano = (dadosOrcamento.consumo_mes || 0) * 12;
    const economia_mensal_rs = (dadosOrcamento.consumo_mes || 0) - (dadosOrcamento.valor_pago_mes || 0);
    const economia_anual_rs = economia_mensal_rs * 12;

    const dataMap: { [key: string]: string } = {
      '{{nome_cliente}}': dadosOrcamento.nome_cliente || '',
      '{{cidade}}': dadosOrcamento.cidade || '',
      '{{estado}}': dadosOrcamento.estado || '',
      '{{created}}': new Date(dadosOrcamento.created).toLocaleDateString('pt-BR'),
      '{{kwp_sistema}}': `${formatNumber(dadosOrcamento.kwp_sistema || 0)} kWp`,
      '{{potencia_inversor}}': `${formatNumber(dadosOrcamento.potencia_inversor || 0)} kW`,
      '{{area_estimada}}': `${formatNumber(dadosOrcamento.area_estimada || 0)} m²`,
      '{{peso_total_paineis}}': `${formatNumber(peso_total_paineis)} kg`,
      '{{quantidade_paineis}}': `${dadosOrcamento.qtd_paineis || 0}`,
      '{{quantidade_inversores}}': `${dadosOrcamento.qtd_inversores || 0}`,
      '{{consumo_mes}}': formatCurrency(dadosOrcamento.consumo_mes || 0),
      '{{consumo_ano}}': formatCurrency(consumo_ano),
      '{{valor_tarifa}}': formatCurrency(dadosOrcamento.valor_tarifa || 0),
      '{{consumo_mensal_kwh}}': `${formatNumber(dadosOrcamento.geracao_mes || 0)} kWh`,
      '{{geracao_mensal_kwh}}': `${formatNumber(dadosOrcamento.geracao_mes || 0)} kWh`,
      '{{valor_pago_mes}}': formatCurrency(dadosOrcamento.valor_pago_mes || 0),
      '{{valor_pago_ano}}': formatCurrency(dadosOrcamento.valor_pago_ano || 0),
      '{{porcentagem_reducao}}': `${formatNumber(dadosOrcamento.porcentagem_reducao || 0)}%`,
      '{{economia_mensal_rs}}': formatCurrency(economia_mensal_rs),
      '{{tempo_retorno}}': dadosOrcamento.tempo_retorno || '',
      '{{preco_final_venda}}': formatCurrency(dadosOrcamento.preco_final_venda || 0),
      '{{observacao}}': dadosOrcamento.observacao || '',
      '{{marca_modulo}}': dadosOrcamento.marca_painel || '',
      '{{garantia_inversor}}': dadosOrcamento.garantia_inversor || '',
      '{{garantia_fabrica_modulo}}': dadosOrcamento.garantia_fabrica_modulo || '',
      '{{garantia_eficiencia_modulo}}': dadosOrcamento.garantia_eficiencia_modulo || '',
      '{{garantia_instalacao}}': dadosOrcamento.garantia_instalacao || '',
      '{{composicao_1}}': dadosOrcamento.composicao_1 || '',
      '{{composicao_2}}': dadosOrcamento.composicao_2 || '',
      '{{composicao_3}}': dadosOrcamento.composicao_3 || '',
    };

    // Draw the texts
    for (const [tag, occurrences] of Object.entries(tagCoordinates)) {
      if (dataMap[tag] !== undefined) {
        occurrences.forEach(occ => {
          const page = pages[occ.pageIndex];
          
          // Converter eixo Y
          const y_render = occ.pageHeight - occ.y;
          
          page.drawText(dataMap[tag], {
            x: occ.x,
            y: y_render,
            size: 14,
            color: rgb(0, 0, 0),
          });
        });
      }
    }

    const pdfBytes = await pdfDocLib.save();
    return Buffer.from(pdfBytes);
  }
}
