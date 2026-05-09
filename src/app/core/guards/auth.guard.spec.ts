import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getToken']);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: {
            createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((commands: string[]) => ({ commands }))
          }
        },
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });

    router = TestBed.inject(Router);
  });

  it('allows navigation when a token exists', () => {
    authServiceSpy.getToken.and.returnValue('jwt-token');

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

    expect(result).toBeTrue();
  });

  it('redirects guests to login when no token exists', () => {
    authServiceSpy.getToken.and.returnValue(null);

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    const expectedTree = (router.createUrlTree as jasmine.Spy).calls.mostRecent().returnValue;

    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(expectedTree);
  });
});
