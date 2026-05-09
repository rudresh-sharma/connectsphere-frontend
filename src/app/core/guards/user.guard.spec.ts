import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { userGuard } from './user.guard';

describe('userGuard', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['getToken', 'isAdmin']);

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

  it('redirects guests to login', () => {
    authServiceSpy.getToken.and.returnValue(null);

    const result = TestBed.runInInjectionContext(() => userGuard({} as never, {} as never));
    const expectedTree = (router.createUrlTree as jasmine.Spy).calls.mostRecent().returnValue;

    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(expectedTree);
  });

  it('redirects admins away from user-only routes', () => {
    authServiceSpy.getToken.and.returnValue('jwt-token');
    authServiceSpy.isAdmin.and.returnValue(true);

    const result = TestBed.runInInjectionContext(() => userGuard({} as never, {} as never));
    const expectedTree = (router.createUrlTree as jasmine.Spy).calls.mostRecent().returnValue;

    expect(router.createUrlTree).toHaveBeenCalledWith(['/admin']);
    expect(result).toBe(expectedTree);
  });

  it('allows non-admin authenticated users through', () => {
    authServiceSpy.getToken.and.returnValue('jwt-token');
    authServiceSpy.isAdmin.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => userGuard({} as never, {} as never));

    expect(result).toBeTrue();
  });
});
