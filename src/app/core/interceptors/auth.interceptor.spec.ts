import { HttpRequest, HttpResponse } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { lastValueFrom, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AuthService]
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function createJwt(expiresAtMs: number): string {
    const base64UrlEncode = (value: string): string =>
      btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

    return [
      base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
      base64UrlEncode(JSON.stringify({ sub: 'connectsphere', exp: Math.floor(expiresAtMs / 1000) })),
      'signature'
    ].join('.');
  }

  it('adds the bearer token to protected backend requests', async () => {
    localStorage.setItem('accessToken', createJwt(Date.now() + 3_600_000));
    localStorage.setItem('accessTokenExpiresAt', String(Date.now() + 3_600_000));
    const request = new HttpRequest<null>('GET', 'http://localhost:8081/posts');
    let forwardedRequest: HttpRequest<unknown> | undefined;

    await lastValueFrom(
      TestBed.runInInjectionContext(() =>
        authInterceptor(request, (nextRequest) => {
          forwardedRequest = nextRequest as HttpRequest<unknown>;
          return of(new HttpResponse({ status: 200 }));
        })
      )
    );

    expect(forwardedRequest).toBeDefined();
    expect(forwardedRequest!.headers.get('Authorization')).toBe(localStorage.getItem('accessToken') ? `Bearer ${localStorage.getItem('accessToken')}` : null);
  });

  it('does not add the bearer token to public auth endpoints', async () => {
    localStorage.setItem('accessToken', createJwt(Date.now() + 3_600_000));
    localStorage.setItem('accessTokenExpiresAt', String(Date.now() + 3_600_000));
    const request = new HttpRequest<null>('POST', 'http://localhost:8080/auth/login', null);
    let forwardedRequest: HttpRequest<unknown> | undefined;

    await lastValueFrom(
      TestBed.runInInjectionContext(() =>
        authInterceptor(request, (nextRequest) => {
          forwardedRequest = nextRequest as HttpRequest<unknown>;
          return of(new HttpResponse({ status: 200 }));
        })
      )
    );

    expect(forwardedRequest).toBeDefined();
    expect(forwardedRequest!.headers.has('Authorization')).toBeFalse();
  });

  it('leaves non-backend requests unchanged', async () => {
    localStorage.setItem('accessToken', createJwt(Date.now() + 3_600_000));
    localStorage.setItem('accessTokenExpiresAt', String(Date.now() + 3_600_000));
    const request = new HttpRequest<null>('GET', 'https://example.com/public-feed');
    let forwardedRequest: HttpRequest<unknown> | undefined;

    await lastValueFrom(
      TestBed.runInInjectionContext(() =>
        authInterceptor(request, (nextRequest) => {
          forwardedRequest = nextRequest as HttpRequest<unknown>;
          return of(new HttpResponse({ status: 200 }));
        })
      )
    );

    expect(forwardedRequest).toBeDefined();
    expect(forwardedRequest!.headers.has('Authorization')).toBeFalse();
  });

  it('refreshes a nearly expired token before sending a protected request', async () => {
    const expiringToken = createJwt(Date.now() + 20_000);
    const refreshedToken = createJwt(Date.now() + 3_600_000);
    localStorage.setItem('accessToken', expiringToken);
    localStorage.setItem('accessTokenExpiresAt', String(Date.now() + 20_000));
    localStorage.setItem('currentUser', JSON.stringify({
      userId: 1,
      username: 'connectsphere',
      email: 'user@example.com',
      fullName: 'Connect Sphere',
      bio: null,
      profilePicUrl: null,
      role: 'USER',
      provider: 'LOCAL',
      providerId: null,
      active: true,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    }));
    const request = new HttpRequest<null>('GET', 'http://localhost:8081/posts');
    let forwardedRequest: HttpRequest<unknown> | undefined;

    const responsePromise = lastValueFrom(TestBed.runInInjectionContext(() =>
      authInterceptor(request, (nextRequest) => {
        forwardedRequest = nextRequest as HttpRequest<unknown>;
        return of(new HttpResponse({ status: 200 }));
      })
    ));

    const refreshRequest = httpMock.expectOne('http://localhost:8080/auth/refresh');
    expect(refreshRequest.request.headers.get('Authorization')).toBe(`Bearer ${expiringToken}`);
    refreshRequest.flush({
      accessToken: refreshedToken,
      tokenType: 'Bearer',
      expiresInSeconds: 3600,
      user: JSON.parse(localStorage.getItem('currentUser') ?? '{}')
    });

    await responsePromise;

    expect(forwardedRequest).toBeDefined();
    expect(forwardedRequest!.headers.get('Authorization')).toBe(`Bearer ${refreshedToken}`);
  });
});
