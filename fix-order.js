const fs = require('fs');
const path = 'src/app/home/home.component.spec.ts';
let content = fs.readFileSync(path, 'utf8');

// We want to console.log the state to see what went wrong.
content = content.replace(
  /const prefReq = httpMock\.expectOne\(\`\$\\{getApiUrl\(\)\}\/user-preferences\`\);/g,
  `console.log('COMPONENT STATE IS:', component.state, 'ERROR:', component.errorMessage);
      const prefReq = httpMock.expectOne(\`\${getApiUrl()}/user-preferences\`);`
);

fs.writeFileSync(path, content);
