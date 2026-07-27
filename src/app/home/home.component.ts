import { HttpClient } from '@angular/common/http';
import { Component, NgZone, ChangeDetectorRef, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import Chart from 'chart.js/auto';
import { ProfileStats } from '../models/profile-stats';
import {
  ProfileOcrParseError,
  InvalidScreenshotError,
  OcrTimeoutError,
  ProfileOcrService,
} from '../services/profile-ocr.service';
import { FunFactService } from '../services/fun-fact.service';
import { getApiUrl } from '../config';
import { AuthService } from '../services/auth.service';
import exifr from 'exifr';
import { levenshtein } from '../utils/levenshtein';
import { isPokemonDetailScreen } from '../utils/profile-stats.parser';

type PageState = 'idle' | 'processing' | 'success' | 'error';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, OnDestroy {
  state: PageState = 'idle';
  previewUrl: string | null = null;
  username: string = '';
  knownTrainerName: string | null = null;
  /** True when OCR detected a username that differs by >1 edit from the linked trainer name. */
  usernameMismatch: boolean = false;
  /** The raw username OCR read, preserved so the warning can show it. */
  ocrUsername: string = '';
  stats: ProfileStats | null = null;
  displayStats: ProfileStats | null = null;
  isAnimating = false;
  isPostingStats = false;

  errorMessage = '';
  rawOcrText = '';
  showDebug = false;

  userHistory: any[] = [];

  currentStatId: number | null = null;
  previousStats: any = null;
  statDiffs: any = null;
  dailyAverages: any = null;
  diffDays: number = 0;

  funFact: string | null = null;
  allFunFacts: string[] = [];
  showFunFactsEnabled: boolean = true;
  displayTutorialEnabled: boolean = true;

  screenshotDate: Date | null = null;
  usedFallbackDate: boolean = false;
  isStardustOnlyUpload: boolean = false;

  editingFields: Record<keyof ProfileStats | 'createdAt', boolean> = {
    level: false,
    distanceWalked: false,
    distanceUnit: false,
    pokemonCaught: false,
    pokestopsVisited: false,
    totalXp: false,
    stardust: false,
    username: false,
    entryName: false,
    createdAt: false,
  };

  isDemoActive = false;
  isDemoClicking = false;
  isDemoDragging = false;
  demoCursorX = -100;
  demoCursorY = -100;
  private demoTimeoutIds: any[] = [];

  private authSub: Subscription | null = null;
  private hasPostedStats = false; // Bug 2: guard against double-post for logged-in users
  private cachedPrefs: any = null; // Bug 4: cache to avoid double /user-preferences fetch

  constructor(
    private readonly profileOcr: ProfileOcrService, 
    private http: HttpClient,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private funFactService: FunFactService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.authSub = this.authService.user$.subscribe(user => {
      // Clear stale cached prefs when the user signs out (Bug 4)
      if (!user) {
        this.cachedPrefs = null;
        return;
      }

      // If user logs in *after* uploading a screenshot, post the pending stats.
      // The !hasPostedStats guard prevents a double-POST when the user was already
      // signed in and processFile already called postStatsToBackend() (Bug 2).
      if (this.state === 'success' && this.stats && !this.currentStatId && !this.hasPostedStats) {
        this.postStatsToBackend();
      }

      // Fetch user preferences to initialize UI settings like the tutorial button
      this.http.get<any[]>(`${getApiUrl()}/user-preferences`).subscribe({
        next: (prefs) => {
          if (prefs && prefs.length > 0) {
            const pref = prefs[0];
            this.cachedPrefs = pref; // Bug 4: cache for use in processFile
            this.knownTrainerName = pref.username;
            this.displayTutorialEnabled = pref.display_tutorial !== 0 && pref.display_tutorial !== false;
          }
        },
        error: (err) => console.error('Failed to load preferences on init', err)
      });
    });
  }

  ngOnDestroy() {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
    this.clearDemoTimeouts();
  }

  postStatsToBackend() {
    if (!this.username || !this.stats) return;

    this.hasPostedStats = true; // Bug 2: prevent re-fire from auth subscription
    this.isPostingStats = true;
    this.http
      .post<{success: boolean, statId?: number, previousStats?: any}>(`${getApiUrl()}/post-data`, { 
        username: this.username,
        level: this.stats.level,
        distanceWalked: this.stats.distanceWalked,
        caught: this.stats.pokemonCaught,
        stopVisited: this.stats.pokestopsVisited,
        totalXp: this.stats.totalXp,
        stardust: this.stats.stardust,
        entryName: this.stats.entryName,
        createdAt: this.screenshotDate ? this.screenshotDate.toISOString() : undefined,
        uploadedAt: new Date().toISOString() // Bug 3: record actual upload timestamp
      })
      .subscribe({
        next: (res) => {
          this.isPostingStats = false;
          console.log('Posted stats:', res);
          if (res.statId) {
            this.currentStatId = res.statId;
          }
          if (res.previousStats) {
            this.previousStats = res.previousStats;
          }
          this.calculateDiffs();
          this.fetchUserHistory(this.username);
        },
        error: (err) => {
          this.isPostingStats = false;
          console.error('Failed to post stats:', err);
          if (err.status === 403) {
            // Bug 5: Don't silently swallow — revert to error state so the
            // user sees exactly why their upload was rejected.
            this.state = 'error';
            this.errorMessage = err.error?.error || 'This trainer name is already linked to a different account.';
          } else {
            this.state = 'error';
            this.errorMessage = 'Network error: Failed to save stats. Please check your connection and try again.';
          }
        },
      });
  }

  get isProcessing(): boolean {
    return this.state === 'processing';
  }

  handleUploadError(msg: string): void {
    this.state = 'error';
    this.errorMessage = msg;
  }

  dismissError(): void {
    this.errorMessage = '';
    if (this.state === 'error') {
      this.state = 'idle';
      this.revokePreview();
    }
  }



  formatDistance(stats: ProfileStats): string {
    if (stats.distanceWalked === null || stats.distanceWalked === undefined) return '—';
    const formatted = stats.distanceWalked.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const unit = stats.distanceUnit === 'mi' ? 'mi' : 'km';
    return `${formatted} ${unit}`;
  }

  formatCount(value: number | null | undefined): string {
    return (value !== null && value !== undefined) ? value.toLocaleString() : '—';
  }

  toggleDebug(): void {
    this.showDebug = !this.showDebug;
  }

  toggleEdit(field: keyof ProfileStats | 'createdAt'): void {
    this.editingFields[field] = !this.editingFields[field];
    this.cdr.detectChanges();
  }

  async processFile(file: File): Promise<void> {
    this.revokePreview();
    this.stats = null;
    this.errorMessage = '';
    this.rawOcrText = '';
    this.showDebug = false;
    this.currentStatId = null;
    this.previousStats = null;
    this.statDiffs = null;
    this.dailyAverages = null;
    this.diffDays = 0;
    this.funFact = null;
    this.allFunFacts = [];
    this.displayStats = null;
    this.isAnimating = false;
    this.screenshotDate = null;
    this.usedFallbackDate = false;
    this.isStardustOnlyUpload = false;
    this.hasPostedStats = false; // Bug 2: allow a fresh post for each new upload
    this.editingFields = {
      level: false,
      distanceWalked: false,
      distanceUnit: false,
      pokemonCaught: false,
      pokestopsVisited: false,
      totalXp: false,
      stardust: false,
      username: false,
      entryName: false,
      createdAt: false,
    };

    if (file.size > 10 * 1024 * 1024) {
      this.state = 'error';
      this.errorMessage = 'File size exceeds the 10MB limit.';
      return;
    }

    this.previewUrl = URL.createObjectURL(file);
    
    try {
      const exifData = await exifr.parse(file, {pick: ['DateTimeOriginal', 'CreateDate']});
      if (exifData && (exifData.DateTimeOriginal || exifData.CreateDate)) {
        this.screenshotDate = exifData.DateTimeOriginal || exifData.CreateDate;
      } else {
        this.screenshotDate = new Date(file.lastModified);
        this.usedFallbackDate = true;
      }
    } catch (e) {
      console.warn('Failed to parse EXIF data', e);
      this.screenshotDate = new Date(file.lastModified);
      this.usedFallbackDate = true;
    }
    
    this.state = 'processing';

    try {
      const result = await this.profileOcr.extractFromFile(file);
      const isStardustOnly = isPokemonDetailScreen(result.rawText) || (
        result.stats.stardust !== undefined && 
        result.stats.stardust !== null && 
        result.stats.level === null && 
        result.stats.distanceWalked === null && 
        result.stats.totalXp === null
      );

      let extractedUsername = isStardustOnly
        ? (this.knownTrainerName || this.username)
        : (result.stats.username || this.knownTrainerName || this.username);

      if (isStardustOnly && !extractedUsername) {
        throw new InvalidScreenshotError('Please upload a Trainer Profile screenshot first so we know which profile to link your Stardust to!', result.rawText);
      }

      this.isStardustOnlyUpload = isStardustOnly;
      this.username = extractedUsername || '';
      this.stats = { ...result.stats, username: this.username };

      // Bug 7: Leading-1 icon artifact correction is done later in calculateDiffs()
      // where previousStats/userHistory are populated and context is richer.
      // Doing it here was dead code (userHistory and previousStats are always empty
      // at this point in processFile) and risked double-correcting if both fired.

      this.displayStats = { ...this.stats };
      this.rawOcrText = result.rawText;
      const applySuccessState = () => {
        this.state = 'success';
        this.cdr.detectChanges();
      };

      if ((document as any).startViewTransition) {
        (document as any).startViewTransition(() => applySuccessState());
      } else {
        applySuccessState();
      }
      
      // Load user preferences — use cache if already fetched to avoid a double
      // round-trip (ngOnInit also fetches on auth state change) (Bug 4).
      if (this.username && this.authService.getToken()) {
        let userPref = this.cachedPrefs;
        if (!userPref) {
          try {
            const prefs = await this.http.get<any[]>(`${getApiUrl()}/user-preferences`).toPromise();
            userPref = prefs && prefs.length > 0 ? prefs[0] : undefined;
            if (userPref) this.cachedPrefs = userPref;
          } catch (err) {
            console.error('Failed to load preferences for stats rendering:', err);
          }
        }

        if (userPref) {
          this.knownTrainerName = userPref.username;

          if (this.knownTrainerName && this.username !== this.knownTrainerName && !isStardustOnly) {
            const editDist = levenshtein(this.username, this.knownTrainerName);

            if (editDist <= 1) {
              // Looks like an OCR typo — silently correct
              console.log(`Correcting OCR typo: "${this.username}" → "${this.knownTrainerName}" (edit distance ${editDist})`);
              this.username = this.knownTrainerName;
              this.stats.username = this.knownTrainerName;
              if (this.displayStats) this.displayStats.username = this.knownTrainerName;
            } else {
              // Clearly a different trainer — block and ask the user to confirm
              console.warn(`Username mismatch: OCR read "${this.username}", linked trainer is "${this.knownTrainerName}" (edit distance ${editDist})`);
              this.ocrUsername = this.username;
              this.usernameMismatch = true;
              this.editingFields.username = true;
            }
          }

          // Apply default unit if OCR didn't catch it
          if (!this.stats.distanceUnit) {
            this.stats.distanceUnit = userPref.default_unit;
            if (this.displayStats) this.displayStats.distanceUnit = userPref.default_unit;
          }

          this.showFunFactsEnabled = !!userPref.show_fun_facts;
          this.displayTutorialEnabled = userPref.display_tutorial !== 0 && userPref.display_tutorial !== false;

          // Only generate fun facts if enabled
          if (this.showFunFactsEnabled) {
            this.generateFunFacts();
          } else {
            this.funFact = null;
            this.allFunFacts = [];
          }
        } else {
          // Default behavior if no preferences found
          this.showFunFactsEnabled = true;
          this.displayTutorialEnabled = true;
          this.generateFunFacts();
        }
      } else {
        // Guest mode behavior
        this.showFunFactsEnabled = true;
        this.displayTutorialEnabled = true;
        this.generateFunFacts();
      }

      // Post stats to backend (skip if we're waiting for user to confirm a mismatched username)
      if (this.username && this.stats) {
        if (!this.authService.getToken()) {
          // Guest mode: do not save to DB, skip fetch history
          setTimeout(() => this.authService.renderSignInButton('home-google-signin-btn'), 100);
          return;
        }

        if (!this.usernameMismatch) {
          this.postStatsToBackend();
        }
      }
    } catch (err) {
      this.state = 'error';
      if (err instanceof ProfileOcrParseError || err instanceof InvalidScreenshotError) {
        this.errorMessage = err.message;
        this.rawOcrText = err.rawText;
      } else if (err instanceof OcrTimeoutError) {
        this.errorMessage = err.message;
      } else if (err instanceof Error) {
        this.errorMessage = err.message;
      } else {
        this.errorMessage = 'Something went wrong while reading the screenshot.';
      }
    }
  }

  private revokePreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  submitCorrection(field: keyof ProfileStats | 'createdAt', value: string, maxRetries?: number): void {
    if (!this.stats) {
      this.editingFields[field] = false;
      this.cdr.detectChanges();
      return;
    }

    // Fix Race Condition: If the initial background save is still running,
    // queue the correction to run shortly after it finishes so we don't duplicate entries.
    // Guard with a max-retry count so we never spin forever if isPostingStats gets stuck.
    if (this.isPostingStats) {
      const retriesLeft = (maxRetries ?? 10) - 1;
      if (retriesLeft <= 0) {
        console.warn('submitCorrection: gave up waiting for isPostingStats to clear; skipping.');
        this.editingFields[field] = false;
        this.cdr.detectChanges();
        return;
      }
      setTimeout(() => this.submitCorrection(field, value, retriesLeft), 200);
      return;
    }

    // Always exit editing mode for this field when submitting or blurring
    this.editingFields[field] = false;

    if (this.usernameMismatch && field !== 'username') {
      this.errorMessage = 'Please confirm your trainer name before saving other corrections.';
      this.cdr.detectChanges();
      return;
    }

    let hasChanged = false;

    if (field === 'username') {
      if (value.trim()) {
        this.stats.username = value.trim();
        this.username = value.trim();
        this.usernameMismatch = false;
        this.ocrUsername = '';
        hasChanged = true;
      }
    } else if (field === 'entryName') {
      if (value !== (this.stats.entryName ?? '')) {
        this.stats.entryName = value;
        hasChanged = true;
      }
    } else if (field === 'createdAt' as any) {
      const parsedDate = new Date(value);
      if (!Number.isNaN(parsedDate.getTime())) {
        this.screenshotDate = parsedDate;
        hasChanged = true;
      }
    } else if (field === 'distanceWalked') {
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed)) {
        this.stats.distanceWalked = Math.max(0, Math.min(1000000, parsed));
        if (this.displayStats) this.displayStats.distanceWalked = this.stats.distanceWalked;
        if (!this.stats.distanceUnit) this.stats.distanceUnit = 'km';
        hasChanged = true;
      }
    } else {
      let parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        if (field === 'level') parsed = Math.max(1, Math.min(80, parsed));
        else if (field === 'totalXp') parsed = Math.max(0, Math.min(2000000000, parsed));
        else if (field === 'pokemonCaught') parsed = Math.max(0, Math.min(99999999, parsed));
        else if (field === 'pokestopsVisited') parsed = Math.max(0, Math.min(99999999, parsed));
        else if (field === 'stardust') parsed = Math.max(0, Math.min(99999999999, parsed));

        (this.stats as any)[field] = parsed;
        if (this.displayStats) (this.displayStats as any)[field] = parsed;
        hasChanged = true;
      }
    }

    this.calculateDiffs(false);
    this.cdr.detectChanges();

    if (!hasChanged) {
      return; // Exit edit mode cleanly without persisting invalid/unchanged data
    }
    
    if (this.showFunFactsEnabled) {
      this.generateFunFacts();
    } else {
      this.funFact = null;
      this.allFunFacts = [];
    }

    const payload = { 
      username: this.username,
      level: this.stats.level,
      distanceWalked: this.stats.distanceWalked,
      caught: this.stats.pokemonCaught,
      stopVisited: this.stats.pokestopsVisited,
      totalXp: this.stats.totalXp,
      stardust: this.stats.stardust,
      entryName: this.stats.entryName,
      createdAt: this.screenshotDate ? this.screenshotDate.toISOString() : undefined,
      uploadedAt: new Date().toISOString() // Bug 3: record actual upload timestamp
    };

    if (!this.authService.getToken()) {
      this.errorMessage = 'Please sign in to save your corrections.';
      return; // Guests don't save corrections
    }

    if (this.currentStatId) {
      this.http
        .put(`${getApiUrl()}/update-data/${this.currentStatId}`, payload)
        .subscribe({
          next: (res) => {
            console.log(`Updated corrected ${field}:`, res);
            this.fetchUserHistory(this.username);
          },
          error: (err) => {
            console.error(`Failed to update corrected ${field}:`, err);
            if (err.status === 403) this.errorMessage = err.error?.error || 'Not authorized.';
            else this.errorMessage = 'Network error: Failed to save correction. Please try again.';
          },
        });
    } else {
      this.http
          .post<{success: boolean, statId?: number, previousStats?: any}>(`${getApiUrl()}/post-data`, payload)
        .subscribe({
          next: (res) => {
            console.log(`Posted corrected ${field}:`, res);
            if (res.statId) {
              this.currentStatId = res.statId;
            }
            if (res.previousStats) {
              this.previousStats = res.previousStats;
            }
            this.calculateDiffs(false);
            this.fetchUserHistory(this.username);
          },
          error: (err) => {
            console.error(`Failed to post corrected ${field}:`, err);
            if (err.status === 403) this.errorMessage = err.error?.error || 'Not authorized.';
            else this.errorMessage = 'Network error: Failed to save correction. Please try again.';
          },
        });
    }
  }

  private fetchUserHistory(username: string): void {
    this.http.get<any[]>(`${getApiUrl()}/get-user-stats/${encodeURIComponent(username)}`).subscribe({
      next: (data) => {
        this.userHistory = data;
        if (this.stats) {
          this.calculateDiffs(true);
        }
      },
      error: (err) => console.error('Failed to fetch user history:', err),
    });
  }

  calculateDiffs(animate: boolean = true): void {
    const hasPastHistory = !!this.previousStats || (this.userHistory && this.userHistory.length > 0);
    if (!this.stats || !hasPastHistory) {
      this.statDiffs = null;
      this.dailyAverages = null;
      this.diffDays = 0;
      return;
    }

    const getPrevStardustVal = (): number | null => {
      let rawVal: number | null = null;
      if (this.previousStats) {
        if (this.previousStats.stardust != null) rawVal = Number(this.previousStats.stardust);
        else if (this.previousStats.previousStardust != null) rawVal = Number(this.previousStats.previousStardust);
      }
      if (rawVal === null && this.userHistory && this.userHistory.length > 0) {
        const pastRows = this.userHistory.filter((r: any) => r.id !== this.currentStatId);
        const rowWithStardust = pastRows.find((r: any) => r.stardust != null);
        if (rowWithStardust) rawVal = Number(rowWithStardust.stardust);
      }
      // Safe correction for leading-1 artifact on previous stardust:
      // If previous stardust is in [10M, 20M) and the current stardust is smaller,
      // or the uncorrected difference represents an impossible large drop but
      // the corrected difference is small/reasonable, strip the leading 1.
      if (rawVal != null && rawVal >= 10_000_000 && rawVal < 20_000_000 && this.stats?.stardust != null) {
        const currentDust = this.stats.stardust;
        const uncorrectedDiff = currentDust - rawVal;
        const correctedPrev = rawVal - 10_000_000;
        const correctedDiff = currentDust - correctedPrev;
        if (uncorrectedDiff < -1_000_000 && correctedDiff >= -1_000_000 && correctedDiff <= 1_000_000) {
          rawVal = correctedPrev;
        }
      }
      return rawVal;
    };

    const prevStardust = getPrevStardustVal();

    // Auto-correct leading 1 icon artifact on Stardust (e.g. 15,343,876 when previous stardust was 5,343,551)
    if (
      this.stats?.stardust != null &&
      this.stats.stardust >= 10_000_000 &&
      prevStardust != null &&
      prevStardust < 10_000_000
    ) {
      const correctedDust = this.stats.stardust - 10_000_000;
      const diffWithCorrection = correctedDust - prevStardust;
      const originalDiff = this.stats.stardust - prevStardust;
      if (originalDiff >= 9_000_000 && diffWithCorrection >= -1_000_000 && diffWithCorrection <= 1_000_000) {
        this.stats.stardust = correctedDust;
        if (this.displayStats) {
          this.displayStats.stardust = correctedDust;
        }
      }
    }

    // Stardust-only uploads: only compute the stardust diff, skip profile metrics
    if (this.isStardustOnlyUpload) {
      if (
        this.stats.stardust != null &&
        prevStardust != null
      ) {
        const stardustDiff = (this.stats.stardust || 0) - prevStardust;
        if (stardustDiff !== 0) {
          this.statDiffs = { level: 0, distanceWalked: 0, pokemonCaught: 0, pokestopsVisited: 0, totalXp: 0, stardust: stardustDiff };
          const now = this.screenshotDate ? this.screenshotDate.getTime() : Date.now();
          const prevCreatedAt = this.previousStats?.created_at || (this.userHistory && this.userHistory.length > 0 ? this.userHistory.find((r: any) => r.id !== this.currentStatId)?.created_at : null);
          const prevDate = prevCreatedAt ? new Date(prevCreatedAt).getTime() : now;
          this.diffDays = Math.max((now - prevDate) / (1000 * 60 * 60 * 24), 0);
          this.dailyAverages = this.diffDays >= 1
            ? { level: 0, distanceWalked: 0, pokemonCaught: 0, pokestopsVisited: 0, totalXp: 0, stardust: stardustDiff / this.diffDays }
            : null;
          if (animate) {
            this.startAnimations();
          }
        } else {
          this.statDiffs = null;
          this.dailyAverages = null;
          this.diffDays = 0;
        }
      } else {
        console.log('[DEBUG Stardust] Stardust-only upload missing current or prev stardust. current:', this.stats.stardust, 'prev:', prevStardust);
        this.statDiffs = null;
        this.dailyAverages = null;
        this.diffDays = 0;
      }
      return;
    }

    // Bug 6: When previousStats is null (e.g. first upload, or response dropped),
    // fall back to userHistory for all fields — previously only stardust had this fallback.
    const getPrevValue = (dbField: string): number => {
      if (this.previousStats && this.previousStats[dbField] != null) {
        return Number(this.previousStats[dbField]) || 0;
      }
      if (this.userHistory && this.userHistory.length > 0) {
        const pastRows = this.userHistory.filter((r: any) => r.id !== this.currentStatId);
        const row = pastRows.find((r: any) => r[dbField] != null);
        if (row) return Number(row[dbField]) || 0;
      }
      return 0;
    };

    const diffs: { level: number; distanceWalked: number; pokemonCaught: number; pokestopsVisited: number; totalXp: number; stardust?: number } = {
      level: (this.stats.level || 0) - getPrevValue('level'),
      distanceWalked: (this.stats.distanceWalked || 0) - getPrevValue('distance_walked'),
      pokemonCaught: (this.stats.pokemonCaught || 0) - getPrevValue('caught'),
      pokestopsVisited: (this.stats.pokestopsVisited || 0) - getPrevValue('stop_visited'),
      totalXp: (this.stats.totalXp || 0) - getPrevValue('total_xp'),
    };
    if (this.stats.stardust !== null && this.stats.stardust !== undefined && prevStardust !== null) {
      diffs.stardust = (this.stats.stardust || 0) - prevStardust;
    }

    if (
      diffs.level !== 0 ||
      diffs.distanceWalked !== 0 ||
      diffs.pokemonCaught !== 0 ||
      diffs.pokestopsVisited !== 0 ||
      diffs.totalXp !== 0 ||
      (diffs.stardust !== undefined && diffs.stardust !== 0)
    ) {
      this.statDiffs = diffs;

      const now = this.screenshotDate ? this.screenshotDate.getTime() : Date.now();
      const prevCreatedAt = this.previousStats?.created_at || (this.userHistory && this.userHistory.length > 0 ? this.userHistory.find((r: any) => r.id !== this.currentStatId)?.created_at : null);
      const prevDate = prevCreatedAt ? new Date(prevCreatedAt).getTime() : now;
      this.diffDays = Math.max((now - prevDate) / (1000 * 60 * 60 * 24), 0);

      if (this.diffDays >= 1) {
        this.dailyAverages = {
          level: diffs.level / this.diffDays,
          distanceWalked: diffs.distanceWalked / this.diffDays,
          pokemonCaught: diffs.pokemonCaught / this.diffDays,
          pokestopsVisited: diffs.pokestopsVisited / this.diffDays,
          totalXp: diffs.totalXp / this.diffDays,
          stardust: diffs.stardust !== undefined ? diffs.stardust / this.diffDays : undefined,
        };
      } else {
        this.dailyAverages = null;
      }

      if (animate) {
        this.startAnimations();
      }
    } else {
      this.statDiffs = null;
      this.dailyAverages = null;
      this.diffDays = 0;
    }
  }

  startAnimations(): void {
    if (!this.stats || !this.displayStats) return;

    const getPrevNum = (field: string): number => {
      if (this.previousStats && this.previousStats[field] != null) {
        return Number(this.previousStats[field]) || 0;
      }
      if (this.userHistory && this.userHistory.length > 0) {
        const pastRows = this.userHistory.filter((r: any) => r.id !== this.currentStatId);
        const row = pastRows.find((r: any) => r[field] != null);
        if (row) return Number(row[field]) || 0;
      }
      return 0;
    };

    let startStardust = getPrevNum('stardust');
    if (startStardust === 0 && this.previousStats?.previousStardust != null) {
      startStardust = Number(this.previousStats.previousStardust) || 0;
    }

    // Safe correction for leading-1 artifact on startStardust:
    if (startStardust >= 10_000_000 && startStardust < 20_000_000 && this.stats?.stardust != null) {
      const targetStardust = Number(this.stats.stardust) || 0;
      const uncorrectedDiff = targetStardust - startStardust;
      const correctedStart = startStardust - 10_000_000;
      const correctedDiff = targetStardust - correctedStart;
      if (uncorrectedDiff < -1_000_000 && correctedDiff >= -1_000_000 && correctedDiff <= 1_000_000) {
        startStardust = correctedStart;
      }
    }

    const startObj = {
      level: getPrevNum('level'),
      distanceWalked: getPrevNum('distance_walked'),
      pokemonCaught: getPrevNum('caught'),
      pokestopsVisited: getPrevNum('stop_visited'),
      totalXp: getPrevNum('total_xp'),
      stardust: startStardust,
    };

    const targetObj = {
      level: Number(this.stats.level) || 0,
      distanceWalked: Number(this.stats.distanceWalked) || 0,
      pokemonCaught: Number(this.stats.pokemonCaught) || 0,
      pokestopsVisited: Number(this.stats.pokestopsVisited) || 0,
      totalXp: Number(this.stats.totalXp) || 0,
      stardust: Number(this.stats.stardust) || 0,
    };

    // Only apply starting values if the current parsed stat is not null (so we don't accidentally display '0' when missing)
    if (this.stats.level !== null) this.displayStats.level = startObj.level;
    if (this.stats.distanceWalked !== null) this.displayStats.distanceWalked = startObj.distanceWalked;
    if (this.stats.pokemonCaught !== null) this.displayStats.pokemonCaught = startObj.pokemonCaught;
    if (this.stats.pokestopsVisited !== null) this.displayStats.pokestopsVisited = startObj.pokestopsVisited;
    if (this.stats.totalXp !== null) this.displayStats.totalXp = startObj.totalXp;
    if (this.stats.stardust !== null) this.displayStats.stardust = startObj.stardust;

    const duration = 1500;

    this.isAnimating = true;
    const startTime = performance.now();

    const easeOutQuad = (x: number): number => {
      return 1 - (1 - x) * (1 - x);
    };

    this.ngZone.runOutsideAngular(() => {
        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easedProgress = easeOutQuad(progress);

          if (this.displayStats) {
            if (this.stats?.level !== null) this.displayStats.level = Math.round(startObj.level + (targetObj.level - startObj.level) * easedProgress);
            if (this.stats?.distanceWalked !== null) this.displayStats.distanceWalked = startObj.distanceWalked + (targetObj.distanceWalked - startObj.distanceWalked) * easedProgress;
            if (this.stats?.pokemonCaught !== null) this.displayStats.pokemonCaught = Math.round(startObj.pokemonCaught + (targetObj.pokemonCaught - startObj.pokemonCaught) * easedProgress);
            if (this.stats?.pokestopsVisited !== null) this.displayStats.pokestopsVisited = Math.round(startObj.pokestopsVisited + (targetObj.pokestopsVisited - startObj.pokestopsVisited) * easedProgress);
            if (this.stats?.totalXp !== null) this.displayStats.totalXp = Math.round(startObj.totalXp + (targetObj.totalXp - startObj.totalXp) * easedProgress);
            if (this.stats?.stardust !== null) this.displayStats.stardust = Math.round(startObj.stardust + (targetObj.stardust - startObj.stardust) * easedProgress);
            
            // Trigger local change detection for this component only, preventing global app lag
            this.cdr.detectChanges();
          }

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            this.ngZone.run(() => {
              this.isAnimating = false;
              // Snap exactly to final values
              if (this.displayStats && this.stats) {
                if (this.stats.level !== null) this.displayStats.level = targetObj.level;
                if (this.stats.distanceWalked !== null) this.displayStats.distanceWalked = targetObj.distanceWalked;
                if (this.stats.pokemonCaught !== null) this.displayStats.pokemonCaught = targetObj.pokemonCaught;
                if (this.stats.pokestopsVisited !== null) this.displayStats.pokestopsVisited = targetObj.pokestopsVisited;
                if (this.stats.totalXp !== null) this.displayStats.totalXp = targetObj.totalXp;
                if (this.stats.stardust !== null) this.displayStats.stardust = targetObj.stardust;
              }
              this.cdr.detectChanges();
            });
          }
        };

        requestAnimationFrame(animate);
      });
  }



  formatDiffCount(val: number): string {
    if (!val) return '';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toLocaleString()}`;
  }

  formatDiffDistance(val: number): string {
    if (!val) return '';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  }

  generateFunFacts(): void {
    if (!this.stats) return;
    this.allFunFacts = this.funFactService.generateFacts(this.stats, this.dailyAverages);
    this.shuffleFunFact();
  }

  shuffleFunFact(): void {
    if (this.allFunFacts.length === 0) {
      this.funFact = null;
      return;
    }
    let newFact = this.funFact;
    if (this.allFunFacts.length > 1) {
      while (newFact === this.funFact) {
        newFact = this.allFunFacts[Math.floor(Math.random() * this.allFunFacts.length)];
      }
    } else {
      newFact = this.allFunFacts[0];
    }
    this.funFact = newFact;
  }

  getLocalDatetimeString(d: Date | null): string {
    if (!d) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private clearDemoTimeouts(): void {
    for (const id of this.demoTimeoutIds) {
      clearTimeout(id);
    }
    this.demoTimeoutIds = [];
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      const id = setTimeout(() => {
        resolve();
      }, ms);
      this.demoTimeoutIds.push(id);
    });
  }

  async runDemo(): Promise<void> {
    if (this.isDemoActive) return;
    this.clearDemoTimeouts();
    this.isDemoActive = true;
    this.isDemoClicking = false;
    this.isDemoDragging = false;

    // Start cursor at bottom right
    this.demoCursorX = window.innerWidth - 50;
    this.demoCursorY = window.innerHeight - 50;
    this.cdr.detectChanges();

    // 1. Move to middle of screen
    await this.delay(100);
    this.demoCursorX = window.innerWidth / 2;
    this.demoCursorY = window.innerHeight / 2;
    await this.delay(800);

    // 2. Attach screenshot (simulate "grab")
    this.isDemoDragging = true;
    this.cdr.detectChanges();
    await this.delay(600); // Pause to show it grabbed the image

    // 3. Move to drop zone
    const dropZone = document.querySelector('.drop-zone');
    if (dropZone) {
      const rect = dropZone.getBoundingClientRect();
      this.demoCursorX = rect.left + rect.width / 2;
      this.demoCursorY = rect.top + rect.height / 2;
    } else {
      this.demoCursorX = window.innerWidth / 2;
      this.demoCursorY = 300;
    }
    
    await this.delay(800); // Wait for cursor move

    // 4. Simulate drop
    this.isDemoClicking = true;
    await this.delay(200);
    this.isDemoDragging = false;
    this.isDemoClicking = false;
    await this.delay(200);

    // 3. Processing state
    this.state = 'processing';
    this.cdr.detectChanges();

    await this.delay(1500); // Fake processing time

    // 4. Success state with mock data
    this.username = 'DemoTrainer';
    const mockStats: ProfileStats = {
      level: 42,
      totalXp: 45678900,
      pokemonCaught: 54321,
      pokestopsVisited: 23456,
      distanceWalked: 1234.5,
      distanceUnit: 'km',
      username: 'DemoTrainer',
      entryName: 'Demo Data'
    };

    this.stats = { ...mockStats };
    this.displayStats = { ...mockStats };
    this.screenshotDate = new Date();
    
    const applySuccessState = () => {
      this.state = 'success';
      this.cdr.detectChanges();
    };

    if ((document as any).startViewTransition) {
      (document as any).startViewTransition(() => applySuccessState());
    } else {
      applySuccessState();
    }

    this.showFunFactsEnabled = true;
    this.generateFunFacts();

    // Move cursor to showcase a stat card
    await this.delay(600);
    const firstStat = document.querySelector('.dashboard-stat-card');
    if (firstStat) {
      const rect = firstStat.getBoundingClientRect();
      this.demoCursorX = rect.left + rect.width / 2;
      this.demoCursorY = rect.top + rect.height / 2;
    }

    // 5. End demo after viewing
    await this.delay(4000);
    this.resetDemo();
  }

  resetDemo(): void {
    this.isDemoActive = false;
    this.isDemoDragging = false;
    this.clearDemoTimeouts();
    this.state = 'idle';
    this.stats = null;
    this.displayStats = null;
    this.funFact = null;
    this.allFunFacts = [];
    this.cdr.detectChanges();
  }
}
