const fs = require('fs/promises');
const path = require('path');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

async function testPdfParse() {
  try {
    const templatePath = path.resolve(__dirname, 'src/assets/templates/proposta_sofia_template.pdf.pdf');
    const templateBytes = await fs.readFile(templatePath);
    
    // Read with pdfjs-dist
    const data = new Uint8Array(templateBytes);
    const loadingTask = pdfjs.getDocument({ data });
    const pdfDocument = await loadingTask.promise;
    
    console.log(`Document loaded with ${pdfDocument.numPages} pages.`);
    
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      
      const tags = textContent.items.filter(item => item.str && item.str.includes('{{'));
      if (tags.length > 0) {
        console.log(`Page ${i} found tags:`);
        tags.forEach(t => {
           console.log(`- '${t.str}' at X=${t.transform[4]}, Y=${t.transform[5]}`);
        });
      }
    }
  } catch(e) {
    console.error(e);
  }
}
testPdfParse();
