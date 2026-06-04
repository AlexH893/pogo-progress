const fs = require('fs');
const path = require('path');

function getFiles(dir, ext) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file, ext));
    } else if (file.endsWith(ext)) {
      results.push(file);
    }
  });
  return results;
}

const scssFiles = getFiles('./src', '.scss');
const htmlFiles = getFiles('./src', '.html');
const tsFiles = getFiles('./src', '.ts');

const allUsageFiles = [...htmlFiles, ...tsFiles];

let unused = [];

scssFiles.forEach(scssFile => {
  const content = fs.readFileSync(scssFile, 'utf8');
  // Simple regex to find classes. We might get pseudo-classes or nested things, so we clean it up.
  const regex = /\.([a-zA-Z0-9_-]+)/g;
  let match;
  const classes = new Set();
  
  while ((match = regex.exec(content)) !== null) {
    // skip purely numeric or obviously non-class things
    if (!/^\d/.test(match[1])) {
      classes.add(match[1]);
    }
  }

  // Also look for BEM modifiers like &__foo or &--bar
  const bemRegex = /&__([a-zA-Z0-9_-]+)|&--([a-zA-Z0-9_-]+)/g;
  while ((match = bemRegex.exec(content)) !== null) {
     const suffix = match[1] || match[2];
     // We just note that this suffix exists. Full check requires AST, but we can do our best.
  }

  classes.forEach(cls => {
    let used = false;
    // For each class, check if it appears in the corresponding HTML/TS file, or globally if it's styles.scss
    const isGlobal = scssFile.endsWith('styles.scss');
    let searchFiles = isGlobal ? allUsageFiles : [
      scssFile.replace('.scss', '.html'),
      scssFile.replace('.scss', '.ts')
    ];

    for (let f of searchFiles) {
      if (!fs.existsSync(f)) continue;
      const fContent = fs.readFileSync(f, 'utf8');
      if (fContent.includes(cls)) {
        used = true;
        break;
      }
    }
    
    if (!used && !isGlobal) {
        // Double check globally just in case they passed classes through inputs
        for (let f of allUsageFiles) {
          const fContent = fs.readFileSync(f, 'utf8');
          if (fContent.includes(cls)) {
            used = true;
            break;
          }
        }
    }

    if (!used) {
      unused.push({ file: path.basename(scssFile), cls: cls });
    }
  });
});

console.log(JSON.stringify(unused, null, 2));
