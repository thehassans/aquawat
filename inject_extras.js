const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/kjh/Desktop/maqder/frontend/src/components/invoices/';
const templates = [
  'ClassicElegantTemplate.jsx',
  'ModernSplitTemplate.jsx',
  'ModernTemplate.jsx',
  'ModernZatcaTemplate.jsx',
  'AirTemplate.jsx',
  'LedgerTemplate.jsx',
  'SignatureTemplate.jsx'
];

templates.forEach(file => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('DocumentExtras')) {
    content = content.replace("import React", "import React\nimport DocumentExtras from './DocumentExtras'");
    
    // Find the last </div> before ) }
    content = content.replace(/<\/div>\s*\)\s*}\s*$/, '\n      <DocumentExtras invoice={invoice} language={language} bilingual={bilingual} />\n    </div>\n  )\n}\n');
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  } else {
    console.log(`Skipped ${file} (already updated)`);
  }
});
