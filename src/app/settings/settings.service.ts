import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getApiUrl } from '../config';
import { Observable } from 'rxjs';

export interface UserPreferences {
  username: string;
  default_unit: 'km' | 'mi';
  show_fun_facts: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  constructor(private http: HttpClient) { }

  getUserPreferences(): Observable<UserPreferences[]> {
    return this.http.get<UserPreferences[]>(`${getApiUrl()}/user-preferences`);
  }

  updateUserPreferences(username: string, defaultUnit: 'km' | 'mi', showFunFacts: boolean): Observable<{success: boolean}> {
    return this.http.put<{success: boolean}>(`${getApiUrl()}/user-preferences/${encodeURIComponent(username)}`, {
      defaultUnit,
      showFunFacts
    });
  }

  exportData(): Observable<any[]> {
    return this.http.get<any[]>(`${getApiUrl()}/export-data`);
  }

  unlinkTrainer(username: string): Observable<{success: boolean}> {
    return this.http.delete<{success: boolean}>(`${getApiUrl()}/unlink-trainer/${encodeURIComponent(username)}`);
  }

  deleteAccount(): Observable<{success: boolean}> {
    return this.http.delete<{success: boolean}>(`${getApiUrl()}/delete-account`);
  }
}
