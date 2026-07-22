const fs = require('fs');
const path = 'src/app/home/home.component.spec.ts';
let content = fs.readFileSync(path, 'utf8');

// We can replace the expectOne to match ANY request to see what's pending
content = content.replace(
  /const prefReq = httpMock\.expectOne\(`\$\\{getApiUrl\(\)\}\/user-preferences`\);/g,
  `httpMock.verify(); // to clear any pending
      const prefReq = httpMock.expectOne(\`\${getApiUrl()}/user-preferences\`);`
);

fs.writeFileSync(path, content);
