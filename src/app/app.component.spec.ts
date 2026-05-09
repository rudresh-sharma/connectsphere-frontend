import { BehaviorSubject, of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from './core/services/auth.service';
import { NavigationHistoryService } from './core/services/navigation-history.service';
import { User } from './shared/models/auth.models';

describe('AppComponent', () => {
  const currentUser$ = new BehaviorSubject<User | null>(null);
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated', 'isAdmin', 'getHomeRoute', 'syncCurrentUser'], {
      currentUser$: currentUser$.asObservable()
    });
    authServiceSpy.syncCurrentUser.and.returnValue(of({} as User));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: NavigationHistoryService, useValue: {} }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  it('shows the top brand for guests on public routes', () => {
    authServiceSpy.isAuthenticated.and.returnValue(false);
    authServiceSpy.isAdmin.and.returnValue(false);
    spyOnProperty(router, 'url', 'get').and.returnValue('/');

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;

    expect(component.showTopBrand).toBeTrue();
    expect(component.showDesktopSidebar).toBeFalse();
    expect(component.showMobileNav).toBeFalse();
    expect(component.homeRoute).toBe('/');
    expect(authServiceSpy.syncCurrentUser).not.toHaveBeenCalled();
  });

  it('hides guest chrome on auth pages', () => {
    authServiceSpy.isAuthenticated.and.returnValue(false);
    authServiceSpy.isAdmin.and.returnValue(false);
    spyOnProperty(router, 'url', 'get').and.returnValue('/login');

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;

    expect(component.showTopBrand).toBeFalse();
  });

  it('shows authenticated navigation on app routes', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    authServiceSpy.isAdmin.and.returnValue(false);
    authServiceSpy.getHomeRoute.and.returnValue('/dashboard');
    spyOnProperty(router, 'url', 'get').and.returnValue('/dashboard');

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.showDesktopSidebar).toBeTrue();
    expect(component.showMobileNav).toBeTrue();
    expect(component.showTopBrand).toBeFalse();
    expect(component.homeRoute).toBe('/dashboard');
    expect(authServiceSpy.syncCurrentUser).toHaveBeenCalled();
  });

  it('evaluates admin query-string views correctly', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    authServiceSpy.isAdmin.and.returnValue(true);
    authServiceSpy.getHomeRoute.and.returnValue('/admin');
    spyOnProperty(router, 'url', 'get').and.returnValue('/admin?view=notifications');

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;

    expect(component.isActiveAdminView('notifications')).toBeTrue();
    expect(component.isActiveAdminView('overview')).toBeFalse();
  });

  it('keeps the shell stable when sidebar profile sync fails', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    authServiceSpy.isAdmin.and.returnValue(false);
    authServiceSpy.getHomeRoute.and.returnValue('/dashboard');
    authServiceSpy.syncCurrentUser.and.returnValue(throwError(() => new Error('sync failed')));
    spyOnProperty(router, 'url', 'get').and.returnValue('/dashboard');

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(component.showDesktopSidebar).toBeTrue();
  });
});
