import { LandingComponent } from './features/landing/landing.component';
import { routes } from './app.routes';

describe('app routes', () => {
  it('uses the landing page for the root path', () => {
    const rootRoute = routes.find((route) => route.path === '');

    expect(rootRoute).toBeDefined();
    expect(rootRoute?.component).toBe(LandingComponent);
  });

  it('keeps the social feed available on /dashboard', () => {
    const dashboardRoute = routes.find((route) => route.path === 'dashboard');

    expect(dashboardRoute).toBeDefined();
    expect(typeof dashboardRoute?.loadComponent).toBe('function');
  });

  it('redirects unknown routes back to the landing page', () => {
    const wildcardRoute = routes.find((route) => route.path === '**');

    expect(wildcardRoute).toBeDefined();
    expect(wildcardRoute?.redirectTo).toBe('');
  });
});
