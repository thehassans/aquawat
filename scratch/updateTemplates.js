const fs = require('fs');
const path = require('path');
const dir = 'frontend/src/components/invoices';
const files = fs.readdirSync(dir).filter(f => f.endsWith('Template.jsx'));

for (const file of files) {
  const fp = path.join(dir, file);
  let content = fs.readFileSync(fp, 'utf8');
  
  if (!content.includes('getUomLabel')) {
    // Add import
    content = content.replace(
      'import { calculateInvoiceSummary',
      'import { getUomLabel } from \'../../lib/uomOptions\'\nimport { calculateInvoiceSummary'
    );
    
    // Some templates use line? and some use item?
    // Let's replace exactly the known patterns
    // 1. >{line?.unitCode || line?.raw?.unitCode}<
    // 2. >{item?.unitCode || item?.raw?.unitCode}<
    content = content.replace(/>\{line\?\.unitCode \|\| line\?\.raw\?\.unitCode\}</g, '>{getUomLabel(line?.unitCode || line?.raw?.unitCode, language)}<');
    content = content.replace(/>\{item\?\.unitCode \|\| item\?\.raw\?\.unitCode\}</g, '>{getUomLabel(item?.unitCode || item?.raw?.unitCode, language)}<');
    
    fs.writeFileSync(fp, content);
    console.log('Updated', file);
  }
}
