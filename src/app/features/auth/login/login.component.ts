import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

const AUTH_BASE_URL = 'http://localhost:8080';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  showPassword = false;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  readonly loginForm = this.fb.nonNullable.group({
    emailOrUsername: [this.authService.getRememberedIdentity(), [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    rememberMe: [Boolean(this.authService.getRememberedIdentity())]
  });

  ngOnInit(): void {
    const oauthError = this.route.snapshot.queryParamMap.get('error');
    if (oauthError) {
      this.authService.logout();
      this.errorMessage = decodeURIComponent(oauthError);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
      return;
    }

    if (this.authService.isAuthenticated()) {
      void this.router.navigate([this.authService.getHomeRoute()]);
      return;
    }
  }

  get emailOrUsername() {
    return this.loginForm.controls.emailOrUsername;
  }

  get password() {
    return this.loginForm.controls.password;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  loginWithGoogle(): void {
    window.location.assign(`${AUTH_BASE_URL}/oauth2/authorization/google`);
  }

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const { emailOrUsername, password, rememberMe } = this.loginForm.getRawValue();

    this.authService
      .login({ emailOrUsername, password })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          if (rememberMe) {
            this.authService.rememberIdentity(emailOrUsername);
          } else {
            this.authService.clearRememberedIdentity();
          }

          this.successMessage = 'Welcome back to ConnectSphere.';
          void this.router.navigate([this.authService.getHomeRoute()]);
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        }
      });
  }
}
