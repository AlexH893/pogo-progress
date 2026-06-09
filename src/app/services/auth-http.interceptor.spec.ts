import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthHttpInterceptor } from './auth-http.interceptor';
import { AuthService } from './auth.service';

describe('AuthHttpInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    const spy = jasmine.createSpyObj('AuthService', ['getToken', 'signOut']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: spy },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthHttpInterceptor,
          multi: true,
        },
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
    authServiceSpy = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add Authorization header if token exists', () => {
    authServiceSpy.getToken.and.returnValue('mock-token');

    httpClient.get('http://api.example.com/data').subscribe();

    const req = httpMock.expectOne('http://api.example.com/data');
    expect(req.request.headers.has('Authorization')).toBeTrue();
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
    req.flush({});
  });

  it('should not add Authorization header if no token', () => {
    authServiceSpy.getToken.and.returnValue(null);

    httpClient.get('http://api.example.com/data').subscribe();

    const req = httpMock.expectOne('http://api.example.com/data');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('should call signOut when receiving 401 Unauthorized', () => {
    authServiceSpy.getToken.and.returnValue('mock-token');

    httpClient.get('http://api.example.com/data').subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(401);
      }
    });

    const req = httpMock.expectOne('http://api.example.com/data');
    
    // Simulate a 401 response from the server
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.signOut).toHaveBeenCalled();
  });

  it('should not call signOut for other errors like 500', () => {
    authServiceSpy.getToken.and.returnValue('mock-token');

    httpClient.get('http://api.example.com/data').subscribe({
      error: (err: HttpErrorResponse) => {
        expect(err.status).toBe(500);
      }
    });

    const req = httpMock.expectOne('http://api.example.com/data');
    
    // Simulate a 500 response
    req.flush('Internal Server Error', { status: 500, statusText: 'Server Error' });

    expect(authServiceSpy.signOut).not.toHaveBeenCalled();
  });
});
