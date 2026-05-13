import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { take } from 'rxjs';
import { AuthService } from './core/services/auth.service';
import { NavigationHistoryService } from './core/services/navigation-history.service';
import { User } from './shared/models/auth.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell" [class.immersive-shell]="isImmersiveRoute" [class.compact-shell]="!showTopBrand">
      <header
        *ngIf="showTopBrand"
        class="top-brand-bar"
        [class.mobile-dashboard-guest-bar]="isGuestDashboardRoute"
        aria-label="ConnectSphere"
      >
        <a class="top-brand-link" [routerLink]="homeRoute" aria-label="ConnectSphere home">
          <span class="brand-wordmark">ConnectSphere</span>
        </a>
        <nav *ngIf="!isAuthenticated" class="guest-top-actions" aria-label="Guest navigation">
          <a class="guest-top-link guest-top-icon" routerLink="/search" aria-label="Search" title="Search">
            <i class="bi bi-search" aria-hidden="true"></i>
          </a>
          <a class="guest-top-link" routerLink="/login">Login</a>
          <a class="guest-top-link primary" routerLink="/register">Sign up</a>
        </nav>
      </header>

      <aside *ngIf="showDesktopSidebar" class="desktop-side-panel" aria-label="Main navigation">
        <a class="desktop-side-brand" [routerLink]="homeRoute" aria-label="ConnectSphere home">
          <span class="brand-wordmark">ConnectSphere</span>
        </a>
        <nav class="desktop-side-nav">
          <a
            class="desktop-side-link"
            [routerLink]="homeRoute"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            [class.active]="isAdmin && isActiveAdminView('overview')"
            [attr.aria-label]="isAdmin ? 'Admin home' : 'Home'"
            [attr.data-label]="isAdmin ? 'Admin' : 'Home'"
            [attr.title]="isAdmin ? 'Admin home' : 'Home'"
          >
            <i class="bi" [ngClass]="isAdmin ? 'bi-shield-lock' : 'bi-house-door'" aria-hidden="true"></i>
            <span class="visually-hidden">{{ isAdmin ? 'Admin home' : 'Home' }}</span>
          </a>

          <a
            *ngIf="isAdmin"
            class="desktop-side-link"
            routerLink="/admin"
            [queryParams]="{ view: 'notifications' }"
            [class.active]="isActiveAdminView('notifications')"
            aria-label="Broadcast notifications"
            data-label="Notifications"
            title="Broadcast notifications"
          >
            <i class="bi bi-megaphone" aria-hidden="true"></i>
            <span class="visually-hidden">Broadcast notifications</span>
          </a>

          <a
            *ngIf="isAdmin"
            class="desktop-side-link"
            routerLink="/admin"
            [queryParams]="{ view: 'data' }"
            [class.active]="isActiveAdminView('data')"
            aria-label="Manage platform data"
            data-label="Manage data"
            title="Manage platform data"
          >
            <i class="bi bi-database" aria-hidden="true"></i>
            <span class="visually-hidden">Manage platform data</span>
          </a>

          <button
            *ngIf="!isAdmin"
            class="desktop-side-link"
            type="button"
            aria-label="Create"
            data-label="Create"
            title="Create"
            (click)="openCreate()"
          >
            <i class="bi bi-plus-square" aria-hidden="true"></i>
            <span class="visually-hidden">Create</span>
          </button>

          <a
            *ngIf="!isAdmin"
            class="desktop-side-link"
            routerLink="/notifications"
            routerLinkActive="active"
            aria-label="Notifications"
            data-label="Notifications"
            title="Notifications"
          >
            <i class="bi bi-bell" aria-hidden="true"></i>
            <span class="visually-hidden">Notifications</span>
          </a>

          <a
            *ngIf="!isAdmin"
            class="desktop-side-link"
            routerLink="/reels"
            routerLinkActive="active"
            aria-label="Reels"
            data-label="Reels"
            title="Reels"
          >
            <i class="bi bi-camera-reels" aria-hidden="true"></i>
            <span class="visually-hidden">Reels</span>
          </a>

          <a
            *ngIf="!isAdmin"
            class="desktop-side-link"
            routerLink="/search"
            routerLinkActive="active"
            aria-label="Search"
            data-label="Search"
            title="Search"
          >
            <i class="bi bi-search" aria-hidden="true"></i>
            <span class="visually-hidden">Search</span>
          </a>

          <a
            class="desktop-side-link profile-link"
            routerLink="/profile"
            routerLinkActive="active"
            aria-label="Profile"
            data-label="Profile"
            title="Profile"
          >
            <ng-container *ngIf="currentUser$ | async as currentUser">
              <img
                *ngIf="hasProfilePicture(currentUser); else desktopProfileInitial"
                class="desktop-profile-avatar"
                [src]="currentUser.profilePicUrl"
                [alt]="currentUser.fullName || currentUser.username || 'Profile'"
                (error)="onSidebarProfileImageError()"
              >
              <ng-template #desktopProfileInitial>
                <span class="desktop-profile-avatar" aria-hidden="true">{{ getProfileInitial(currentUser) }}</span>
              </ng-template>
            </ng-container>
            <span class="visually-hidden">Profile</span>
          </a>

          <button
            class="desktop-side-link"
            type="button"
            aria-label="Settings"
            data-label="Settings"
            title="Settings"
            (click)="openSettings()"
          >
            <i class="bi bi-gear" aria-hidden="true"></i>
            <span class="visually-hidden">Settings</span>
          </button>
        </nav>
      </aside>

      <router-outlet />
    </div>

    <nav
      *ngIf="showMobileNav"
      class="mobile-bottom-nav"
      [class.admin-mobile-nav]="isAdmin"
      aria-label="Main navigation"
    >
      <a
        class="mobile-nav-link"
        [routerLink]="homeRoute"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: true }"
        [class.active]="isAdmin && isActiveAdminView('overview')"
        [attr.aria-label]="isAdmin ? 'Admin home' : 'Home'"
      >
        <i class="bi" [ngClass]="isAdmin ? 'bi-shield-lock' : 'bi-house-door'" aria-hidden="true"></i>
        <span>{{ isAdmin ? 'Admin' : 'Home' }}</span>
      </a>

      <a
        *ngIf="isAdmin"
        class="mobile-nav-link"
        routerLink="/admin"
        [queryParams]="{ view: 'notifications' }"
        [class.active]="isActiveAdminView('notifications')"
        aria-label="Broadcast notifications"
      >
        <i class="bi bi-megaphone" aria-hidden="true"></i>
        <span>Notify</span>
      </a>

      <a
        *ngIf="isAdmin"
        class="mobile-nav-link"
        routerLink="/admin"
        [queryParams]="{ view: 'data' }"
        [class.active]="isActiveAdminView('data')"
        aria-label="Manage platform data"
      >
        <i class="bi bi-database" aria-hidden="true"></i>
        <span>Data</span>
      </a>

      <a
        *ngIf="!isAdmin"
        class="mobile-nav-link"
        routerLink="/reels"
        routerLinkActive="active"
        aria-label="Reels"
      >
        <i class="bi bi-camera-reels" aria-hidden="true"></i>
        <span>Reels</span>
      </a>

      <a
        *ngIf="!isAdmin"
        class="mobile-nav-link"
        routerLink="/search"
        routerLinkActive="active"
        aria-label="Search"
      >
        <i class="bi bi-search" aria-hidden="true"></i>
        <span>Search</span>
      </a>

      <button
        *ngIf="!isAdmin"
        class="mobile-nav-link"
        type="button"
        aria-label="Create"
        (click)="openCreate()"
      >
        <i class="bi bi-plus-square" aria-hidden="true"></i>
        <span>Create</span>
      </button>

      <a
        class="mobile-nav-link profile-link"
        routerLink="/profile"
        routerLinkActive="active"
        aria-label="Profile"
      >
        <ng-container *ngIf="currentUser$ | async as currentUser">
          <img
            *ngIf="hasProfilePicture(currentUser); else profileInitial"
            class="mobile-profile-avatar"
            [src]="currentUser.profilePicUrl"
            [alt]="currentUser.fullName || currentUser.username || 'Profile'"
            (error)="onSidebarProfileImageError()"
          >
          <ng-template #profileInitial>
            <span class="mobile-profile-avatar" aria-hidden="true">{{ getProfileInitial(currentUser) }}</span>
          </ng-template>
        </ng-container>
        <span>Profile</span>
      </a>
    </nav>
  `,
  styles: [`
    .app-shell {
      min-height: 100vh;
      padding-top: 92px;
    }

    .app-shell.immersive-shell {
      padding-top: 0;
    }

    .app-shell.compact-shell {
      padding-top: 0;
    }

    .top-brand-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 70;
      display: flex;
      align-items: center;
      min-height: 78px;
      padding: 14px 24px;
      background: rgba(245, 248, 252, 0.82);
      border-bottom: 1px solid rgba(217, 225, 236, 0.86);
      backdrop-filter: blur(18px);
    }

    .guest-top-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }

    .guest-top-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      min-width: 86px;
      padding: 0 14px;
      border-radius: 999px;
      border: 1px solid rgba(203, 213, 225, 0.9);
      background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.8),
        0 6px 14px rgba(15, 23, 42, 0.08);
      color: #1f2937;
      font-size: 0.88rem;
      font-weight: 900;
      letter-spacing: 0.01em;
      line-height: 1;
      white-space: nowrap;
      text-decoration: none;
      transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }

    .guest-top-icon {
      width: 40px;
      min-width: 40px;
      padding: 0;
      font-size: 1.05rem;
    }

    .guest-top-link:hover,
    .guest-top-link:focus-visible {
      border-color: rgba(148, 163, 184, 0.95);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.9),
        0 10px 18px rgba(15, 23, 42, 0.12);
      transform: translateY(-1px);
      color: #0f172a;
      text-decoration: none;
      outline: none;
    }

    .guest-top-link.primary {
      border-color: rgba(37, 99, 235, 0.7);
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 55%, #1e40af 100%);
      color: #fff;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.18),
        0 10px 22px rgba(29, 78, 216, 0.28);
    }

    .top-brand-link {
      display: inline-flex;
      align-items: center;
      gap: 14px;
      color: inherit;
      text-decoration: none;
    }

    .top-brand-link:hover,
    .top-brand-link:focus-visible {
      text-decoration: none;
    }

    .brand-wordmark {
      font-family: Inter, "Segoe UI", sans-serif;
      font-size: clamp(1.35rem, 2vw, 1.8rem);
      font-weight: 800;
      letter-spacing: 0.02em;
      color: #0f172a;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
    }

      .mobile-bottom-nav {
        display: none;
      }

    .desktop-side-panel {
      position: fixed;
      top: 24px;
      left: 22px;
      z-index: 60;
    }

    .desktop-side-brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin: 0 0 38px;
      color: inherit;
      text-decoration: none;
    }

    .desktop-side-brand:hover,
    .desktop-side-brand:focus-visible {
      text-decoration: none;
    }

    .desktop-side-nav {
      display: grid;
      justify-items: center;
      gap: 24px;
      padding: 12px 0;
      width: 56px;
    }

    .desktop-side-link {
      position: relative;
      display: grid;
      place-items: center;
      width: 50px;
      height: 50px;
      border: 0;
      border-radius: 12px;
      background: transparent;
      color: #111827;
      font: inherit;
      text-decoration: none;
      transition: background-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
    }

    .desktop-side-link::after {
      content: attr(data-label);
      position: absolute;
      top: 50%;
      left: calc(100% + 14px);
      transform: translateY(-50%) translateX(-6px);
      opacity: 0;
      pointer-events: none;
      white-space: nowrap;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.94);
      color: #fff;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.01em;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.2);
      transition: opacity 0.18s ease, transform 0.18s ease;
    }

    .desktop-side-link .bi {
      font-size: 1.7rem;
      line-height: 1;
    }

    .desktop-profile-avatar {
      display: inline-grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      object-fit: cover;
      background: linear-gradient(135deg, #f56040, #833ab4 48%, #405de6);
      color: #fff;
      font-size: 0.86rem;
      font-weight: 900;
      text-transform: uppercase;
    }

    .desktop-side-link:hover,
    .desktop-side-link:focus-visible,
    .desktop-side-link.active {
      background: rgba(17, 24, 39, 0.06);
      color: #050505;
      transform: scale(1.04);
    }

    .desktop-side-link:hover::after,
    .desktop-side-link:focus-visible::after {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }

    @media (max-width: 700px) {
      .top-brand-bar.mobile-dashboard-guest-bar {
        justify-content: space-between;
      }

      .top-brand-bar.mobile-dashboard-guest-bar .guest-top-icon {
        display: none;
      }

      .app-shell {
        padding-top: 82px;
        padding-bottom: 92px;
      }

      .app-shell.immersive-shell {
        padding-top: 0;
      }

      .app-shell.compact-shell {
        padding-top: 0;
      }

      .top-brand-bar {
        min-height: 68px;
        padding: 10px 10px;
        gap: 6px;
      }

      .top-brand-link {
        flex: 1 1 auto;
        min-width: 0;
      }

      .brand-wordmark {
        font-size: clamp(1.06rem, 5.3vw, 1.3rem);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .guest-top-actions {
        flex: 0 0 auto;
        gap: 5px;
        margin-left: 0;
      }

      .guest-top-link {
        min-height: 34px;
        min-width: 62px;
        padding: 0 7px;
        font-size: 0.8rem;
        letter-spacing: 0;
      }

      .guest-top-icon {
        width: 32px;
        min-width: 32px;
        min-height: 32px;
        font-size: 0.9rem;
      }

      .guest-top-link.primary {
        min-width: 68px;
      }

      .desktop-side-panel {
        display: none;
      }

      .mobile-bottom-nav {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 60;
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 10px;
        width: min(520px, calc(100% - 24px));
        margin: 0 auto;
        padding: 8px;
        border: 1px solid rgba(217, 225, 236, 0.92);
        border-radius: 20px 20px 0 0;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 -12px 32px rgba(16, 24, 40, 0.08);
        backdrop-filter: blur(16px);
      }

      .mobile-bottom-nav.admin-mobile-nav {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .mobile-nav-link {
        display: grid;
        justify-items: center;
        gap: 4px;
        min-height: 54px;
        padding: 6px 8px;
        border: 0;
        border-radius: 14px;
        background: transparent;
        color: #667085;
        cursor: pointer;
        font: inherit;
        text-decoration: none;
        font-size: 0.74rem;
        font-weight: 800;
      }

      .mobile-nav-link .bi {
        font-size: 1.25rem;
        line-height: 1;
      }

      .mobile-nav-link.active {
        background: #eff4ff;
        color: #175cd3;
      }

      .mobile-profile-avatar {
        display: inline-grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        object-fit: cover;
        background: linear-gradient(135deg, #1d4ed8, #60a5fa);
        color: #fff;
        font-size: 0.72rem;
        font-weight: 900;
        text-transform: uppercase;
      }
    }

    @media (max-width: 390px) {
      .top-brand-bar {
        padding: 9px 8px;
        gap: 4px;
      }

      .brand-wordmark {
        font-size: clamp(0.96rem, 5vw, 1.08rem);
      }

      .guest-top-actions {
        gap: 4px;
      }

      .guest-top-link {
        min-width: 56px;
        padding: 0 6px;
        font-size: 0.76rem;
      }

      .guest-top-link.primary {
        min-width: 62px;
      }

      .guest-top-icon {
        display: none;
      }

      .guest-top-actions {
        gap: 3px;
        flex-wrap: nowrap;
        margin-left: auto;
        justify-content: flex-end;
      }
    }

    @media (max-width: 360px) {
      .top-brand-link {
        max-width: 44%;
      }

      .brand-wordmark {
        font-size: 0.92rem;
      }

      .guest-top-link {
        white-space: nowrap !important;
        min-width: 52px;
        padding: 0 5px;
        font-size: 0.73rem;
      }

      .guest-top-link.primary {
        min-width: 58px;
      }
    }
  `]
})
export class AppComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly navigationHistoryService = inject(NavigationHistoryService);
  private sidebarProfileImageFailed = false;

  readonly currentUser$ = this.authService.currentUser$;

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    this.authService
      .syncCurrentUser()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.sidebarProfileImageFailed = false;
        },
        error: () => {
          // Keep the cached session visible even if profile sync fails.
        }
      });
  }

  get showMobileNav(): boolean {
    const hiddenRoutes = ['/login', '/register', '/auth/callback', '/auth/choose-username'];
    return this.authService.isAuthenticated() && !hiddenRoutes.some((route) => this.router.url.startsWith(route));
  }

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get showDesktopSidebar(): boolean {
    const hiddenRoutes = ['/login', '/register', '/auth/callback', '/auth/choose-username'];
    return this.authService.isAuthenticated() && !hiddenRoutes.some((route) => this.router.url.startsWith(route));
  }

  get showTopBrand(): boolean {
    const hiddenRoutes = ['/login', '/register', '/auth/callback', '/auth/choose-username'];
    return !this.authService.isAuthenticated() && !hiddenRoutes.some((route) => this.router.url.startsWith(route));
  }

  get isGuestDashboardRoute(): boolean {
    return !this.authService.isAuthenticated() && this.router.url.startsWith('/dashboard');
  }

  get isImmersiveRoute(): boolean {
    return this.router.url.startsWith('/reels');
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  get homeRoute(): '/admin' | '/dashboard' {
    return this.authService.isAuthenticated() ? this.authService.getHomeRoute() : '/dashboard';
  }

  isActiveAdminView(view: 'overview' | 'notifications' | 'data'): boolean {
    if (!this.router.url.startsWith('/admin')) {
      return false;
    }

    const activeView = this.router.parseUrl(this.router.url).queryParams['view'] ?? 'overview';
    return activeView === view;
  }

  getProfileInitial(user: User | null): string {
    return user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'P';
  }

  hasProfilePicture(user: User | null): boolean {
    return Boolean(user?.profilePicUrl?.trim()) && !this.sidebarProfileImageFailed;
  }

  onSidebarProfileImageError(): void {
    this.sidebarProfileImageFailed = true;
  }

  openCreate(): void {
    void this.router.navigate([this.homeRoute], {
      queryParams: { create: Date.now().toString() }
    });
  }

  openSettings(): void {
    void this.router.navigate(['/profile'], {
      queryParams: { settings: 'true' }
    });
  }
}
