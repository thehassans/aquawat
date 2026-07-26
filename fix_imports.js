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
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(
    "import React\nimport DocumentExtras from './DocumentExtras' from 'react'",
    "import React from 'react'\nimport DocumentExtras from './DocumentExtras'"
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${file}`);
});
