import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getApiUrl } from '../config';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-logbook',
  templateUrl: './logbook.component.html',
  styleUrls: ['./logbook.component.scss']
})
export class LogbookComponent implements OnInit {
  stats: any[] = [];
  chartData: any[] = [];
  primaryTrainer: string = '';
  editingRowId: number | null = null;
  editingCell: { id: number, field: string } | null = null;
  editData: any = {};
  isLoading = true;
  user$ = this.authService.user$;
  showUploadedDate: boolean = false;
  velocityStats: any = null;
  velocityLabel: string = '';

  @ViewChild('deleteConfirmDialog') deleteConfirmDialog!: ElementRef<HTMLDialogElement>;
  pendingDeleteId: number | null = null;

  constructor(private http: HttpClient, private authService: AuthService, private toastService: ToastService) {}

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(): void {
    this.isLoading = true;
    console.log('[Logbook] Fetching data...');
    this.http.get<any[]>(`${getApiUrl()}/get-data`).subscribe({
      next: (data) => {
        console.log('[Logbook] Received data:', data);
        this.stats = data;
        this.updateChartData();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('[Logbook] Failed to fetch data:', err);
        this.isLoading = false;
      }
    });
  }

  updateChartData(): void {
    if (this.stats && this.stats.length > 0) {
      const firstEntryWithUser = this.stats.find(row => row.username);
      this.primaryTrainer = firstEntryWithUser ? firstEntryWithUser.username : '';
      
      this.chartData = [...this.stats]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
      this.calculateVelocity();
    } else {
      this.chartData = [];
      this.primaryTrainer = '';
      this.velocityStats = null;
    }
  }

  calculateVelocity(): void {
    if (!this.stats || this.stats.length < 2) {
      this.velocityStats = null;
      return;
    }

    // this.stats is sorted by created_at DESC (newest first)
    const latest = this.stats[0];
    const latestTime = new Date(latest.created_at).getTime();
    
    // Target 7 days ago
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const targetTime = latestTime - sevenDaysMs;
    
    let bestEntry = this.stats[1];
    let minDiff = Math.abs(new Date(bestEntry.created_at).getTime() - targetTime);
    
    for (let i = 2; i < this.stats.length; i++) {
      const entryTime = new Date(this.stats[i].created_at).getTime();
      const diff = Math.abs(entryTime - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        bestEntry = this.stats[i];
      }
    }
    
    // If the best match is within 2 days of the 7-day target, call it "Past 7 Days"
    // Otherwise just use the immediate previous upload
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    
    if (minDiff <= twoDaysMs) {
      this.velocityLabel = 'Past 7 Days';
    } else {
      // Fallback to previous upload
      bestEntry = this.stats[1];
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

  startEdit(row: any): void {
    this.editingRowId = row.id;
    this.editData = { ...row };
  }

  cancelEdit(): void {
    this.editingRowId = null;
    this.editData = {};
  }

  saveEdit(): void {
    if (!this.editingRowId) return;
    const payload = {
      username: this.editData.username,
      level: this.editData.level,
      distanceWalked: this.editData.distance_walked,
      caught: this.editData.caught,
      stopVisited: this.editData.stop_visited,
      totalXp: this.editData.total_xp,
      entryName: this.editData.entry_name
    };

    this.http.put(`${getApiUrl()}/update-data/${this.editingRowId}`, payload).subscribe({
      next: () => {
        this.fetchData();
        this.editingRowId = null;
        this.editData = {};
      },
      error: (err) => {
        console.error('Failed to update data', err);
        this.toastService.show('Failed to save entry. Please try again.', 'error');
      }
    });
  }

  startInlineEdit(row: any, field: string): void {
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
    } else if (['level', 'total_xp', 'caught', 'stop_visited'].includes(field)) {
      parsedValue = parseInt(value, 10);
      if (isNaN(parsedValue)) parsedValue = null;
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
        this.updateChartData();
      },
      error: (err) => {
        console.error('Failed to update inline data', err);
        this.toastService.show('Failed to save edit. Changes reverted.', 'error');
        this.fetchData(); // Rollback on error
      }
    });
  }

  openDeleteDialog(id: number): void {
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
          this.fetchData();
          this.closeDeleteDialog();
        },
        error: (err) => console.error('Failed to delete data', err)
      });
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
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
