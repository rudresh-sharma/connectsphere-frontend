import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated', 'getHomeRoute']);

    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });
  });

  it('shows guest actions for unauthenticated users', () => {
    authServiceSpy.isAuthenticated.and.returnValue(false);

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isAuthenticated).toBeFalse();
    expect(component.primaryRoute).toBe('/dashboard');
    expect(component.primaryLabel).toBe('Open guest mode');
    expect(component.tertiaryRoute).toBe('/register');
    expect(component.tertiaryLabel).toBe('Create an account');
    expect(component.ctaSecondaryRoute).toBe('/register');
    expect(component.ctaSecondaryLabel).toBe('Create your account');
    expect(fixture.nativeElement.textContent).toContain('Open guest mode');
    expect(fixture.nativeElement.textContent).toContain('Log in');
    expect(fixture.nativeElement.textContent).toContain('Create an account');
  });

  it('uses the authenticated home route when a session exists', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    authServiceSpy.getHomeRoute.and.returnValue('/dashboard');

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;

    expect(component.isAuthenticated).toBeTrue();
    expect(component.primaryRoute).toBe('/dashboard');
    expect(component.primaryLabel).toBe('Open your feed');
    expect(component.tertiaryRoute).toBe('/search');
    expect(component.tertiaryLabel).toBe('Explore');
  });

  it('supports admin users by surfacing the admin home route', () => {
    authServiceSpy.isAuthenticated.and.returnValue(true);
    authServiceSpy.getHomeRoute.and.returnValue('/admin');

    const fixture = TestBed.createComponent(LandingComponent);
    const component = fixture.componentInstance;

    expect(component.primaryRoute).toBe('/admin');
    expect(component.primaryLabel).toBe('Open your feed');
    expect(component.ctaSecondaryRoute).toBe('/search');
    expect(component.ctaSecondaryLabel).toBe('See what people are sharing');
  });
});
