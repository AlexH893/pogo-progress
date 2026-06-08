import { Component, OnInit } from '@angular/core';
import { SettingsService, UserPreferences } from './settings.service';
import { AuthService } from '../services/auth.service';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {

  preferences: UserPreferences[] = [];
  isLoading = true;
  error = '';
  successMsg = '';

  constructor(
    private settingsService: SettingsService,
    public authService: AuthService
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
      next: (prefs) => {
        this.preferences = prefs;
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
    if (confirm(`Are you sure you want to unlink the trainer "${username}" from your account? You will no longer be able to edit these stats.`)) {
      this.settingsService.unlinkTrainer(username).subscribe({
        next: () => {
          this.preferences = this.preferences.filter(p => p.username !== username);
          this.successMsg = `Unlinked ${username}`;
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
        },
        error: (err) => {
          this.error = 'Failed to delete account.';
          console.error(err);
        }
      });
    }
  }
}
