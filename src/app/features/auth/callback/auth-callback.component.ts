import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-callback.component.html'
})
export class AuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    const error = this.route.snapshot.queryParamMap.get('error');

    if (error) {
      void this.router.navigate(['/login'], {
        queryParams: { error }
      });
      return;
    }

    if (!token) {
      void this.router.navigate(['/login'], {
        queryParams: { error: 'OAuth token missing' }
      });
      return;
    }

    this.authService.logout();
    this.authService.persistOAuthToken(token);

    void this.router.navigate([this.authService.getHomeRoute()], {
      replaceUrl: true
    });
  }
}
