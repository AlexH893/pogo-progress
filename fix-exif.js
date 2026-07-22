const fs = require('fs');
const path = 'src/app/home/home.component.spec.ts';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes("import exifr")) {
  content = "import exifr from 'exifr';\n" + content;
}

content = content.replace(
  /const mockFile = new File\(\[''\], 'test\.png'/g,
  `spyOn(exifr, 'parse').and.returnValue(Promise.resolve({}));
      const mockFile = new File([''], 'test.png'`
);

fs.writeFileSync(path, content);
