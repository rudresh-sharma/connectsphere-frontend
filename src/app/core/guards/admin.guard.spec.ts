import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
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

    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    const expectedTree = (router.createUrlTree as jasmine.Spy).calls.mostRecent().returnValue;

    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(result).toBe(expectedTree);
  });

  it('redirects non-admin users to dashboard', () => {
    authServiceSpy.getToken.and.returnValue('jwt-token');
    authServiceSpy.isAdmin.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    const expectedTree = (router.createUrlTree as jasmine.Spy).calls.mostRecent().returnValue;

    expect(router.createUrlTree).toHaveBeenCalledWith(['/dashboard']);
    expect(result).toBe(expectedTree);
  });

  it('allows admin users through', () => {
    authServiceSpy.getToken.and.returnValue('jwt-token');
    authServiceSpy.isAdmin.and.returnValue(true);

    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));

    expect(result).toBeTrue();
  });
});
