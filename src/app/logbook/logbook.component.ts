import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getApiUrl } from '../config';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-logbook',
  templateUrl: './logbook.component.html',
  styleUrls: ['./logbook.component.scss']
})
export class LogbookComponent implements OnInit, AfterViewInit {
  stats: any[] = [];
  chartData: any[] = [];
  primaryTrainer: string = '';
  editingRowId: number | null = null;
  editingCell: { id: number, field: string } | null = null;
  editData: any = {};
  isLoading = true; // Chart loading
  isTableLoading = false; // Pagination loading
  isInitialTableLoad = true; // Initial table load
  user$ = this.authService.user$;
  showUploadedDate: boolean = false;
  velocityStats: any = null;
  velocityLabel: string = '';

  sortField: 'created_at' | 'uploaded_at' = 'created_at';
  sortDirection: 'asc' | 'desc' = 'desc';

  page = 0;
  limit = 20;
  hasMoreData = true;

  @ViewChild('sentinel') sentinel!: ElementRef<HTMLDivElement>;
  selectedEntryIds: Set<number> = new Set();
  comparisonResult: any = null;

  @ViewChild('deleteConfirmDialog') deleteConfirmDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('compareDialog') compareDialog!: ElementRef<HTMLDialogElement>;
  pendingDeleteId: number | null = null;

  constructor(private http: HttpClient, private authService: AuthService, private toastService: ToastService, private el: ElementRef) {}

  ngOnInit(): void {
    this.fetchChartData();
    this.fetchTableData(true);
  }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !this.isTableLoading && this.hasMoreData) {
          this.fetchTableData();
        }
      }, { rootMargin: '100px' });

      setTimeout(() => {
        if (this.sentinel?.nativeElement) {
          observer.observe(this.sentinel.nativeElement);
        }
      }, 500);
    }

    // Bug 6: The native <dialog> Escape key closes the element without
    // firing our (click) handler, leaving selectedEntryIds out of sync.
    // Listen to the 'cancel' event (fired by the browser on Escape) and
    // route it through our own close handlers so state stays consistent.
    this.compareDialog?.nativeElement?.addEventListener('cancel', (e: Event) => {
      e.preventDefault(); // we'll close it ourselves
      this.closeCompareDialog();
    });
    this.deleteConfirmDialog?.nativeElement?.addEventListener('cancel', (e: Event) => {
      e.preventDefault();
      this.closeDeleteDialog();
    });
  }

  get sortedStats(): any[] {
    return this.stats;
  }

  sortBy(field: 'created_at' | 'uploaded_at'): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      this.sortField = field;
      this.sortDirection = 'desc';
    }
    this.fetchTableData(true);
  }

  fetchChartData(): void {
    this.isLoading = true;
    this.http.get<any[]>(`${getApiUrl()}/get-chart-data`).subscribe({
      next: (data) => {
        this.chartData = data;
        this.updateChartData();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('[Logbook] Failed to fetch chart data:', err);
        this.isLoading = false;
      }
    });
  }

  fetchTableData(reset = false): void {
    if (reset) {
      this.page = 0;
      this.stats = [];
      this.hasMoreData = true;
    }
    if (!this.hasMoreData || this.isTableLoading) return;
    
    this.isTableLoading = true;
    const url = `${getApiUrl()}/get-data?limit=${this.limit}&offset=${this.page * this.limit}&sortField=${this.sortField}&sortDir=${this.sortDirection}`;
    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        if (data.length < this.limit) {
          this.hasMoreData = false;
        }
        this.stats = reset ? data : [...this.stats, ...data];
        this.page++;
        this.isTableLoading = false;
        this.isInitialTableLoad = false;
      },
      error: (err) => {
        console.error('[Logbook] Failed to fetch table data:', err);
        this.isTableLoading = false;
        this.isInitialTableLoad = false;
      }
    });
  }

  updateChartData(): void {
    if (this.chartData && this.chartData.length > 0) {
      const firstEntryWithUser = this.chartData.find(row => row.username);
      this.primaryTrainer = firstEntryWithUser ? firstEntryWithUser.username : '';
      
      this.chartData.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
      this.calculateVelocity();
    } else {
      this.chartData = [];
      this.primaryTrainer = '';
      this.velocityStats = null;
    }
  }

  calculateVelocity(): void {
    const sorted = [...this.chartData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (!sorted || sorted.length < 2) {
      this.velocityStats = null;
      return;
    }

    // sorted is guaranteed to be ordered by created_at DESC
    const latest = sorted[0];
    const latestTime = new Date(latest.created_at).getTime();
    
    // Target 7 days ago
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const targetTime = latestTime - sevenDaysMs;
    
    let bestEntry = sorted[1];
    let minDiff = Math.abs(new Date(bestEntry.created_at).getTime() - targetTime);
    
    for (let i = 2; i < sorted.length; i++) {
      const entryTime = new Date(sorted[i].created_at).getTime();
      const diff = Math.abs(entryTime - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        bestEntry = sorted[i];
      }
    }
    
    // If the best match is within 2 days of the 7-day target, call it "Past 7 Days"
    // Otherwise just use the immediate previous upload
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    
    if (minDiff <= twoDaysMs) {
      this.velocityLabel = 'Past 7 Days';
    } else {
      // Fallback to previous upload
      bestEntry = sorted[1];
      const daysSince = Math.max(1, Math.round((latestTime - new Date(bestEntry.created_at).getTime()) / (1000 * 60 * 60 * 24)));
      this.velocityLabel = `Since Last Upload (${daysSince} day${daysSince === 1 ? '' : 's'} ago)`;
    }
    
    this.velocityStats = {
      caught: (latest.caught !== null && bestEntry.caught !== null) ? latest.caught - bestEntry.caught : null,
      total_xp: (latest.total_xp !== null && bestEntry.total_xp !== null) ? latest.total_xp - bestEntry.total_xp : null,
      distance_walked: (latest.distance_walked !== null && bestEntry.distance_walked !== null) ? (latest.distance_walked - bestEntry.distance_walked) : null,
      stop_visited: (latest.stop_visited !== null && bestEntry.stop_visited !== null) ? latest.stop_visited - bestEntry.stop_visited : null,
      default_unit: latest.default_unit || 'km'
    };
  }

  startEdit(row: any, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.selectedEntryIds.size > 0) return;
    if (this.editingRowId !== null && this.editingRowId !== row.id) {
      this.saveEdit();
    }
    // Bug 4: Clear any open inline cell before opening the full-row editor
    // so we never have two simultaneous PUTs to the same endpoint.
    this.editingCell = null;
    this.editingRowId = row.id;
    this.editData = { ...row };
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Don't auto-save while a modal dialog is open — the backdrop click
    // should only close the dialog, not trigger an unrelated save.
    const compareOpen = this.compareDialog?.nativeElement?.open;
    const deleteOpen = this.deleteConfirmDialog?.nativeElement?.open;
    if (compareOpen || deleteOpen) return;

    if (this.editingRowId !== null) {
      const editedRowElement = this.el.nativeElement.querySelector('tr.editing-row');
      if (editedRowElement && !editedRowElement.contains(event.target as Node)) {
        this.saveEdit();
      }
    }
  }

  cancelEdit(): void {
    this.editingRowId = null;
    this.editData = {};
  }

  saveEdit(): void {
    if (!this.editingRowId) return;
    
    const savedRowId = this.editingRowId;

    // Enforce numeric boundaries
    if (this.editData.level !== null) this.editData.level = Math.max(1, Math.min(80, this.editData.level));
    if (this.editData.total_xp !== null) this.editData.total_xp = Math.max(0, Math.min(2000000000, this.editData.total_xp));
    if (this.editData.distance_walked !== null) this.editData.distance_walked = Math.max(0, Math.min(1000000, this.editData.distance_walked));
    if (this.editData.caught !== null) this.editData.caught = Math.max(0, Math.min(99999999, this.editData.caught));
    if (this.editData.stop_visited !== null) this.editData.stop_visited = Math.max(0, Math.min(99999999, this.editData.stop_visited));

    const payload = {
      username: this.editData.username,
      level: this.editData.level,
      distanceWalked: this.editData.distance_walked,
      caught: this.editData.caught,
      stopVisited: this.editData.stop_visited,
      totalXp: this.editData.total_xp,
      entryName: this.editData.entry_name
    };

    this.http.put(`${getApiUrl()}/update-data/${savedRowId}`, payload).subscribe({
      next: () => {
        this.fetchChartData();
        this.fetchTableData(true);
        // Only clear the edit state if the user hasn't already started editing another row
        if (this.editingRowId === savedRowId) {
          this.editingRowId = null;
          this.editData = {};
        }
      },
      error: (err) => {
        console.error('Failed to update data', err);
        this.toastService.show('Failed to save entry. Please try again.', 'error');
      }
    });
  }

  startInlineEdit(row: any, field: string, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (this.selectedEntryIds.size > 0) return;
    if (this.editingRowId !== null && this.editingRowId !== row.id) {
      this.saveEdit();
    }
    // Prevent starting inline edit if the whole row is already being edited
    if (this.editingRowId === row.id) return;
    this.editingCell = { id: row.id, field };
  }

  saveInlineEdit(row: any, field: string, value: string): void {
    if (!this.editingCell || this.editingCell.id !== row.id || this.editingCell.field !== field) return;

    let parsedValue: any = value;
    if (field === 'distance_walked') {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) parsedValue = null;
      else parsedValue = Math.max(0, Math.min(1000000, parsedValue));
    } else if (['level', 'total_xp', 'caught', 'stop_visited'].includes(field)) {
      parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue)) parsedValue = null;
      else {
        if (field === 'level') parsedValue = Math.max(1, Math.min(80, parsedValue));
        else if (field === 'total_xp') parsedValue = Math.max(0, Math.min(2000000000, parsedValue));
        else if (field === 'caught') parsedValue = Math.max(0, Math.min(99999999, parsedValue));
        else if (field === 'stop_visited') parsedValue = Math.max(0, Math.min(99999999, parsedValue));
      }
    }

    if (row[field] === parsedValue) {
      this.editingCell = null;
      return;
    }

    row[field] = parsedValue;
    this.editingCell = null;

    const payload = {
      username: row.username,
      level: row.level,
      distanceWalked: row.distance_walked,
      caught: row.caught,
      stopVisited: row.stop_visited,
      totalXp: row.total_xp,
      entryName: row.entry_name
    };

    this.http.put(`${getApiUrl()}/update-data/${row.id}`, payload).subscribe({
      next: () => {
        this.fetchChartData();
        this.fetchTableData(true);
      },
      error: (err) => {
        console.error('Failed to update inline data', err);
        this.toastService.show('Failed to save edit. Changes reverted.', 'error');
        this.fetchTableData(true); // Rollback on error
      }
    });
  }

  openDeleteDialog(id: number): void {
    if (this.selectedEntryIds.size > 0) return;
    this.pendingDeleteId = id;
    if (this.deleteConfirmDialog) {
      this.deleteConfirmDialog.nativeElement.showModal();
    }
  }

  closeDeleteDialog(): void {
    this.pendingDeleteId = null;
    if (this.deleteConfirmDialog) {
      this.deleteConfirmDialog.nativeElement.close();
    }
  }

  confirmDelete(): void {
    if (this.pendingDeleteId !== null) {
      this.http.delete(`${getApiUrl()}/delete-data/${this.pendingDeleteId}`).subscribe({
        next: () => {
          this.fetchChartData();
          this.fetchTableData(true);
          this.closeDeleteDialog();
        },
        // Bug 3: Previously only console.error'd — dialog stayed open with no feedback.
        error: (err) => {
          console.error('Failed to delete data', err);
          this.closeDeleteDialog();
          this.toastService.show('Failed to delete entry. Please try again.', 'error');
        }
      });
    }
  }

  isSelected(id: number): boolean {
    return this.selectedEntryIds.has(id);
  }

  toggleSelection(id: number): void {
    if (this.selectedEntryIds.has(id)) {
      this.selectedEntryIds.delete(id);
    } else {
      if (this.selectedEntryIds.size < 2) {
        this.selectedEntryIds.add(id);
      }
    }
  }

  clearSelection(): void {
    this.selectedEntryIds.clear();
    this.comparisonResult = null;
  }

  compareSelected(): void {
    if (this.selectedEntryIds.size !== 2) return;
    
    const selectedEntries = this.stats.filter(entry => this.selectedEntryIds.has(entry.id));
    if (selectedEntries.length !== 2) return;

    // Sort older first
    selectedEntries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const older = selectedEntries[0];
    const newer = selectedEntries[1];

    this.comparisonResult = {
      older,
      newer,
      delta: {
        total_xp: (newer.total_xp !== null && older.total_xp !== null) ? newer.total_xp - older.total_xp : null,
        distance_walked: (newer.distance_walked !== null && older.distance_walked !== null) ? newer.distance_walked - older.distance_walked : null,
        caught: (newer.caught !== null && older.caught !== null) ? newer.caught - older.caught : null,
        stop_visited: (newer.stop_visited !== null && older.stop_visited !== null) ? newer.stop_visited - older.stop_visited : null,
        level: (newer.level !== null && older.level !== null) ? newer.level - older.level : null,
        stardust: (newer.stardust !== null && newer.stardust !== undefined && older.stardust !== null && older.stardust !== undefined) ? newer.stardust - older.stardust : null
      }
    };

    if (this.compareDialog) {
      this.compareDialog.nativeElement.showModal();
    }
  }

  closeCompareDialog(): void {
    if (this.compareDialog) {
      this.compareDialog.nativeElement.close();
    }
    this.clearSelection();
  }

  onDialogClick(event: MouseEvent, dialogName: 'compare' | 'delete'): void {
    const dialogElement = dialogName === 'compare' ? this.compareDialog?.nativeElement : this.deleteConfirmDialog?.nativeElement;
    if (!dialogElement) return;

    const rect = dialogElement.getBoundingClientRect();
    const isInDialog = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );

    if (!isInDialog) {
      if (dialogName === 'compare') {
        this.closeCompareDialog();
      } else {
        this.closeDeleteDialog();
      }
    }
  }

  isStardustEntry(row: any): boolean {
    return row && row.stardust != null && row.level == null && (row.total_xp == null || row.total_xp === 0);
  }

  formatDate(dateStr: string): string {
    // Bare datetime strings from the DB (e.g. "2026-06-16 11:15:43" or
    // "2026-06-16T11:15:43") have no timezone suffix and are treated as
    // *local* time by Date(), causing a 6-hour offset for UTC-stored values.
    // Normalize to UTC by appending 'Z' when there's no timezone indicator.
    const normalized = /[Zz]|[+-]\d{2}:?\d{2}$/.test(dateStr)
      ? dateStr
      : dateStr.replace(' ', 'T') + 'Z';
    return new Date(normalized).toLocaleString();
  }

  getDisplayDistance(distance: any, unit: string | null): string {
    if (distance === null || distance === undefined || distance === '') return '—';
    const numDistance = Number(distance);
    if (isNaN(numDistance)) return String(distance);
    
    if (unit === 'mi') {
      return (numDistance * 0.621371).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' mi';
    }
    return numDistance.toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' km';
  }

  preventInvalidChars(event: KeyboardEvent, allowDecimal: boolean = false): void {
    // Allow navigation and editing keys
    if (['Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete'].includes(event.key)) {
      return;
    }
    
    // Ctrl/Cmd + A, C, V, X etc.
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === '.' && allowDecimal) {
      const input = event.target as HTMLInputElement;
      if (input.value.includes('.')) {
        event.preventDefault();
      }
      return;
    }

    // Only allow digits
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }
}
