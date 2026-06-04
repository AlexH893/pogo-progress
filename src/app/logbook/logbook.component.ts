import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getApiUrl } from '../config';

@Component({
  selector: 'app-logbook',
  templateUrl: './logbook.component.html',
  styleUrls: ['./logbook.component.scss']
})
export class LogbookComponent implements OnInit {
  stats: any[] = [];
  editingRowId: number | null = null;
  editData: any = {};
  isLoading = true;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(): void {
    this.isLoading = true;
    this.http.get<any[]>(`${getApiUrl()}/get-data`).subscribe({
      next: (data) => {
        this.stats = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to fetch data', err);
        this.isLoading = false;
      }
    });
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
}
