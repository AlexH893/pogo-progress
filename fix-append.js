const fs = require('fs');
const path = 'src/app/home/home.component.spec.ts';
let content = fs.readFileSync(path, 'utf8');

// Find the Additional Coverage block and remove it
const addCovIndex = content.indexOf("describe('Additional Coverage', () => {");
if (addCovIndex !== -1) {
  const addCovBlock = content.substring(addCovIndex);
  content = content.substring(0, addCovIndex);
  
  // Insert it before the last '});'
  const lastBracketIndex = content.lastIndexOf('});');
  content = content.substring(0, lastBracketIndex) + addCovBlock + '\n});\n';
}

fs.writeFileSync(path, content);
