import exifr from 'exifr';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProfileOcrService, ProfileOcrParseError, InvalidScreenshotError, OcrTimeoutError } from '../services/profile-ocr.service';
import { HomeComponent } from './home.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { getApiUrl } from '../config';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let httpMock: HttpTestingController;

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
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
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

  // ─── Bug 5: 403 from postStatsToBackend surfaces to the user ──────────────
  describe('Bug 5: postStatsToBackend 403 is surfaced to the user', () => {
    beforeEach(() => {
      // Minimal stats required by postStatsToBackend
      component.stats = {
        level: 40,
        distanceWalked: 100,
        pokemonCaught: 5000,
        pokestopsVisited: 2000,
        totalXp: 15000000,
        username: 'OtherTrainer',
        distanceUnit: 'km',
        entryName: ''
      };
      component.username = 'OtherTrainer';
      // Put the component into "success" state to prove it gets reverted
      component.state = 'success';
    });

    it('should set state to error and display the backend message on a 403', () => {
      component.postStatsToBackend();

      const req = httpMock.expectOne(`${getApiUrl()}/post-data`);
      req.flush(
        { error: 'You can only link one trainer to your account.' },
        { status: 403, statusText: 'Forbidden' }
      );

      expect(component.state).toBe('error');
      expect(component.errorMessage).toContain('trainer');
    });

    it('should use a fallback error message when the backend body is empty on 403', () => {
      component.postStatsToBackend();

      const req = httpMock.expectOne(`${getApiUrl()}/post-data`);
      req.flush(null, { status: 403, statusText: 'Forbidden' });

      expect(component.state).toBe('error');
      expect(component.errorMessage).toBeTruthy();
    });

    it('should NOT change state to error on a non-403 failure', () => {
      component.postStatsToBackend();

      const req = httpMock.expectOne(`${getApiUrl()}/post-data`);
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

      // After patch, we DO change state to error for non-403s!
      expect(component.state).toBe('error');
      expect(component.errorMessage).toBe('Network error: Failed to save stats. Please check your connection and try again.');
      expect(component.isPostingStats).toBeFalse();
    });
  });

  describe('submitCorrection patches', () => {
    beforeEach(() => {
      component.stats = {
        level: 40, distanceWalked: 100, pokemonCaught: 5000,
        pokestopsVisited: 2000, totalXp: 15000, username: 'Trainer',
        distanceUnit: 'km', entryName: ''
      };
      component.username = 'Trainer';
      component.state = 'success';
    });

    it('Bug 2: should queue correction if isPostingStats is true', () => {
      component.isPostingStats = true;
      spyOn(window, 'setTimeout');
      
      component.submitCorrection('level', '41');
      
      expect(window.setTimeout).toHaveBeenCalled();
      // Ensure HTTP was not called yet
      httpMock.expectNone(`${getApiUrl()}/post-data`);
    });

    it('Bug 4: should block other edits if usernameMismatch is true', () => {
      component.usernameMismatch = true;
      component.editingFields.level = true;
      
      component.submitCorrection('level', '41');
      
      expect(component.errorMessage).toBe('Please confirm your trainer name before saving other corrections.');
      expect(component.editingFields.level).toBeFalse();
      httpMock.expectNone(`${getApiUrl()}/post-data`);
    });

    it('Bug 6: should notify guest users that edits are not saved', () => {
      // simulate guest
      spyOn(component.authService, 'getToken').and.returnValue(null);
      
      component.submitCorrection('level', '41');
      
      expect(component.errorMessage).toBe('Please sign in to save your corrections.');
      httpMock.expectNone(`${getApiUrl()}/post-data`);
    });

    it('Bug 3: should display network error message on generic API failure', () => {
      spyOn(component.authService, 'getToken').and.returnValue('mock-token');
      component.currentStatId = 123; // use PUT
      
      component.submitCorrection('level', '41');
      
      const req = httpMock.expectOne(`${getApiUrl()}/update-data/123`);
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Server Error' });
      
      expect(component.errorMessage).toBe('Network error: Failed to save correction. Please try again.');
    });
  });

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

    it('should handle a successful file extraction and load preferences', fakeAsync(() => {

      const mockFile = new File([''], 'test.png', { type: 'image/png', lastModified: new Date('2024-01-01').getTime() });
      const stats = { username: 'Trainer123', level: 40 };
      mockOcrService.extractFromFile.and.returnValue(Promise.resolve({ stats, rawText: 'text' }));
      spyOn(component.authService, 'getToken').and.returnValue('mock-token');
      
      // We don't await because processFile uses view transitions, so we just run it and let it finish.
      // But we can await it if we mock startViewTransition.
      (document as any).startViewTransition = jasmine.createSpy('startViewTransition').and.callFake((cb: any) => cb());
      
      component.processFile(mockFile);
      
      tick(100);
      
      const prefReq = httpMock.expectOne(`${getApiUrl()}/user-preferences`);
      prefReq.flush([{ username: 'Trainer123', default_unit: 'km', show_fun_facts: true, display_tutorial: true }]);
      
      tick();
      
      const postReq = httpMock.expectOne(`${getApiUrl()}/post-data`);
      postReq.flush({ success: true });
      
      const statsReq = httpMock.expectOne(`${getApiUrl()}/get-user-stats/Trainer123`);
      statsReq.flush([{ level: 39 }]);
      expect(component.state).toBe('success');
      expect(component.username).toBe('Trainer123');
      expect(component.stats).toEqual(jasmine.objectContaining({ level: 40 }));
      expect(component.showFunFactsEnabled).toBeTrue();
    }));
    
    it('should detect a mismatched username and ask for confirmation', fakeAsync(() => {
      
      const mockFile = new File([''], 'test.png', { type: 'image/png' });
      const stats = { username: 'OcrTypoName', level: 40 };
      mockOcrService.extractFromFile.and.returnValue(Promise.resolve({ stats, rawText: 'text' }));
      spyOn(component.authService, 'getToken').and.returnValue('mock-token');
      
      (document as any).startViewTransition = jasmine.createSpy('startViewTransition').and.callFake((cb: any) => cb());
      
      component.processFile(mockFile);
tick(100);
      
      const prefReq = httpMock.expectOne(`${getApiUrl()}/user-preferences`);
      // User is linked to "Trainer123", but OCR returned "OcrTypoName"
      prefReq.flush([{ username: 'Trainer123', default_unit: 'km', show_fun_facts: true }]);
      
      tick();
      
      expect(component.usernameMismatch).toBeTrue();
      expect(component.ocrUsername).toBe('OcrTypoName');
      expect(component.editingFields.username).toBeTrue();
      // Should NOT post stats automatically if mismatched
      httpMock.expectNone(`${getApiUrl()}/post-data`);
    }));

    it('should throw error when uploading a Stardust-only screenshot without a linked trainer', fakeAsync(() => {
      const mockFile = new File([''], 'stardust.png', { type: 'image/png' });
      const stats = { level: null, distanceWalked: null, totalXp: null, stardust: 5163855 };
      mockOcrService.extractFromFile.and.returnValue(Promise.resolve({ stats, rawText: 'text' }));
      
      component.processFile(mockFile);
      tick(100);
      
      expect(component.state).toBe('error');
      expect(component.errorMessage).toContain('Please upload a Trainer Profile screenshot first');
    }));
  });
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

    it('should handle processFile with profile-ocr failing', fakeAsync(() => {
      const mockFile = new File([''], 'test.png', { type: 'image/png' });
      const ocrService = TestBed.inject(ProfileOcrService) as any;
      ocrService.extractFromFile.and.returnValue(Promise.reject(new Error('OCR Failed')));
      
      component.processFile(mockFile);
      tick(100);
      
      expect(component.state).toBe('error');
      expect(component.errorMessage).toContain('OCR Failed');
    }));

    it('should handle submitCorrection for fields', () => {
      component.stats = { level: 40, distanceWalked: 100 } as any;
      component.username = 'OldName';
      
      component.submitCorrection('distanceWalked', '200.5');
      expect(component.stats!.distanceWalked).toBe(200.5);

      component.usernameMismatch = true;
      component.submitCorrection('username', 'FixedName');
      expect(component.stats?.username).toBe('FixedName');
      expect(component.username).toBe('FixedName');
      expect(component.usernameMismatch).toBeFalse();

      component.submitCorrection('level', '45');
      expect(component.stats?.level).toBe(45);
    });
  });
});
