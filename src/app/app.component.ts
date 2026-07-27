import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  user$ = this.authService.user$;
  isDarkMode = false;

  constructor(
    public authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Restore saved theme preference
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        this.isDarkMode = true;
        document.documentElement.setAttribute('data-theme', 'dark');
      }

      this.user$.subscribe(user => {
        if (!user) {
          setTimeout(() => {
            this.authService.renderSignInButton('google-signin-btn', 'icon');
          }, 0);
        }
      });
    }
  }

  signOut() {
    this.authService.signOut();
  }

  toggleDarkMode() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }
}
