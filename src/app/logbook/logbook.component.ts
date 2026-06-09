import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getApiUrl } from '../config';
import { AuthService } from '../services/auth.service';

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
  editData: any = {};
  isLoading = true;
  user$ = this.authService.user$;

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(): void {
    this.isLoading = true;
    this.http.get<any[]>(`${getApiUrl()}/get-data`).subscribe({
      next: (data) => {
        this.stats = data;
        this.updateChartData();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to fetch data', err);
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
    } else {
      this.chartData = [];
      this.primaryTrainer = '';
    }
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
      error: (err) => console.error('Failed to update data', err)
    });
  }

  deleteEntry(id: number): void {
    if (confirm('Are you sure you want to delete this entry? This cannot be undone.')) {
      this.http.delete(`${getApiUrl()}/delete-data/${id}`).subscribe({
        next: () => {
          this.fetchData();
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
}
