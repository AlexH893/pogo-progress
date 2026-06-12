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
  stats: ProfileStats | null = null;
  displayStats: ProfileStats | null = null;
  isAnimating = false;

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

  editingFields: Record<keyof ProfileStats | 'createdAt', boolean> = {
    level: false,
    distanceWalked: false,
    distanceUnit: false,
    pokemonCaught: false,
    pokestopsVisited: false,
    totalXp: false,
    username: false,
    entryName: false,
    createdAt: false,
  };

  private authSub: Subscription | null = null;

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
      // If user logs in after uploading a screenshot
      if (user && this.state === 'success' && this.stats && !this.currentStatId) {
        this.postStatsToBackend();
      }

      // Fetch user preferences to initialize UI settings like the tutorial button
      if (user) {
        this.http.get<any[]>(`${getApiUrl()}/user-preferences`).subscribe({
          next: (prefs) => {
            if (prefs && prefs.length > 0) {
              const pref = prefs[0];
              this.knownTrainerName = pref.username;
              this.displayTutorialEnabled = pref.display_tutorial !== 0 && pref.display_tutorial !== false;
            }
          },
          error: (err) => console.error('Failed to load preferences on init', err)
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }

  postStatsToBackend() {
    if (!this.username || !this.stats) return;

    this.http
      .post<{success: boolean, statId?: number, previousStats?: any}>(`${getApiUrl()}/post-data`, { 
        username: this.username,
        level: this.stats.level,
        distanceWalked: this.stats.distanceWalked,
        caught: this.stats.pokemonCaught,
        stopVisited: this.stats.pokestopsVisited,
        totalXp: this.stats.totalXp,
        entryName: this.stats.entryName,
        createdAt: this.screenshotDate ? this.screenshotDate.toISOString() : undefined
      })
      .subscribe({
        next: (res) => {
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
          console.error('Failed to post stats:', err);
          if (err.status === 403) {
            this.state = 'error';
            this.errorMessage = err.error?.error || 'This trainer is linked to another account.';
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
    if (stats.distanceWalked === null) return '—';
    const formatted = stats.distanceWalked.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const unit = stats.distanceUnit === 'mi' ? 'mi' : 'km';
    return `${formatted} ${unit}`;
  }

  formatCount(value: number | null): string {
    return value !== null ? value.toLocaleString() : '—';
  }

  toggleDebug(): void {
    this.showDebug = !this.showDebug;
  }

  toggleEdit(field: keyof ProfileStats | 'createdAt'): void {
    this.editingFields[field] = !this.editingFields[field];
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
    this.editingFields = {
      level: false,
      distanceWalked: false,
      distanceUnit: false,
      pokemonCaught: false,
      pokestopsVisited: false,
      totalXp: false,
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
      this.username = result.stats.username || '';
      this.stats = result.stats;
      this.displayStats = { ...result.stats };
      this.rawOcrText = result.rawText;
      this.state = 'success';
      
      // Load user preferences before generating fun facts
      if (this.username && this.authService.getToken()) {
        try {
          const prefs = await this.http.get<any[]>(`${getApiUrl()}/user-preferences`).toPromise();
          const userPref = prefs && prefs.length > 0 ? prefs[0] : undefined;
          
          if (userPref) {
            this.knownTrainerName = userPref.username;
            // Override OCR typo with the known linked trainer name
            if (this.knownTrainerName && this.username !== this.knownTrainerName) {
              console.log(`Overriding OCR username ${this.username} with linked trainer ${this.knownTrainerName}`);
              this.username = this.knownTrainerName;
              this.stats.username = this.knownTrainerName;
              if (this.displayStats) this.displayStats.username = this.knownTrainerName;
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
        } catch (err) {
          console.error('Failed to load preferences for stats rendering:', err);
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

      // Post stats to backend
      if (this.username && this.stats) {
        if (!this.authService.getToken()) {
          // Guest mode: do not save to DB, skip fetch history
          setTimeout(() => this.authService.renderSignInButton('home-google-signin-btn'), 100);
          return;
        }

        this.postStatsToBackend();
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

  submitCorrection(field: keyof ProfileStats | 'createdAt', value: string): void {
    if (!this.stats) return;

    if (field === 'username') {
      this.stats.username = value;
      this.username = value;
    } else if (field === 'entryName') {
      this.stats.entryName = value;
    } else if (field === 'createdAt' as any) {
      const parsedDate = new Date(value);
      if (!Number.isNaN(parsedDate.getTime())) {
        this.screenshotDate = parsedDate;
      } else {
        return;
      }
    } else if (field === 'distanceWalked') {
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed)) {
        this.stats.distanceWalked = parsed;
        if (this.displayStats) this.displayStats.distanceWalked = parsed;
        if (!this.stats.distanceUnit) this.stats.distanceUnit = 'km'; // default
      } else {
        return;
      }
    } else {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        (this.stats as any)[field] = parsed;
        if (this.displayStats) (this.displayStats as any)[field] = parsed;
      } else {
        return;
      }
    }

    this.editingFields[field] = false;
    this.calculateDiffs(false);
    
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
      entryName: this.stats.entryName,
      createdAt: this.screenshotDate ? this.screenshotDate.toISOString() : undefined
    };

    if (!this.authService.getToken()) {
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
            if (err.status === 403) alert(err.error?.error || 'Not authorized.');
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
            if (err.status === 403) alert(err.error?.error || 'Not authorized.');
          },
        });
    }
  }

  private fetchUserHistory(username: string): void {
    this.http.get<any[]>(`${getApiUrl()}/get-user-stats/${encodeURIComponent(username)}`).subscribe({
      next: (data) => {
        this.userHistory = data;
      },
      error: (err) => console.error('Failed to fetch user history:', err),
    });
  }

  calculateDiffs(animate: boolean = true): void {
    if (!this.stats || !this.previousStats) {
      this.statDiffs = null;
      this.dailyAverages = null;
      this.diffDays = 0;
      return;
    }

    const diffs = {
      level: (this.stats.level || 0) - (this.previousStats.level || 0),
      distanceWalked: (this.stats.distanceWalked || 0) - (this.previousStats.distance_walked || 0),
      pokemonCaught: (this.stats.pokemonCaught || 0) - (this.previousStats.caught || 0),
      pokestopsVisited: (this.stats.pokestopsVisited || 0) - (this.previousStats.stop_visited || 0),
      totalXp: (this.stats.totalXp || 0) - (this.previousStats.total_xp || 0),
    };
    
    console.log('calculated diffs:', diffs);
    console.log('this.stats:', this.stats);
    console.log('this.previousStats:', this.previousStats);

    if (
      diffs.level !== 0 ||
      diffs.distanceWalked !== 0 ||
      diffs.pokemonCaught !== 0 ||
      diffs.pokestopsVisited !== 0 ||
      diffs.totalXp !== 0
    ) {
      this.statDiffs = diffs;

      const now = this.screenshotDate ? this.screenshotDate.getTime() : Date.now();
      const prevDate = new Date(this.previousStats.created_at).getTime();
      this.diffDays = Math.max((now - prevDate) / (1000 * 60 * 60 * 24), 0);

      if (this.diffDays >= 1) {
        this.dailyAverages = {
          level: diffs.level / this.diffDays,
          distanceWalked: diffs.distanceWalked / this.diffDays,
          pokemonCaught: diffs.pokemonCaught / this.diffDays,
          pokestopsVisited: diffs.pokestopsVisited / this.diffDays,
          totalXp: diffs.totalXp / this.diffDays,
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
    if (!this.stats || !this.previousStats || !this.displayStats) return;

    // Initially snap display stats to previous DB stats (using Number() to prevent string concatenation bugs from MySQL decimals)
    const startObj = {
      level: Number(this.previousStats.level) || 0,
      distanceWalked: Number(this.previousStats.distance_walked) || 0,
      pokemonCaught: Number(this.previousStats.caught) || 0,
      pokestopsVisited: Number(this.previousStats.stop_visited) || 0,
      totalXp: Number(this.previousStats.total_xp) || 0,
    };

    const targetObj = {
      level: Number(this.stats.level) || 0,
      distanceWalked: Number(this.stats.distanceWalked) || 0,
      pokemonCaught: Number(this.stats.pokemonCaught) || 0,
      pokestopsVisited: Number(this.stats.pokestopsVisited) || 0,
      totalXp: Number(this.stats.totalXp) || 0,
    };

    // Only apply starting values if the current parsed stat is not null (so we don't accidentally display '0' when missing)
    if (this.stats.level !== null) this.displayStats.level = startObj.level;
    if (this.stats.distanceWalked !== null) this.displayStats.distanceWalked = startObj.distanceWalked;
    if (this.stats.pokemonCaught !== null) this.displayStats.pokemonCaught = startObj.pokemonCaught;
    if (this.stats.pokestopsVisited !== null) this.displayStats.pokestopsVisited = startObj.pokestopsVisited;
    if (this.stats.totalXp !== null) this.displayStats.totalXp = startObj.totalXp;

    const duration = 2000;

    // The image preview takes exactly 1000ms to fade out and collapse.
    // Delay the animation start to sync perfectly with the image disappearing.
    setTimeout(() => {
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
              }
              this.cdr.detectChanges();
            });
          }
        };

        requestAnimationFrame(animate);
      });
    }, 900);
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

}
