const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/kjh/Desktop/maqder/frontend/src/components/invoices';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace line?.raw?.unitCode
  content = content.replace(/\{line\?\.raw\?\.unitCode &&/g, '{(line?.unitCode || line?.raw?.unitCode) &&');
  content = content.replace(/\{line\.raw\.unitCode\}/g, '{line?.unitCode || line?.raw?.unitCode}');

  // Replace item.raw?.unitCode
  content = content.replace(/\{item\.raw\?\.unitCode &&/g, '{(item?.unitCode || item?.raw?.unitCode) &&');
  content = content.replace(/\{item\.raw\.unitCode\}/g, '{item?.unitCode || item?.raw?.unitCode}');

  fs.writeFileSync(filePath, content);
});
console.log('Fixed unitCode in all invoice templates');
