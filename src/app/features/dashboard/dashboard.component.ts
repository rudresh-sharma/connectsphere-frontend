import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../shared/models/auth.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);

  user: User | null = null;
  isRefreshing = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.user = this.authService.getCurrentUser();

    if (!this.user && this.authService.getToken()) {
      this.refreshProfile();
    }
  }

  get tokenStatus(): string {
    return this.authService.getToken() ? 'Active bearer token stored' : 'No token found';
  }

  get tokenPreview(): string {
    const token = this.authService.getToken();

    if (!token) {
      return 'Unavailable';
    }

    return `${token.slice(0, 14)}...${token.slice(-10)}`;
  }

  refreshProfile(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isRefreshing = true;

    this.authService
      .getProfile()
      .pipe(finalize(() => (this.isRefreshing = false)))
      .subscribe({
        next: (user) => {
          this.user = user;
          this.successMessage = 'Profile synced from auth-service.';
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        }
      });
  }

}
