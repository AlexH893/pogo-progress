import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsService, UserPreferences } from './settings.service';
import { AuthService } from '../services/auth.service';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {

  preference: UserPreferences | null = null;
  isLoading = true;
  error = '';
  successMsg = '';

  constructor(
    private settingsService: SettingsService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.authService.getToken()) {
      this.loadPreferences();
    } else {
      this.isLoading = false;
      this.error = 'Please sign in to view settings.';
    }
  }

  loadPreferences(): void {
    this.isLoading = true;
    this.settingsService.getUserPreferences().subscribe({
      next: (pref) => {
        this.preference = pref;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Failed to load preferences.';
        this.isLoading = false;
        console.error(err);
      }
    });
  }

  savePreferences(pref: UserPreferences): void {
    this.settingsService.updateUserPreferences(pref.username, pref.default_unit, pref.show_fun_facts).subscribe({
      next: () => {
        this.successMsg = `Settings saved for ${pref.username}`;
        setTimeout(() => this.successMsg = '', 3000);
      },
      error: (err) => {
        this.error = 'Failed to save settings.';
        console.error(err);
      }
    });
  }

  exportData(): void {
    this.settingsService.exportData().subscribe({
      next: (data) => {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        saveAs(blob, 'pogo-progress-data.json');
      },
      error: (err) => {
        this.error = 'Failed to export data.';
        console.error(err);
      }
    });
  }

  unlinkTrainer(username: string): void {
    if (confirm(`Are you sure you want to unlink your trainer from your account? You will no longer be able to edit these stats.`)) {
      this.settingsService.unlinkTrainer(username).subscribe({
        next: () => {
          this.preference = null;
          this.successMsg = `Unlinked trainer successfully.`;
          setTimeout(() => this.successMsg = '', 3000);
        },
        error: (err) => {
          this.error = 'Failed to unlink trainer.';
          console.error(err);
        }
      });
    }
  }

  deleteAccount(): void {
    if (confirm('WARNING: Are you absolutely sure you want to permanently delete all your data and unbind your account? This action cannot be undone.')) {
      this.settingsService.deleteAccount().subscribe({
        next: () => {
          this.authService.signOut();
          this.router.navigate(['/']);
        },
        error: (err) => {
          this.error = 'Failed to delete account.';
          console.error(err);
        }
      });
    }
  }
}
