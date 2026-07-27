import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { AuthService } from './auth.service';

// ---------------------------------------------------------------------------
// Bug #8 — Silent logout on malformed/corrupted JWT in restoreSession()
//
// The OLD code called atob(token.split('.')[1]) without checking whether the
// token had exactly 3 segments first, causing an unhandled exception that
// fell into catch(e) => signOut() silently.
//
// The FIX adds an explicit 3-segment check and logs a console.warn on
// corruption so it's visible in DevTools.
// ---------------------------------------------------------------------------
describe('AuthService — Bug #8: malformed JWT handling in restoreSession', () => {

  let service: AuthService;
  let httpMock: HttpTestingController;
  let warnSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    warnSpy = spyOn(console, 'warn');
  });

  afterEach(() => {
    localStorage.clear();
    httpMock.verify();
  });

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Builds a minimal valid JWT with the given payload and optional exp. */
  function buildJwt(payload: object): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body   = btoa(JSON.stringify(payload));
    const sig    = btoa('fake-signature');
    return `${header}.${body}.${sig}`;
  }

  function storeToken(token: string, user = { googleId: 'g1', email: 'a@b.com', name: 'Test' }) {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }

  // Re-creates the service so restoreSession() runs again with whatever is in localStorage.
  function reinitService() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    warnSpy.calls.reset();
    service = TestBed.inject(AuthService);
  }

  // -------------------------------------------------------------------------
  // REGRESSION: malformed (wrong segment count) token
  // -------------------------------------------------------------------------

  it('should log a console.warn and sign out when the stored token has the wrong number of segments (Bug #8 regression)', () => {
    storeToken('not.a.valid.jwt.token.with.too.many.parts');
    reinitService();

    // User should be signed out
    let user: any = 'initial';
    service.user$.subscribe(u => (user = u));
    expect(user).toBeNull();

    // The fix must emit a visible warning (not silently discard)
    expect(warnSpy).toHaveBeenCalledWith(
      jasmine.stringContaining('malformed')
    );

    // Storage should be cleared
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('should log a console.warn and sign out when the token payload is not valid base64', () => {
    // Two-segment token — fails the parts.length === 3 check
    storeToken('header.!!!notbase64!!!');
    reinitService();

    let user: any = 'initial';
    service.user$.subscribe(u => (user = u));
    expect(user).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // CORRECTNESS: expired token should sign out silently (no warn)
  // -------------------------------------------------------------------------

  it('should sign out silently (no console.warn) for a properly-formed but expired token', () => {
    const expired = buildJwt({ googleId: 'g1', exp: Math.floor(Date.now() / 1000) - 3600 }); // 1 hour ago
    storeToken(expired);
    reinitService();

    let user: any = 'initial';
    service.user$.subscribe(u => (user = u));
    expect(user).toBeNull();
    // Expired = expected, so no console.warn should be emitted
    expect(warnSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // CORRECTNESS: valid non-expired token should restore the session
  // -------------------------------------------------------------------------

  it('should restore the session for a valid non-expired token', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 86400; // 24 hours from now
    const token = buildJwt({ googleId: 'g1', exp: futureExp });
    const user = { googleId: 'g1', email: 'a@b.com', name: 'Test' };
    storeToken(token, user);
    reinitService();

    let restoredUser: any = null;
    service.user$.subscribe(u => (restoredUser = u));
    expect(restoredUser).toEqual(user);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // CORRECTNESS: corrupted auth_user JSON (valid token, bad user JSON)
  // -------------------------------------------------------------------------

  it('should warn and sign out when auth_user JSON is corrupted', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 86400;
    const token = buildJwt({ googleId: 'g1', exp: futureExp });
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', '{ this is not valid JSON }');
    reinitService();

    let user: any = 'initial';
    service.user$.subscribe(u => (user = u));
    expect(user).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      jasmine.stringContaining('corrupted'),
      jasmine.anything()
    );
  });
});
