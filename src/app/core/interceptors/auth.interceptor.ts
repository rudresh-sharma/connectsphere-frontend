import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

const API_BASE_URLS = [
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:8084',
  'http://localhost:8085',
  'http://localhost:8086',
  'http://localhost:8087',
  'http://localhost:8088',
  'http://localhost:8090'
];

const PUBLIC_AUTH_PATHS = [
  '/auth/search',
  '/auth/users/',
  '/auth/register',
  '/auth/login',
  '/auth/username-available',
  '/auth/oauth/complete'
];

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const isBackendApiRequest = API_BASE_URLS.some((baseUrl) => request.url.startsWith(baseUrl));
  const isPublicAuthRequest = PUBLIC_AUTH_PATHS.some((path) => request.url.includes(path));
  const isRefreshRequest = request.url.includes('/auth/refresh');

  if (!token || !isBackendApiRequest || isPublicAuthRequest) {
    return next(request);
  }

  if (isRefreshRequest) {
    return next(withAuthorization(request, token));
  }

  return authService.ensureValidToken().pipe(
    switchMap((validToken) => next(validToken ? withAuthorization(request, validToken) : request))
  );
};

function withAuthorization(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}
