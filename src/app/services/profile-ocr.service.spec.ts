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
});
