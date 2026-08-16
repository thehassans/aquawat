// Script to remove UOM and Preferences content blocks from Settings.jsx
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Settings.jsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the UOM block start
const uomStart = lines.findIndex(l => l.includes("activeTab === 'uom'"));
console.log(`UOM block starts at line ${uomStart + 1}: ${lines[uomStart].trim()}`);

// Find the preferences block end
// Search backwards from setupMachine block
const setupMachineIdx = lines.findIndex(l => l.includes("activeTab === 'setupMachine'"));
console.log(`setupMachine block starts at line ${setupMachineIdx + 1}`);

// The preferences block ends at the line before setupMachine (accounting for blank line)
// Let's find the exact end: look for `)}` before setupMachine
let prefsEnd = setupMachineIdx - 1;
while (prefsEnd > 0 && lines[prefsEnd].trim() === '') prefsEnd--;
console.log(`Preferences block ends at line ${prefsEnd + 1}: ${lines[prefsEnd].trim()}`);

// Also remove the blank line before the start
let removeStart = uomStart;
while (removeStart > 0 && lines[removeStart - 1].trim() === '') removeStart--;

console.log(`Removing lines ${removeStart + 1} to ${prefsEnd + 1}`);

// Remove the lines
lines.splice(removeStart, prefsEnd - removeStart + 1);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log(`Done. File now has ${lines.length} lines.`);
