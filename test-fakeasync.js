const fs = require('fs');
const path = 'src/app/home/home.component.spec.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /it\('should handle a successful file extraction and load preferences', async \(\) => {/g,
  `it('should handle a successful file extraction and load preferences', fakeAsync(() => {`
);
content = content.replace(
  /it\('should detect a mismatched username and ask for confirmation', async \(\) => {/g,
  `it('should detect a mismatched username and ask for confirmation', fakeAsync(() => {`
);

content = content.replace(
  /const reqPromise = component\.processFile\(mockFile\);\s*await new Promise\(r => setTimeout\(r, 0\)\);/g,
  `component.processFile(mockFile);\ntick(100);`
);

content = content.replace(
  /await reqPromise;/g,
  `tick();`
);

fs.writeFileSync(path, content);
