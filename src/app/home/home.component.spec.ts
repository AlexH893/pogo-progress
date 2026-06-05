import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ProfileOcrService, ProfileOcrParseError, InvalidScreenshotError, OcrTimeoutError } from '../services/profile-ocr.service';
import { HomeComponent } from './home.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [HomeComponent],
      providers: [
        {
          provide: ProfileOcrService,
          useValue: { extractFromFile: jasmine.createSpy('extractFromFile') },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('calculateDiffs', () => {
    it('should calculate differences correctly when stats and previousStats are present', () => {
      component.stats = {
        level: 40,
        distanceWalked: 100.5,
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 15000000,
        username: 'TestUser',
        distanceUnit: 'km'
      };
      
      component.previousStats = {
        level: 39,
        distance_walked: 90.0,
        caught: 4900,
        stop_visited: 1950,
        total_xp: 14000000
      };

      // Mock startAnimations since calculateDiffs calls it internally
      spyOn(component, 'startAnimations');

      component.calculateDiffs();

      expect(component.statDiffs).toEqual({
        level: 1,
        distanceWalked: 10.5,
        pokemonCaught: 100,
        pokestopsVisited: 50,
        totalXp: 1000000
      });
      expect(component.startAnimations).toHaveBeenCalled();
    });

    it('should set statDiffs to null if no differences exist', () => {
      component.stats = {
        level: 40,
        distanceWalked: 100,
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 15000000,
        username: 'TestUser',
        distanceUnit: 'km'
      };
      
      component.previousStats = {
        level: 40,
        distance_walked: 100,
        caught: 5000,
        stop_visited: 2000,
        total_xp: 15000000
      };

      spyOn(component, 'startAnimations');

      component.calculateDiffs();

      expect(component.statDiffs).toBeNull();
      expect(component.startAnimations).not.toHaveBeenCalled();
    });

    it('should set statDiffs to null if stats or previousStats is missing', () => {
      component.stats = null;
      component.previousStats = { level: 40 };

      component.calculateDiffs();
      expect(component.statDiffs).toBeNull();

      component.stats = { level: 40 } as any;
      component.previousStats = null;

      component.calculateDiffs();
      expect(component.statDiffs).toBeNull();
    });
  });

  describe('processFile error handling', () => {
    let mockOcrService: jasmine.SpyObj<ProfileOcrService>;

    beforeEach(() => {
      mockOcrService = TestBed.inject(ProfileOcrService) as jasmine.SpyObj<ProfileOcrService>;
    });

    it('should handle ProfileOcrParseError', async () => {
      const error = new ProfileOcrParseError('Parse error', 'raw test');
      mockOcrService.extractFromFile.and.rejectWith(error);

      const file = new File([''], 'test.png', { type: 'image/png' });
      await component.processFile(file);

      expect(component.state).toBe('error');
      expect(component.errorMessage).toBe('Parse error');
      expect(component.rawOcrText).toBe('raw test');
    });

    it('should handle InvalidScreenshotError', async () => {
      const error = new InvalidScreenshotError('Invalid screenshot', 'raw test invalid');
      mockOcrService.extractFromFile.and.rejectWith(error);

      const file = new File([''], 'test.png', { type: 'image/png' });
      await component.processFile(file);

      expect(component.state).toBe('error');
      expect(component.errorMessage).toBe('Invalid screenshot');
      expect(component.rawOcrText).toBe('raw test invalid');
    });

    it('should handle OcrTimeoutError', async () => {
      const error = new OcrTimeoutError('Timeout');
      mockOcrService.extractFromFile.and.rejectWith(error);

      const file = new File([''], 'test.png', { type: 'image/png' });
      await component.processFile(file);

      expect(component.state).toBe('error');
      expect(component.errorMessage).toBe('Timeout');
      expect(component.rawOcrText).toBe(''); // shouldn't set rawOcrText for timeout
    });
  });
});
