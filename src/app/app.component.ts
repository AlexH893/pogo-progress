import { Component, OnInit } from '@angular/core';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  user$ = this.authService.user$;

  constructor(public authService: AuthService) {}

  ngOnInit() {
    this.user$.subscribe(user => {
      if (!user) {
        // Delay slightly to ensure the *ngIf guestMode template has rendered in the DOM
        setTimeout(() => {
          this.authService.renderSignInButton('google-signin-btn', 'icon');
        }, 0);
      }
    });
  }

  signOut() {
    this.authService.signOut();
  }
}
