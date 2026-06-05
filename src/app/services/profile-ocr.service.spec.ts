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
});
