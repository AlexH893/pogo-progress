import { HomeComponent } from './home.component';
import { NgZone, ChangeDetectorRef } from '@angular/core';
import { ProfileStats } from '../models/profile-stats';
import { ProfileOcrService } from '../services/profile-ocr.service';
import { FunFactService } from '../services/fun-fact.service';
import { AuthService } from '../services/auth.service';

// ---------------------------------------------------------------------------
// Minimal stubs so we can instantiate HomeComponent in pure-unit style
// without a full Angular TestBed setup (avoids heavy OCR/HTTP deps).
// ---------------------------------------------------------------------------
function createComponent(): HomeComponent {
  const http = jasmine.createSpyObj('HttpClient', ['get', 'post', 'put']);
  const ngZone: NgZone = {
    run: (fn: () => void) => fn(),
    runOutsideAngular: (fn: () => void) => fn(),
  } as unknown as NgZone;
  const cdr = { detectChanges: jasmine.createSpy() } as unknown as ChangeDetectorRef;

  const ocrService = { extractFromFile: jasmine.createSpy() } as unknown as ProfileOcrService;
  const funFactService = { generateFacts: jasmine.createSpy().and.returnValue([]) } as unknown as FunFactService;
  const authService = {
    user$: { subscribe: jasmine.createSpy().and.returnValue({ unsubscribe() {} }) },
    getToken: jasmine.createSpy().and.returnValue('fake-token'),
  } as unknown as AuthService;

  return new HomeComponent(ocrService, http as any, ngZone, cdr, funFactService, authService);
}

// Helper: set up minimal HomeComponent state so calculateDiffs() can run.
function setupState(c: HomeComponent, currentStardust: number, prevStardust: number) {
  const stats: ProfileStats = {
    level: 40,
    distanceWalked: 1000,
    distanceUnit: 'km',
    pokemonCaught: 5000,
    pokestopsVisited: 3000,
    totalXp: 10_000_000,
    stardust: currentStardust,
    username: 'TestTrainer',
  };
  c.stats = stats;
  c.displayStats = { ...stats };
  c.isStardustOnlyUpload = false;
  c.currentStatId = 99;
  c.screenshotDate = new Date('2024-06-01T12:00:00Z');
  c.previousStats = {
    level: 40,
    distance_walked: 900,
    caught: 4800,
    stop_visited: 2800,
    total_xp: 9_000_000,
    stardust: prevStardust,
    created_at: '2024-05-01T12:00:00Z',
  };
  c.userHistory = [];
}

// ---------------------------------------------------------------------------
// Bug #7 — stardust >= 10M overcorrection in calculateDiffs
//
// The OLD code: if (rawVal != null && rawVal >= 10_000_000) rawVal -= 10_000_000;
// This corrupted the previous-stardust used for diffs for ANY player with >=10M.
//
// The FIX:       if (rawVal >= 10_000_000 && rawVal < 20_000_000) rawVal -= 10_000_000;
// Only the genuine OCR artifact range (10M–19.9M) is corrected.
// ---------------------------------------------------------------------------
describe('HomeComponent — Bug #7: stardust leading-1 OCR artifact overcorrection', () => {
  let c: HomeComponent;

  beforeEach(() => { c = createComponent(); });

  // -------------------------------------------------------------------------
  // REGRESSION tests — these would have FAILED before the fix
  // -------------------------------------------------------------------------

  it('should NOT subtract 10M from a legitimate previousStardust of 25M', () => {
    setupState(c, 26_000_000, 25_000_000);
    c.calculateDiffs(false);
    // Expected diff: 26M - 25M = +1_000_000
    // Old (broken) diff: 26M - 15M = +11_000_000
    expect(c.statDiffs).toBeTruthy();
    expect(c.statDiffs!.stardust).toBe(1_000_000);
  });

  it('should NOT subtract 10M from a legitimate previousStardust of 50M', () => {
    setupState(c, 51_000_000, 50_000_000);
    c.calculateDiffs(false);
    expect(c.statDiffs!.stardust).toBe(1_000_000);
  });

  it('should NOT subtract 10M from a previousStardust of exactly 20M (boundary)', () => {
    // 20M is the exact boundary — it is a valid stardust amount, NOT an artifact
    setupState(c, 21_000_000, 20_000_000);
    c.calculateDiffs(false);
    expect(c.statDiffs!.stardust).toBe(1_000_000);
  });

  // -------------------------------------------------------------------------
  // CORRECTNESS tests — artifact values in [10M, 20M) should still be fixed
  // -------------------------------------------------------------------------

  it('should still correct a real OCR leading-1 artifact: 15_343_876 -> 5_343_876', () => {
    // A "1" icon was misread as a digit, so 5_343_876 was stored as 15_343_876.
    // The corrected prevStardust = 15_343_876 - 10_000_000 = 5_343_876.
    // Diff = 6_000_000 - 5_343_876 = 656_124.
    setupState(c, 6_000_000, 15_343_876);
    c.calculateDiffs(false);
    expect(c.statDiffs!.stardust).toBe(656_124);
  });

  it('should correct a prevStardust of 10_000_001 (just above the artifact floor)', () => {
    setupState(c, 1_020_000, 10_050_000);
    c.calculateDiffs(false);
    // corrected prev = 50_000; diff = 1_020_000 - 50_000 = 970_000 (within 1M threshold)
    expect(c.statDiffs!.stardust).toBe(970_000);
  });

  it('should NOT correct a prevStardust of 19_999_999 (top of artifact range)', () => {
    // 19_999_999 IS in the artifact range — should still be corrected to 9_999_999
    setupState(c, 10_500_000, 19_999_999);
    c.calculateDiffs(false);
    // corrected prev = 9_999_999; diff = 10_500_000 - 9_999_999 = 500_001
    expect(c.statDiffs!.stardust).toBe(500_001);
  });
});
