import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  isCheckingUsername = false;
  usernameAvailable: boolean | null = null;
  errorMessage = '';
  successMessage = '';

  readonly registerForm = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9._-]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      rememberMe: [true]
    },
    { validators: this.passwordsMatchValidator }
  );

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      void this.router.navigate([this.authService.getHomeRoute()]);
      return;
    }

    this.username.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((username) => {
          this.usernameAvailable = null;

          if (!this.username.valid) {
            this.isCheckingUsername = false;
            return of(null);
          }

          this.isCheckingUsername = true;
          return this.authService
            .checkUsernameAvailability(username)
            .pipe(finalize(() => (this.isCheckingUsername = false)));
        })
      )
      .subscribe({
        next: (response) => {
          this.usernameAvailable = response ? response.available : null;
        },
        error: (error: Error) => {
          this.usernameAvailable = false;
          this.errorMessage = error.message;
        }
      });
  }

  get fullName() {
    return this.registerForm.controls.fullName;
  }

  get username() {
    return this.registerForm.controls.username;
  }

  get email() {
    return this.registerForm.controls.email;
  }

  get password() {
    return this.registerForm.controls.password;
  }

  get confirmPassword() {
    return this.registerForm.controls.confirmPassword;
  }

  get passwordsDoNotMatch(): boolean {
    return Boolean(this.registerForm.errors?.['passwordsMismatch'] && this.confirmPassword.touched);
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  registerWithGoogle(): void {
    window.location.href = 'http://localhost:8080/oauth2/authorization/google';
  }

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (this.registerForm.invalid || this.usernameAvailable === false) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const { fullName, username, email, password, rememberMe } = this.registerForm.getRawValue();

    this.authService
      .register({ fullName, username, email, password })
      .pipe(
        switchMap((response) => {
          if (response?.accessToken) {
            return of(response);
          }

          return this.authService.login({ emailOrUsername: username, password });
        }),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: () => {
          if (rememberMe) {
            this.authService.rememberIdentity(username);
          } else {
            this.authService.clearRememberedIdentity();
          }

          this.successMessage = 'Your ConnectSphere account is ready.';
          void this.router.navigate([this.authService.getHomeRoute()]);
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        }
      });
  }

  private passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordsMismatch: true };
  }
}
