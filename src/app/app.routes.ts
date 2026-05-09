import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';
import { authGuard } from './core/guards/auth.guard';
import { userGuard } from './core/guards/user.guard';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { AuthCallbackComponent } from './features/auth/callback/auth-callback.component';
import { ChooseUsernameComponent } from './features/auth/choose-username/choose-username.component';
import { LandingComponent } from './features/landing/landing.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'auth/callback', component: AuthCallbackComponent },
  { path: 'auth/choose-username', component: ChooseUsernameComponent },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/posts/post-feed/post-feed.component').then((m) => m.PostFeedComponent)
  },
  {
    path: 'posts/:id',
    loadComponent: () =>
      import('./features/posts/post-detail/post-detail.component').then((m) => m.PostDetailComponent)
  },
  {
    path: 'bookmarks',
    loadComponent: () =>
      import('./features/posts/bookmarks-page/bookmarks-page.component').then((m) => m.BookmarksPageComponent),
    canActivate: [userGuard]
  },
  {
    path: 'reels',
    loadComponent: () =>
      import('./features/reels/reels-page/reels-page.component').then((m) => m.ReelsPageComponent),
    canActivate: [userGuard]
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile.component').then((m) => m.ProfileComponent)
  },
  {
    path: 'connections',
    loadComponent: () =>
      import('./features/follow/connections-page/connections-page.component').then((m) => m.ConnectionsPageComponent),
    canActivate: [userGuard]
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./features/notifications/notification-list/notification-list.component').then((m) => m.NotificationListComponent),
    canActivate: [userGuard]
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./features/search/search-page/search-page.component').then((m) => m.SearchPageComponent)
  },
  { path: '**', redirectTo: '' }
];
