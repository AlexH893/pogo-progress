import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService]
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  function createMockJwt(expired: boolean): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const exp = expired ? Math.floor(Date.now() / 1000) - 3600 : Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ exp, googleId: '123' }));
    return `${header}.${payload}.signature`;
  }

  it('should be created', () => {
    service = TestBed.inject(AuthService);
    expect(service).toBeTruthy();
  });

  it('should restore session if token is valid', (done) => {
    const validToken = createMockJwt(false);
    const mockUser = { googleId: '123', email: 'test@test.com', name: 'Test' };
    
    localStorage.setItem('auth_token', validToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    // Service initialization calls restoreSession()
    service = TestBed.inject(AuthService);

    service.user$.subscribe(user => {
      expect(user).toEqual(mockUser);
      done();
    });
  });

  it('should sign out automatically if token is expired on load', (done) => {
    const expiredToken = createMockJwt(true);
    const mockUser = { googleId: '123', email: 'test@test.com', name: 'Test' };
    
    localStorage.setItem('auth_token', expiredToken);
    localStorage.setItem('auth_user', JSON.stringify(mockUser));

    // Service initialization calls restoreSession()
    service = TestBed.inject(AuthService);

    service.user$.subscribe(user => {
      expect(user).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
      done();
    });
  });
});
