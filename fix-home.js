const fs = require('fs');
const path = 'src/app/home/home.component.spec.ts';
let content = fs.readFileSync(path, 'utf8');

const newTests = `
  describe('Formatting Utilities', () => {
    it('should format distance correctly', () => {
      expect(component.formatDistance({ distanceWalked: 123.456, distanceUnit: 'km' } as any)).toBe('123.5 km');
      expect(component.formatDistance({ distanceWalked: 123.4, distanceUnit: 'mi' } as any)).toBe('123.4 mi');
      expect(component.formatDistance({ distanceWalked: null } as any)).toBe('—');
    });

    it('should format count correctly', () => {
      expect(component.formatCount(123456)).toBe('123,456');
      expect(component.formatCount(null)).toBe('—');
    });

    it('should format diffs correctly', () => {
      expect(component.formatDiffCount(100)).toBe('+100');
      expect(component.formatDiffCount(-50)).toBe('-50');
      expect(component.formatDiffCount(0)).toBe('');
      
      expect(component.formatDiffDistance(1.23)).toBe('+1.2');
      expect(component.formatDiffDistance(-1.23)).toBe('-1.2');
      expect(component.formatDiffDistance(0)).toBe('');
    });
  });

  describe('processFile success path', () => {
    let mockOcrService: jasmine.SpyObj<any>;

    beforeEach(() => {
      mockOcrService = TestBed.inject(ProfileOcrService) as any;
    });

    it('should handle a successful file extraction and load preferences', async () => {
      const mockFile = new File([''], 'test.png', { type: 'image/png', lastModified: new Date('2024-01-01').getTime() });
      const stats = { username: 'Trainer123', level: 40 };
      mockOcrService.extractFromFile.and.returnValue(Promise.resolve({ stats, rawText: 'text' }));
      spyOn(component.authService, 'getToken').and.returnValue('mock-token');
      
      // We don't await because processFile uses view transitions, so we just run it and let it finish.
      // But we can await it if we mock startViewTransition.
      document.startViewTransition = jasmine.createSpy('startViewTransition').and.callFake((cb: any) => cb());
      
      const reqPromise = component.processFile(mockFile);
      
      // Wait for extractFromFile to resolve
      await new Promise(r => setTimeout(r, 0));
      
      // Should fetch preferences
      const prefReq = httpMock.expectOne(\`\${getApiUrl()}/user-preferences\`);
      prefReq.flush([{ username: 'Trainer123', default_unit: 'km', show_fun_facts: true, display_tutorial: true }]);
      
      await reqPromise;
      
      expect(component.state).toBe('success');
      expect(component.username).toBe('Trainer123');
      expect(component.stats).toEqual(jasmine.objectContaining({ level: 40 }));
      expect(component.showFunFactsEnabled).toBeTrue();
    });
    
    it('should detect a mismatched username and ask for confirmation', async () => {
      const mockFile = new File([''], 'test.png', { type: 'image/png' });
      const stats = { username: 'OcrTypoName', level: 40 };
      mockOcrService.extractFromFile.and.returnValue(Promise.resolve({ stats, rawText: 'text' }));
      spyOn(component.authService, 'getToken').and.returnValue('mock-token');
      
      document.startViewTransition = jasmine.createSpy('startViewTransition').and.callFake((cb: any) => cb());
      
      const reqPromise = component.processFile(mockFile);
      
      await new Promise(r => setTimeout(r, 0));
      
      const prefReq = httpMock.expectOne(\`\${getApiUrl()}/user-preferences\`);
      // User is linked to "Trainer123", but OCR returned "OcrTypoName"
      prefReq.flush([{ username: 'Trainer123', default_unit: 'km', show_fun_facts: true }]);
      
      await reqPromise;
      
      expect(component.usernameMismatch).toBeTrue();
      expect(component.ocrUsername).toBe('OcrTypoName');
      expect(component.editingFields.username).toBeTrue();
      // Should NOT post stats automatically if mismatched
      httpMock.expectNone(\`\${getApiUrl()}/post-data\`);
    });
  });
`;

content = content.replace(/}\);\s*$/, newTests + '});\n');
fs.writeFileSync(path, content);
