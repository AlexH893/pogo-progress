import { TestBed } from '@angular/core/testing';
import { ProfileOcrService, InvalidScreenshotError } from './profile-ocr.service';

describe('ProfileOcrService', () => {
  let service: ProfileOcrService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProfileOcrService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('doExtractFromFile error handling', () => {
    it('should throw InvalidScreenshotError if no basic profile indicators or English labels exist', async () => {
      // Mock the image loading and processing methods to isolate the text parsing logic
      spyOn<any>(service, 'loadImage').and.returnValue(Promise.resolve({
        img: new Image(),
        url: 'blob:mock-url'
      }));
      spyOn<any>(service, 'scaleImage').and.returnValue(Promise.resolve(document.createElement('canvas')));
      spyOn<any>(service, 'cloneCanvas').and.returnValue(document.createElement('canvas'));
      spyOn<any>(service, 'binarize').and.stub();
      spyOn<any>(service, 'recognize').and.returnValue(Promise.resolve({
        text: 'Just a random selfie with my dog',
        data: { lines: [] }
      }));

      const file = new File([''], 'test.png', { type: 'image/png' });
      
      try {
        await (service as any).doExtractFromFile(file);
        fail('Should have thrown InvalidScreenshotError');
      } catch (err) {
        expect(err instanceof InvalidScreenshotError).toBeTrue();
        expect((err as any).message).toContain('This does not appear to be a Pokémon GO trainer profile screenshot');
      }
    });

    it('should throw InvalidScreenshotError indicating unsupported language if layout matches but labels are not English', async () => {
      spyOn<any>(service, 'loadImage').and.returnValue(Promise.resolve({
        img: new Image(),
        url: 'blob:mock-url'
      }));
      spyOn<any>(service, 'scaleImage').and.returnValue(Promise.resolve(document.createElement('canvas')));
      spyOn<any>(service, 'cloneCanvas').and.returnValue(document.createElement('canvas'));
      spyOn<any>(service, 'binarize').and.stub();
      
      // Provides basic indicator "LEVEL" or "XP", but no English labels like "CAUGHT" or "WALKED"
      spyOn<any>(service, 'recognize').and.returnValue(Promise.resolve({
        text: 'NIVEL 40\n1,234,567 XP', 
        data: { lines: [] }
      }));

      const file = new File([''], 'test.png', { type: 'image/png' });
      
      try {
        await (service as any).doExtractFromFile(file);
        fail('Should have thrown InvalidScreenshotError');
      } catch (err) {
        expect(err instanceof InvalidScreenshotError).toBeTrue();
        expect((err as any).message).toContain('another language or the image is too blurry');
      }
    });
  });

  describe('mergeStats', () => {
    // Access the private method for testing
    function mergeStats(
      primary: any,
      secondary: any,
    ): any {
      return (service as any).mergeStats(primary, secondary);
    }

    it('should return null when both inputs are null', () => {
      expect(mergeStats(null, null)).toBeNull();
    });

    it('should return secondary when primary is null', () => {
      const secondary = {
        level: 45,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 15000000,
        username: 'TestUser',
      };
      expect(mergeStats(null, secondary)).toEqual(secondary);
    });

    it('should return primary when secondary is null', () => {
      const primary = {
        level: 45,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 15000000,
        username: 'TestUser',
      };
      expect(mergeStats(primary, null)).toEqual(primary);
    });

    it('should fill null fields in primary from secondary', () => {
      const primary = {
        level: null,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: null,
        pokestopsVisited: 2000,
        totalXp: null,
        username: null,
      };
      const secondary = {
        level: 45,
        distanceWalked: 200,
        distanceUnit: 'mi',
        pokemonCaught: 5000,
        pokestopsVisited: 3000,
        totalXp: 15000000,
        username: 'FromSecondary',
      };

      const result = mergeStats(primary, secondary);
      expect(result.level).toBe(45);               // filled from secondary
      expect(result.distanceWalked).toBe(100);      // kept from primary
      expect(result.distanceUnit).toBe('km');        // kept from primary
      expect(result.pokemonCaught).toBe(5000);       // filled from secondary
      expect(result.pokestopsVisited).toBe(2000);    // kept from primary
      expect(result.totalXp).toBe(15000000);         // max(0, 15000000)
      expect(result.username).toBe('FromSecondary'); // secondary wins (primary is null)
    });

    it('should pick the longer username when both are present', () => {
      const primary = {
        level: 45,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 10000000,
        username: 'Stillwor',        // truncated by OCR
      };
      const secondary = {
        level: 45,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 10000000,
        username: 'Stillworld',      // full name
      };

      const result = mergeStats(primary, secondary);
      expect(result.username).toBe('Stillworld');
    });

    it('should keep primary username when it is longer or equal', () => {
      const primary = {
        level: 45,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 10000000,
        username: 'Stillworld',
      };
      const secondary = {
        level: 45,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 10000000,
        username: 'Stillwor',
      };

      const result = mergeStats(primary, secondary);
      expect(result.username).toBe('Stillworld');
    });

    it('should pick the larger totalXp from either source', () => {
      const primary = {
        level: 47,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 164816022,          // XP bar value (smaller)
        username: 'TestUser',
      };
      const secondary = {
        level: 47,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 352169022,          // Total Activity value (larger)
        username: 'TestUser',
      };

      const result = mergeStats(primary, secondary);
      expect(result.totalXp).toBe(352169022);
    });

    it('should return null for totalXp when both sources have null totalXp', () => {
      const primary = {
        level: 40,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: null,
        username: 'TestUser',
      };
      const secondary = {
        level: 40,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: null,
        username: 'TestUser',
      };

      const result = mergeStats(primary, secondary);
      // Math.max(0, 0) = 0, and then || null converts 0 to null
      expect(result.totalXp).toBeNull();
    });

    it('should use secondary totalXp when primary is null', () => {
      const primary = {
        level: 40,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: null,
        username: 'TestUser',
      };
      const secondary = {
        level: 40,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 50000000,
        username: 'TestUser',
      };

      const result = mergeStats(primary, secondary);
      expect(result.totalXp).toBe(50000000);
    });

    it('should use primary totalXp when secondary is null', () => {
      const primary = {
        level: 40,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 50000000,
        username: 'TestUser',
      };
      const secondary = {
        level: 40,
        distanceWalked: 100,
        distanceUnit: 'km',
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: null,
        username: 'TestUser',
      };

      const result = mergeStats(primary, secondary);
      expect(result.totalXp).toBe(50000000);
    });

    it('should merge two sparsely-populated results into a complete one', () => {
      const primary = {
        level: 47,
        distanceWalked: null,
        distanceUnit: null,
        pokemonCaught: null,
        pokestopsVisited: null,
        totalXp: null,
        username: 'Crosspawz',
      };
      const secondary = {
        level: null,
        distanceWalked: 8716.5,
        distanceUnit: 'km',
        pokemonCaught: 75615,
        pokestopsVisited: 31376,
        totalXp: 113442433,
        username: null,
      };

      const result = mergeStats(primary, secondary);
      expect(result).toEqual({
        level: 47,
        distanceWalked: 8716.5,
        distanceUnit: 'km',
        pokemonCaught: 75615,
        pokestopsVisited: 31376,
        totalXp: 113442433,
        username: 'Crosspawz',
      });
    });
  });

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
          text: 'TOTAL ACTIVITY\nLEVEL 40\nDISTANCE WALKED 100 km\nCAUGHT 5000\nVISITED 2000',
          data: {
            lines: [
              { text: 'TOTAL ACTIVITY', bbox: { y0: 100 } }
            ]
          }
        }),
        Promise.resolve({ text: 'LEVEL 40', data: {} }),
        Promise.resolve({ text: 'LEVEL 40', data: {} }),
        Promise.resolve({ text: 'HEADER TEXT\nTrainerName', data: {} }),
        Promise.resolve({ text: 'ACTIVITY TEXT', data: {} }),
        Promise.resolve({ text: '100 km\n5,000\n2,000\n15,000,000', data: {} }),
        Promise.resolve({ text: 'RAW TEXT\nLEVEL 40\nTrainerName', data: {} })
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
      const text = `
        100 km
        5,000
        2,000
        15,000,000
      `;
      const result = (service as any).buildActivityTextFromOrderedValues(text);
      expect(result).toContain('Distance Walked 100 km');
      expect(result).toContain('Pokemon Caught 5,000');
      expect(result).toContain('Pokestops Visited 2,000');
      expect(result).toContain('Total XP: 15,000,000');
    });

    it('should handle missing distance', () => {
      const text = `
        5,000
        2,000
        15,000,000
      `;
      const result = (service as any).buildActivityTextFromOrderedValues(text);
      expect(result).not.toContain('Distance Walked');
      expect(result).toContain('Pokemon Caught 5,000');
      expect(result).toContain('Pokestops Visited 2,000');
      expect(result).toContain('Total XP: 15,000,000');
    });
    
    it('should ignore dates or small ratios like 1/3', () => {
      const text = `
        1 / 3
        100 km
        5,000
        2,000
        15,000,000
        2024.10.15
      `;
      const result = (service as any).buildActivityTextFromOrderedValues(text);
      expect(result).toContain('Distance Walked 100 km');
      expect(result).toContain('Pokemon Caught 5,000');
      expect(result).toContain('Pokestops Visited 2,000');
      expect(result).toContain('Total XP: 15,000,000');
    });

    it('should fall back to activity array logic when fewer than 3 values', () => {
      const text = `
        100 km
        15,000,000
      `;
      const result = (service as any).buildActivityTextFromOrderedValues(text);
      expect(result).toContain('Distance Walked 100 km');
      expect(result).toContain('Total XP: 15,000,000');
    });
  });

  describe('Canvas and Image Utilities', () => {
    it('should clone a canvas correctly', () => {
      const source = document.createElement('canvas');
      source.width = 100;
      source.height = 100;
      const ctx = source.getContext('2d')!;
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 100, 100);

      const clone = (service as any).cloneCanvas(source);
      expect(clone.width).toBe(100);
      expect(clone.height).toBe(100);
      expect(clone).not.toBe(source);
    });

    it('should crop a canvas correctly', () => {
      const source = document.createElement('canvas');
      source.width = 200;
      source.height = 200;
      const clone = (service as any).cropCanvas(source, 0.25, 0.25, 0.5, 0.5);
      expect(clone.width).toBe(100);
      expect(clone.height).toBe(100);
    });

    it('should binarize a canvas without crashing', () => {
      const source = document.createElement('canvas');
      source.width = 10;
      source.height = 10;
      const ctx = source.getContext('2d')!;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, 10, 10);
      expect(() => (service as any).binarize(source)).not.toThrow();
    });

    it('should load an image from a file', async () => {
      const mockFile = new File([''], 'test.png', { type: 'image/png' });
      // Stub URL.createObjectURL since we don't have a real DOM environment with a full File API
      spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
      
      const promise = (service as any).loadImage(mockFile);
      // We can't easily wait for the img.onload event in Jasmine without a real image,
      // but we can verify it returns a promise.
      expect(promise).toBeInstanceOf(Promise);
    });
  });
});
