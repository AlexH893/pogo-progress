import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { getApiUrl } from '../config';
import { AuthService } from './auth.service';

@Injectable()
export class AuthHttpInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    const apiUrl = getApiUrl();
    
    // Check if the request is an API request
    const isApiUrl = request.url.startsWith('/') ||
                     (!!apiUrl && request.url.startsWith(apiUrl)) ||
                     request.url.includes('localhost') ||
                     request.url.includes('127.0.0.1');
    if (token && isApiUrl) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
    
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Token is likely expired or invalid
          this.authService.signOut();
        }
        return throwError(() => error);
      })
    );
  }
}
