const fs = require('fs');
const path = 'src/app/home/home.component.spec.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /expect\(component\.state\)\.toBe\('success'\);/g,
  `const postReq = httpMock.expectOne(\`\${getApiUrl()}/post-data\`);
      postReq.flush({ success: true });
      expect(component.state).toBe('success');`
);

fs.writeFileSync(path, content);
