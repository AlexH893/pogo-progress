const fs = require('fs');
const path = 'src/app/services/profile-ocr.service.spec.ts';
let content = fs.readFileSync(path, 'utf8');

// The appended code was at the very end of the file.
// We need to remove it and insert it before the last `});`.
// First, let's find the first instance of "  describe('doExtractFromFile success', () => {"
// and remove everything from there to the end.
const appendedStart = content.indexOf("  describe('doExtractFromFile success'");
if (appendedStart !== -1) {
  content = content.substring(0, appendedStart);
}

const newTests = `
  describe('doExtractFromFile success', () => {
    it('should extract stats successfully on a valid profile screenshot', async () => {
      spyOn<any>(service, 'loadImage').and.returnValue(Promise.resolve({
        img: new Image(),
        url: 'blob:mock-url'
      }));
      spyOn<any>(service, 'scaleImage').and.returnValue(Promise.resolve(document.createElement('canvas')));
      spyOn<any>(service, 'cloneCanvas').and.returnValue(document.createElement('canvas'));
      spyOn<any>(service, 'cropCanvas').and.returnValue(document.createElement('canvas'));
      spyOn<any>(service, 'binarize').and.stub();
      
      const recognizeSpy = spyOn<any>(service, 'recognize');
      
      recognizeSpy.and.returnValues(
        Promise.resolve({
          text: 'TOTAL ACTIVITY\\nLEVEL 40\\nDISTANCE WALKED 100 km\\nCAUGHT 5000\\nVISITED 2000',
          data: {
            lines: [
              { text: 'TOTAL ACTIVITY', bbox: { y0: 100 } }
            ]
          }
        }),
        Promise.resolve({ text: 'HEADER TEXT\\nTrainerName', data: {} }),
        Promise.resolve({ text: 'ACTIVITY TEXT', data: {} }),
        Promise.resolve({ text: '100 km\\n5,000\\n2,000\\n15,000,000', data: {} }),
        Promise.resolve({ text: 'RAW TEXT\\nLEVEL 40\\nTrainerName', data: {} })
      );
      
      const file = new File([''], 'test.png', { type: 'image/png' });
      const result = await (service as any).doExtractFromFile(file);
      
      expect(result.stats).toBeTruthy();
      expect(result.stats.level).toBe(40);
      expect(result.stats.pokemonCaught).toBe(5000);
      expect(result.stats.totalXp).toBe(15000000);
    });
  });

  describe('buildActivityTextFromOrderedValues', () => {
    it('should parse cleanly ordered numbers into distance, caught, visited, and xp', () => {
      const text = \`
        100 km
        5,000
        2,000
        15,000,000
      \`;
      const result = (service as any).buildActivityTextFromOrderedValues(text);
      expect(result).toContain('Distance Walked 100 km');
      expect(result).toContain('Pokemon Caught 5,000');
      expect(result).toContain('Pokestops Visited 2,000');
      expect(result).toContain('Total XP: 15,000,000');
    });

    it('should handle missing distance', () => {
      const text = \`
        5,000
        2,000
        15,000,000
      \`;
      const result = (service as any).buildActivityTextFromOrderedValues(text);
      expect(result).not.toContain('Distance Walked');
      expect(result).toContain('Pokemon Caught 5,000');
      expect(result).toContain('Pokestops Visited 2,000');
      expect(result).toContain('Total XP: 15,000,000');
    });
    
    it('should ignore dates or small ratios like 1/3', () => {
      const text = \`
        1 / 3
        100 km
        5,000
        2,000
        15,000,000
        2024.10.15
      \`;
      const result = (service as any).buildActivityTextFromOrderedValues(text);
      expect(result).toContain('Distance Walked 100 km');
      expect(result).toContain('Pokemon Caught 5,000');
      expect(result).toContain('Pokestops Visited 2,000');
      expect(result).toContain('Total XP: 15,000,000');
    });
  });
`;

content = content.replace(/}\);\s*$/, newTests + '});\n');
fs.writeFileSync(path, content);
