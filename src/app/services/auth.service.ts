import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { getApiUrl, getGoogleClientId } from '../config';

declare var google: any;

export interface AuthUser {
  googleId: string;
  email: string;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSubject = new BehaviorSubject<AuthUser | null>(null);
  public user$: Observable<AuthUser | null> = this.userSubject.asObservable();
  private initialized = false;
  
  constructor(private http: HttpClient, private ngZone: NgZone) {
    this.restoreSession();

    // Allow Cypress to mock auth
    if ((window as any).Cypress) {
      (window as any).mockAuth = (user: AuthUser, token: string) => {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
        this.userSubject.next(user);
      };
    }
  }

  private restoreSession() {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');
    if (token && userStr) {
      try {
        // Check if token is expired
        const payloadStr = atob(token.split('.')[1]);
        const payload = JSON.parse(payloadStr);
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          this.signOut();
          return;
        }

        const user = JSON.parse(userStr);
        this.userSubject.next(user);
      } catch (e) {
        this.signOut();
      }
    }
  }

  public renderSignInButton(elementId: string, type: 'standard' | 'icon' = 'standard') {
    if (typeof google === 'undefined') {
      // Retry in 100ms if script hasn't loaded yet
      setTimeout(() => this.renderSignInButton(elementId, type), 100);
      return;
    }

    if (!this.initialized) {
      google.accounts.id.initialize({
        client_id: getGoogleClientId(),
        callback: (response: any) => this.handleCredentialResponse(response)
      });
      this.initialized = true;
    }

    const el = document.getElementById(elementId);
    if (el) {
      google.accounts.id.renderButton(
        el,
        { theme: "filled_black", size: "large", type: type, shape: type === 'icon' ? "circle" : "pill" }
      );
    }
  }

  public promptSignIn() {
    if (typeof google === 'undefined') {
      setTimeout(() => this.promptSignIn(), 100);
      return;
    }
    
    // Ensure initialized before prompting
    if (!this.initialized) {
      google.accounts.id.initialize({
        client_id: getGoogleClientId(),
        callback: (response: any) => this.handleCredentialResponse(response)
      });
      this.initialized = true;
    }
    
    google.accounts.id.prompt();
  }

  private handleCredentialResponse(response: any) {
    this.ngZone.run(() => {
      this.http.post<{token: string, user: AuthUser}>(`${getApiUrl()}/auth/google`, {
        credential: response.credential
      }).subscribe({
        next: (res) => {
          localStorage.setItem('auth_token', res.token);
          localStorage.setItem('auth_user', JSON.stringify(res.user));
          this.userSubject.next(res.user);
        },
        error: (err) => {
          console.error('Google sign-in error on backend', err);
        }
      });
    });
  }

  public signOut() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this.userSubject.next(null);
  }

  public getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
}
