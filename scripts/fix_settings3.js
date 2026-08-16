// Script to remove the orphaned company settings content from Settings.jsx
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Settings.jsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`File has ${lines.length} lines`);

// The orphaned content starts at line 602 (0-indexed: 601)
// and ends just before {activeTab === 'setupMachine'} or {activeTab === 'hardware'}
// Find the first activeTab block after line 602
let endLine = -1;
for (let i = 602; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  if (trimmed.startsWith("{activeTab ===")) {
    endLine = i;
    break;
  }
}

console.log(`Orphaned content: lines 602 to ${endLine}`);

// Also account for blank line before the activeTab block
while (endLine > 0 && lines[endLine - 1].trim() === '') endLine--;

console.log(`Removing lines 602 to ${endLine} (${endLine - 601} lines)`);

// Remove the orphaned lines (0-indexed: 601 to endLine-1)
lines.splice(601, endLine - 601);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log(`Done. File now has ${lines.length} lines.`);
