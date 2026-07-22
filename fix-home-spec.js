const fs = require('fs');
const path = 'src/app/home/home.component.spec.ts';
let content = fs.readFileSync(path, 'utf8');

const addCovIndex = content.indexOf("  describe('Additional Coverage', () => {");
if (addCovIndex !== -1) {
  content = content.substring(0, addCovIndex);
  
  const correctTests = `
  describe('Additional Coverage', () => {
    it('should handle dismissError', () => {
      component.state = 'error';
      component.errorMessage = 'test error';
      component.dismissError();
      expect(component.state).toBe('idle');
      expect(component.errorMessage).toBe('');
    });

    it('should handle upload error', () => {
      component.handleUploadError('bad file');
      expect(component.state).toBe('error');
      expect(component.errorMessage).toBe('bad file');
    });

    it('should toggle debug', () => {
      component.showDebug = false;
      component.toggleDebug();
      expect(component.showDebug).toBeTrue();
    });

    it('should run demo and reset demo', fakeAsync(() => {
      component.runDemo();
      tick(100);
      expect(component.demoCursorX).toBe(window.innerWidth / 2);
      tick(15000); // clear all demo timeouts
      expect(component.isDemoActive).toBeFalse();
      component.resetDemo();
      expect(component.state).toBe('idle');
    }));

    it('should format distance correctly', () => {
      expect(component.formatDistance({ distanceWalked: 100.5, distanceUnit: 'km' } as any)).toBe('100.5 km');
      expect(component.formatDistance({ distanceWalked: null } as any)).toBe('—');
    });

    it('should format count correctly', () => {
      expect(component.formatCount(1000)).toBe('1,000');
      expect(component.formatCount(null)).toBe('—');
    });
  });
});
`;
  content = content + correctTests;
  fs.writeFileSync(path, content);
} else {
  console.log("Could not find Additional Coverage block");
}
