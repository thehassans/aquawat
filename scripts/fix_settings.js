// Script to remove Company Settings tab, UOM, and Preferences from Settings.jsx
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Settings.jsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Change 1: Default tab from 'company' to 'hardware'
const defaultTabLine = lines.findIndex(l => l.includes("useState('company')") && l.includes('activeTab'));
if (defaultTabLine !== -1) {
  lines[defaultTabLine] = lines[defaultTabLine].replace("useState('company')", "useState('hardware')");
  console.log(`Changed default tab at line ${defaultTabLine + 1}`);
}

// Change 2: Find and remove the hardcoded Company Settings tab button (lines around 584-595)
// Look for the button that has onClick={() => setActiveTab('company')}
let companyBtnStart = -1;
let companyBtnEnd = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("setActiveTab('company')") && lines[i-1]?.includes('type="button"')) {
    // Walk back to find <button
    for (let j = i; j >= Math.max(0, i - 5); j--) {
      if (lines[j].trim().startsWith('<button')) {
        companyBtnStart = j;
        break;
      }
    }
    // Walk forward to find matching </button>
    for (let j = i; j < Math.min(lines.length, i + 15); j++) {
      if (lines[j].trim().startsWith('</button>')) {
        companyBtnEnd = j;
        break;
      }
    }
    break;
  }
}

if (companyBtnStart !== -1 && companyBtnEnd !== -1) {
  console.log(`Removing company tab button: lines ${companyBtnStart + 1}-${companyBtnEnd + 1}`);
  lines.splice(companyBtnStart, companyBtnEnd - companyBtnStart + 1);
}

// Change 3: Remove all three activeTab === 'company' content blocks
// We need to find each block and remove it, going from bottom to top to maintain line numbers
const blocksToRemove = [];

for (let i = lines.length - 1; i >= 0; i--) {
  const trimmed = lines[i].trim();
  if (trimmed.startsWith("{activeTab === 'company'")) {
    // Found a company block. Need to find the matching closing `)}` 
    let depth = 0;
    let blockStart = i;
    let blockEnd = -1;
    
    for (let j = i; j < lines.length; j++) {
      const line = lines[j];
      // Count opening parens/braces
      for (const ch of line) {
        if (ch === '(' || ch === '{') depth++;
        if (ch === ')' || ch === '}') depth--;
      }
      
      // When depth returns to 0, we've found the end of the block
      if (depth <= 0) {
        blockEnd = j;
        break;
      }
    }
    
    if (blockEnd !== -1) {
      blocksToRemove.push({ start: blockStart, end: blockEnd });
      console.log(`Found company block: lines ${blockStart + 1}-${blockEnd + 1}`);
    }
  }
}

// Sort blocks from bottom to top and remove them
blocksToRemove.sort((a, b) => b.start - a.start);
for (const block of blocksToRemove) {
  console.log(`Removing block: lines ${block.start + 1}-${block.end + 1} (${block.end - block.start + 1} lines)`);
  lines.splice(block.start, block.end - block.start + 1);
}

content = lines.join('\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone. File now has ${lines.length} lines.`);
