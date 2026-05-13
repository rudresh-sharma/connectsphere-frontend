import { routes } from './app.routes';

describe('app routes', () => {
  it('redirects the root path to dashboard', () => {
    const rootRoute = routes.find((route) => route.path === '');

    expect(rootRoute).toBeDefined();
    expect(rootRoute?.redirectTo).toBe('dashboard');
    expect(rootRoute?.pathMatch).toBe('full');
  });

  it('keeps the social feed available on /dashboard', () => {
    const dashboardRoute = routes.find((route) => route.path === 'dashboard');

    expect(dashboardRoute).toBeDefined();
    expect(typeof dashboardRoute?.loadComponent).toBe('function');
  });

  it('redirects unknown routes back to dashboard', () => {
    const wildcardRoute = routes.find((route) => route.path === '**');

    expect(wildcardRoute).toBeDefined();
    expect(wildcardRoute?.redirectTo).toBe('dashboard');
  });
});
