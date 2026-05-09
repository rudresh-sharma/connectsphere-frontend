import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../shared/models/auth.models';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  const mockUser: User = {
    userId: 1,
    username: 'soumy',
    email: 'soumy@example.com',
    fullName: 'Soumya Sharif',
    bio: null,
    profilePicUrl: null,
    role: 'USER',
    provider: 'LOCAL',
    providerId: null,
    active: true,
    createdAt: '2026-04-30T00:00:00.000Z',
    updatedAt: '2026-04-30T00:00:00.000Z'
  };

  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser', 'getToken', 'getProfile']);

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [{ provide: AuthService, useValue: authServiceSpy }]
    });
  });

  it('shows an active token state and preview when a token exists', () => {
    authServiceSpy.getCurrentUser.and.returnValue(mockUser);
    authServiceSpy.getToken.and.returnValue('12345678901234abcdefghij');

    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;

    expect(component.tokenStatus).toBe('Active bearer token stored');
    expect(component.tokenPreview).toBe('12345678901234...abcdefghij');
  });

  it('syncs the profile on init when a token exists but no cached user is available', () => {
    authServiceSpy.getCurrentUser.and.returnValue(null);
    authServiceSpy.getToken.and.returnValue('12345678901234abcdefghij');
    authServiceSpy.getProfile.and.returnValue(of(mockUser));

    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;

    component.ngOnInit();

    expect(authServiceSpy.getProfile).toHaveBeenCalled();
    expect(component.user).toEqual(mockUser);
    expect(component.successMessage).toBe('Profile synced from auth-service.');
    expect(component.isRefreshing).toBeFalse();
  });

  it('surfaces refresh errors from the auth service', () => {
    authServiceSpy.getCurrentUser.and.returnValue(mockUser);
    authServiceSpy.getToken.and.returnValue(null);
    authServiceSpy.getProfile.and.returnValue(throwError(() => new Error('Profile request failed')));

    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;

    component.refreshProfile();

    expect(component.errorMessage).toBe('Profile request failed');
    expect(component.successMessage).toBe('');
    expect(component.isRefreshing).toBeFalse();
  });
});
