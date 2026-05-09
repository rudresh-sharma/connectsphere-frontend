import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AuthResponse, User } from '../../shared/models/auth.models';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const mockUser: User = {
    userId: 7,
    username: 'connectsphere',
    email: 'user@example.com',
    fullName: 'Connect Sphere',
    bio: 'Hello there',
    profilePicUrl: null,
    role: 'USER',
    provider: 'LOCAL',
    providerId: null,
    active: true,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z'
  };

  const mockAuthResponse: AuthResponse = {
    accessToken: 'header.payload.signature',
    tokenType: 'Bearer',
    expiresInSeconds: 3600,
    user: mockUser
  };

  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AuthService]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  function createJwt(expiresAtMs: number): string {
    const base64UrlEncode = (value: string): string =>
      btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

    return [
      base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
      base64UrlEncode(JSON.stringify({ sub: mockUser.username, exp: Math.floor(expiresAtMs / 1000) })),
      'signature'
    ].join('.');
  }

  it('persists the user session after a successful login', () => {
    let responseBody: AuthResponse | undefined;

    service.login({ emailOrUsername: 'user@example.com', password: 'secret' }).subscribe((response) => {
      responseBody = response;
    });

    const request = httpMock.expectOne('http://localhost:8080/auth/login');
    expect(request.request.method).toBe('POST');
    request.flush(mockAuthResponse);

    expect(responseBody).toEqual(mockAuthResponse);
    expect(localStorage.getItem('accessToken')).toBe(mockAuthResponse.accessToken);
    expect(Number(localStorage.getItem('accessTokenExpiresAt'))).toBeGreaterThan(Date.now());
    expect(service.getCurrentUser()).toEqual(mockUser);
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('surfaces invalid login credentials instead of a session-expired message', () => {
    let receivedError: Error | undefined;

    service.login({ emailOrUsername: 'user@example.com', password: 'wrong-password' }).subscribe({
      error: (error: Error) => {
        receivedError = error;
      }
    });

    const request = httpMock.expectOne('http://localhost:8080/auth/login');
    expect(request.request.method).toBe('POST');
    request.flush(
      { message: 'Invalid credentials' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(receivedError?.message).toBe('Invalid credentials');
  });

  it('returns the correct home route for admin and regular users', () => {
    service.saveUser({ ...mockUser, role: 'ADMIN' });
    expect(service.getHomeRoute()).toBe('/admin');

    service.saveUser({ ...mockUser, role: 'USER' });
    expect(service.getHomeRoute()).toBe('/dashboard');
  });

  it('clears both browser storages on logout', () => {
    localStorage.setItem('accessToken', 'token');
    localStorage.setItem('currentUser', JSON.stringify(mockUser));
    sessionStorage.setItem('accessToken', 'token');
    sessionStorage.setItem('currentUser', JSON.stringify(mockUser));

    service.logout();

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('currentUser')).toBeNull();
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(sessionStorage.getItem('currentUser')).toBeNull();
    expect(service.getCurrentUser()).toBeNull();
  });

  it('updates the current user from a public profile payload', () => {
    service.saveUser(mockUser);

    service.updateCurrentUserFromProfile({
      userId: mockUser.userId,
      username: 'updated-user',
      fullName: 'Updated Name',
      profilePicUrl: 'https://cdn.example.com/avatar.png'
    });

    const updatedUser = service.getCurrentUser();
    expect(updatedUser?.username).toBe('updated-user');
    expect(updatedUser?.fullName).toBe('Updated Name');
    expect(updatedUser?.profilePicUrl).toBe('https://cdn.example.com/avatar.png');
  });

  it('refreshes the token when the current session is close to expiring', () => {
    const expiringToken = createJwt(Date.now() + 30_000);
    const refreshedToken = createJwt(Date.now() + 3_600_000);
    localStorage.setItem('accessToken', expiringToken);
    localStorage.setItem('accessTokenExpiresAt', String(Date.now() + 30_000));
    localStorage.setItem('currentUser', JSON.stringify(mockUser));

    let resolvedToken: string | null | undefined;
    service.ensureValidToken().subscribe((token) => {
      resolvedToken = token;
    });

    const request = httpMock.expectOne('http://localhost:8080/auth/refresh');
    expect(request.request.method).toBe('POST');
    request.flush({
      ...mockAuthResponse,
      accessToken: refreshedToken,
      expiresInSeconds: 3600
    });

    expect(resolvedToken).toBe(refreshedToken);
    expect(localStorage.getItem('accessToken')).toBe(refreshedToken);
    expect(Number(localStorage.getItem('accessTokenExpiresAt'))).toBeGreaterThan(Date.now() + 3_500_000);
  });

  it('clears an expired token instead of treating it as authenticated', () => {
    localStorage.setItem('accessToken', createJwt(Date.now() - 5_000));
    localStorage.setItem('accessTokenExpiresAt', String(Date.now() - 5_000));
    localStorage.setItem('currentUser', JSON.stringify(mockUser));

    expect(service.getToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('currentUser')).toBeNull();
  });
});
