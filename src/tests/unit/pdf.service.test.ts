import { describe, it, expect } from 'vitest';
import { PdfService } from '../../services/pdf.service';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

describe('PdfService', () => {
  it('should verify that the PDF template exists and has the required form fields', async () => {
    const templatePath = path.resolve(__dirname, '../../assets/templates/proposta_sofia_template.pdf');
    
    // Verifica se o arquivo template existe (fs.readFile lançará erro se não existir)
    const templateBytes = await fs.readFile(templatePath);
    expect(templateBytes.length).toBeGreaterThan(0);
    
    // Verifica se conseguimos carregar e se é um formulário AcroForm com campos
    const pdfDocLib = await PDFDocument.load(templateBytes);
    const form = pdfDocLib.getForm();
    const fields = form.getFields();
    
    // Esperamos ter um mínimo de campos já conhecidos
    expect(fields.length).toBeGreaterThan(10);
    
    // Vamos checar alguns dos campos principais para garantir que não mudaram de nome
    const requiredFields = [
      'nome_cliente', 
      'cidade_estado', 
      'kwp_sistema1', 
      'potencia_inversor'
    ];

    const fieldNames = fields.map(f => f.getName());
    
    requiredFields.forEach(requiredField => {
      // O AcroForm TextField internamente vai ter esse nome
      expect(fieldNames).toContain(requiredField);
    });
  });
  
  it('should generate a valid PDF buffer without errors', async () => {
    // Dados de teste (mock)
    const mockDadosOrcamento = {
      nome_cliente: 'Cliente Teste',
      cidade: 'São Paulo',
      estado: 'São Paulo',
      created: new Date().toISOString(),
      kwp_sistema: 10,
      potencia_inversor: 8,
      area_estimada: 50,
      qtd_paineis: 20,
      qtd_inversores: 1,
      consumo_mes: 500,
      valor_tarifa: 0.95,
      geracao_mes: 550,
      valor_pago_mes: 475,
      porcentagem_reducao: 0.95,
      preco_final_venda: 30000,
      observacao: 'Observação de teste'
    };

    const pdfBuffer = await PdfService.gerarPdfProposta(mockDadosOrcamento);
    
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });
});
