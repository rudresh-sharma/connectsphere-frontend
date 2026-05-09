import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private readonly router = inject(Router);

  private readonly history: string[] = [];
  private suppressedUrl: string | null = null;

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects;

        if (this.suppressedUrl === url) {
          this.suppressedUrl = null;
          return;
        }

        if (this.history[this.history.length - 1] !== url) {
          this.history.push(url);
        }
      });
  }

  getPreviousUrl(): string | null {
    return this.history.length > 1 ? this.history[this.history.length - 2] : null;
  }

  isPreviousRouteSearch(): boolean {
    return this.getPreviousUrl()?.startsWith('/search') ?? false;
  }

  goBack(fallbackUrl: string): Promise<boolean> {
    if (this.history.length > 1) {
      this.history.pop();
      const targetUrl = this.history[this.history.length - 1];
      this.suppressedUrl = targetUrl;
      return this.router.navigateByUrl(targetUrl, { replaceUrl: true });
    }

    return this.router.navigateByUrl(fallbackUrl, { replaceUrl: true });
  }
}
