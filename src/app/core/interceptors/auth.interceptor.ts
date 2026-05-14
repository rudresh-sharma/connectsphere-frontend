import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

const API_BASE_URLS = environment.backendApiUrls;

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
  const isRefreshRequest = request.url.includes('/auth/refresh');
  const isPublicAuthRequest = PUBLIC_AUTH_PATHS.some((path) => request.url.includes(path));

  if (isRefreshRequest) {
    return token ? next(withAuthorization(request, token)) : next(request);
  }

  if (!token || !isBackendApiRequest || isPublicAuthRequest) {
    return next(request);
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
