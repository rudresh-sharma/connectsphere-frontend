import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import {
  ApiError,
  AuthResponse,
  LoginRequest,
  OAuthCompleteRequest,
  PublicUser,
  RegisterRequest,
  UpdateProfileRequest,
  User,
  UsernameAvailabilityResponse
} from '../../shared/models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/auth';
  private readonly googleOAuthUrl = 'http://localhost:8080/oauth2/authorization/google';
  private readonly githubOAuthUrl = 'http://localhost:8080/oauth2/authorization/github';
  private readonly tokenKey = 'accessToken';
  private readonly tokenExpiryKey = 'accessTokenExpiresAt';
  private readonly userKey = 'currentUser';
  private readonly tokenRefreshThresholdMs = 60_000;
  private readonly currentUserSubject = new BehaviorSubject<User | null>(this.getCurrentUser());
  private refreshInFlight$: Observable<string | null> | null = null;

  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly isAdmin$ = this.currentUser$.pipe(map((user) => user?.role === 'ADMIN'));

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request).pipe(
      tap((response) => this.persistSession(response)),
      catchError((error) => this.handleError(error))
    );
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap((response) => this.persistSession(response)),
      catchError((error) => this.handleError(error, { treat401AsSessionExpired: false }))
    );
  }

  completeOAuthSignup(request: OAuthCompleteRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/oauth/complete`, request).pipe(
      tap((response) => this.persistSession(response)),
      catchError((error) => this.handleError(error))
    );
  }

  checkUsernameAvailability(username: string): Observable<UsernameAvailabilityResponse> {
    return this.http
      .get<UsernameAvailabilityResponse>(`${this.apiUrl}/username-available`, {
        params: { username }
      })
      .pipe(catchError((error) => this.handleError(error)));
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.tokenExpiryKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem('connectsphere_access_token');
    localStorage.removeItem('connectsphere_user');
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.tokenExpiryKey);
    sessionStorage.removeItem(this.userKey);
    sessionStorage.removeItem('connectsphere_access_token');
    sessionStorage.removeItem('connectsphere_user');
    this.currentUserSubject.next(null);
  }

  startGoogleLogin(): void {
    window.location.href = this.googleOAuthUrl;
  }

  startGithubLogin(): void {
    window.location.href = this.githubOAuthUrl;
  }

  saveToken(token: string, expiresInSeconds?: number): void {
    localStorage.setItem(this.tokenKey, token);
    const expiresAt = this.resolveTokenExpiry(token, expiresInSeconds);

    if (expiresAt) {
      localStorage.setItem(this.tokenExpiryKey, String(expiresAt));
    } else {
      localStorage.removeItem(this.tokenExpiryKey);
    }
  }

  saveUser(user: User): void {
    this.persistUser(user);
  }

  updateCurrentUserFromProfile(profile: User | PublicUser): void {
    const currentUser = this.getCurrentUser();
    const now = new Date().toISOString();
    const mergedUser: User = {
      userId: profile.userId ?? currentUser?.userId ?? 0,
      username: profile.username ?? currentUser?.username ?? 'user',
      email: profile.email ?? currentUser?.email ?? '',
      fullName: profile.fullName ?? currentUser?.fullName ?? profile.username ?? 'User',
      bio: profile.bio ?? currentUser?.bio ?? null,
      profilePicUrl: profile.profilePicUrl ?? currentUser?.profilePicUrl ?? null,
      role: profile.role ?? currentUser?.role ?? 'USER',
      provider: profile.provider ?? currentUser?.provider ?? 'OAUTH',
      providerId: profile.providerId ?? currentUser?.providerId ?? null,
      active: profile.active ?? currentUser?.active ?? true,
      createdAt: profile.createdAt ?? currentUser?.createdAt ?? now,
      updatedAt: profile.updatedAt ?? currentUser?.updatedAt ?? now
    };

    this.persistUser(mergedUser);
  }

  persistOAuthToken(token: string): User {
    const previousUser = this.getCurrentUser();
    this.saveToken(token);
    const user = this.createUserFromToken(token, previousUser);
    this.persistUser(user);
    return user;
  }

  getProfile(): Observable<User> {
    return this.http.get<User | AuthResponse>(`${this.apiUrl}/profile`).pipe(
      map((response) => ('user' in response ? response.user : response)),
      tap((user) => this.persistUser(user)),
      catchError((error) => this.handleError(error))
    );
  }

  syncCurrentUser(): Observable<User> {
    return this.getProfile().pipe(
      catchError((error: Error & { status?: number }) => {
        const currentUser = this.getCurrentUser();
        if (currentUser && error.status && error.status >= 500) {
          return of(currentUser);
        }
        return throwError(() => error);
      })
    );
  }

  getPublicUser(userId: number): Observable<PublicUser> {
    return this.http
      .get<PublicUser>(`${this.apiUrl}/users/${userId}`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  updateProfile(request: UpdateProfileRequest): Observable<User> {
    return this.http.put<User | AuthResponse>(`${this.apiUrl}/profile`, request).pipe(
      tap((userOrResponse) => {
        if ('user' in userOrResponse) {
          this.persistSession(userOrResponse);
        } else {
          this.persistUser(userOrResponse);
        }
      }),
      map((response) => ('user' in response ? response.user : response)),
      catchError((error) => this.handleError(error))
    );
  }

  deleteAccount(): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/account`)
      .pipe(catchError((error) => this.handleError(error)));
  }

  uploadProfilePicture(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<User | AuthResponse>(`${this.apiUrl}/profile-picture`, formData).pipe(
      tap((userOrResponse) => {
        if ('user' in userOrResponse) {
          this.persistSession(userOrResponse);
        } else {
          this.persistUser(userOrResponse);
        }
      }),
      map((response) => ('user' in response ? response.user : response)),
      catchError((error) => this.handleError(error))
    );
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'ADMIN';
  }

  getHomeRoute(): '/admin' | '/dashboard' {
    return this.isAdmin() ? '/admin' : '/dashboard';
  }

  getToken(): string | null {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) {
      return null;
    }

    const expiresAt = this.getTokenExpiry();
    if (expiresAt !== null && expiresAt <= Date.now()) {
      this.logout();
      return null;
    }

    return token;
  }

  ensureValidToken(): Observable<string | null> {
    const token = this.getToken();
    if (!token) {
      return of(null);
    }

    const expiresAt = this.getTokenExpiry();
    if (expiresAt === null) {
      return of(token);
    }

    const remainingMs = expiresAt - Date.now();

    if (remainingMs <= 0) {
      this.logout();
      return of(null);
    }

    if (remainingMs > this.tokenRefreshThresholdMs) {
      return of(token);
    }

    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, {}).pipe(
        tap((response) => this.persistSession(response)),
        map((response) => response.accessToken),
        catchError((error) => this.handleError(error)),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1)
      );
    }

    return this.refreshInFlight$;
  }

  getCurrentUser(): User | null {
    const storedUser = localStorage.getItem(this.userKey);

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser) as User;
    } catch {
      localStorage.removeItem(this.userKey);
      return null;
    }
  }

  rememberIdentity(identity: string): void {
    localStorage.setItem('connectsphere_remembered_identity', identity);
  }

  clearRememberedIdentity(): void {
    localStorage.removeItem('connectsphere_remembered_identity');
  }

  getRememberedIdentity(): string {
    return localStorage.getItem('connectsphere_remembered_identity') ?? '';
  }

  private persistSession(response: AuthResponse): void {
    if (!response?.accessToken || !response?.user) {
      return;
    }

    this.saveToken(response.accessToken, response.expiresInSeconds);
    this.persistUser(response.user);
  }

  private persistUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private createUserFromToken(token: string, previousUser: User | null = null): User {
    const claims = this.decodeJwtPayload(token);
    const now = new Date().toISOString();
    const username = this.toStringClaim(claims['sub']) || this.toStringClaim(claims['email']) || 'user';
    const userId = this.toNumberClaim(claims['userId']);
    const email = this.toStringClaim(claims['email']) || '';
    const canReusePreviousUser = Boolean(
      previousUser &&
        ((userId && previousUser.userId === userId) ||
          (email && previousUser.email?.trim().toLowerCase() === email.trim().toLowerCase()) ||
          (username && previousUser.username?.trim().toLowerCase() === username.trim().toLowerCase()))
    );

    return {
      userId,
      username,
      email,
      fullName: canReusePreviousUser ? previousUser?.fullName || username : username,
      bio: canReusePreviousUser ? previousUser?.bio ?? null : null,
      profilePicUrl: canReusePreviousUser ? previousUser?.profilePicUrl ?? null : null,
      role: this.toStringClaim(claims['role']) || 'USER',
      provider: canReusePreviousUser ? previousUser?.provider || 'OAUTH' : 'OAUTH',
      providerId: canReusePreviousUser ? previousUser?.providerId ?? null : null,
      active: canReusePreviousUser ? previousUser?.active ?? true : true,
      createdAt: canReusePreviousUser ? previousUser?.createdAt || now : now,
      updatedAt: canReusePreviousUser ? previousUser?.updatedAt || now : now
    };
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
    const payload = token.split('.')[1];
    if (!payload) {
      return {};
    }

    try {
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
      return JSON.parse(atob(padded)) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private toStringClaim(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private toNumberClaim(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private getTokenExpiry(): number | null {
    const storedExpiry = localStorage.getItem(this.tokenExpiryKey);
    if (storedExpiry) {
      const parsed = Number(storedExpiry);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
      localStorage.removeItem(this.tokenExpiryKey);
    }

    const token = localStorage.getItem(this.tokenKey);
    if (!token) {
      return null;
    }

    const fallbackExpiry = this.getJwtExpiry(token);
    if (fallbackExpiry) {
      localStorage.setItem(this.tokenExpiryKey, String(fallbackExpiry));
    }
    return fallbackExpiry;
  }

  private resolveTokenExpiry(token: string, expiresInSeconds?: number): number | null {
    if (typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0) {
      return Date.now() + expiresInSeconds * 1000;
    }

    return this.getJwtExpiry(token);
  }

  private getJwtExpiry(token: string): number | null {
    const exp = this.toNumberClaim(this.decodeJwtPayload(token)['exp']);
    return exp > 0 ? exp * 1000 : null;
  }

  private handleError(
    error: HttpErrorResponse,
    options: { treat401AsSessionExpired?: boolean } = {}
  ): Observable<never> {
    const apiError = error.error as ApiError | string | null;
    let message = 'Something went wrong. Please try again.';
    const treat401AsSessionExpired = options.treat401AsSessionExpired ?? true;

    if (error.status === 401 && treat401AsSessionExpired) {
      this.logout();
      message = 'Your session has expired. Please sign in again.';
      const sessionError = new Error(message) as Error & { status?: number };
      sessionError.status = error.status;
      return throwError(() => sessionError);
    }

    if (typeof apiError === 'string' && apiError.trim()) {
      message = apiError;
    } else if (apiError && typeof apiError === 'object') {
      const validationMessage = this.formatValidationErrors(apiError.validationErrors ?? apiError.errors);

      if (validationMessage) {
        message = validationMessage;
      } else if (apiError.message) {
        message = apiError.message;
      } else if (apiError.error) {
        message = apiError.error;
      } else if (apiError.details) {
        message = apiError.details;
      }
    } else if (error.message) {
      message = error.message;
    }

    const requestError = new Error(message) as Error & { status?: number };
    requestError.status = error.status;
    return throwError(() => requestError);
  }

  private formatValidationErrors(validationErrors?: Record<string, string | string[]>): string {
    if (!validationErrors) {
      return '';
    }

    return Object.entries(validationErrors)
      .flatMap(([field, value]) => {
        const messages = Array.isArray(value) ? value : [value];
        return messages.map((fieldError) => `${this.humanizeField(field)}: ${fieldError}`);
      })
      .join('\n');
  }

  private humanizeField(field: string): string {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (letter) => letter.toUpperCase());
  }
}
