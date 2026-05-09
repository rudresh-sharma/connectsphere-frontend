import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent {
  private readonly authService = inject(AuthService);

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get primaryRoute(): '/dashboard' | '/admin' | '/register' {
    return this.isAuthenticated ? this.authService.getHomeRoute() : '/register';
  }

  get primaryLabel(): string {
    return this.isAuthenticated ? 'Open your feed' : 'Create an account';
  }
}
