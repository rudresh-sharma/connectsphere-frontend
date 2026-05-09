import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, finalize, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-choose-username',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './choose-username.component.html',
  styleUrl: './choose-username.component.css'
})
export class ChooseUsernameComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  setupToken = '';
  email = '';
  fullName = '';
  isCheckingUsername = false;
  isSubmitting = false;
  usernameAvailable: boolean | null = null;
  errorMessage = '';
  selectedFile: File | null = null;
  fileError = '';

  readonly usernameForm = this.fb.nonNullable.group({
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(40),
        Validators.pattern(/^[a-zA-Z0-9._-]+$/)
      ]
    ],
    bio: ['', [Validators.maxLength(300)]]
  });

  ngOnInit(): void {
    this.setupToken = this.route.snapshot.queryParamMap.get('setupToken') ?? '';
    this.email = this.route.snapshot.queryParamMap.get('email') ?? '';
    this.fullName = this.route.snapshot.queryParamMap.get('fullName') ?? '';

    if (!this.setupToken) {
      void this.router.navigate(['/login'], {
        queryParams: { error: 'OAuth setup session missing. Please sign in again.' }
      });
      return;
    }

    this.username.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        filter(() => this.username.valid),
        switchMap((username) => {
          this.usernameAvailable = null;
          this.isCheckingUsername = true;
          return this.authService
            .checkUsernameAvailability(username)
            .pipe(finalize(() => (this.isCheckingUsername = false)));
        })
      )
      .subscribe({
        next: (response) => {
          this.usernameAvailable = response.available;
        },
        error: (error: Error) => {
          this.usernameAvailable = false;
          this.errorMessage = error.message;
        }
      });
  }

  get username() {
    return this.usernameForm.controls.username;
  }

  get bio() {
    return this.usernameForm.controls.bio;
  }

  onFileSelected(event: Event): void {
    this.fileError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.selectedFile = null;
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.selectedFile = null;
      this.fileError = 'Please choose an image file for your profile picture.';
      input.value = '';
      return;
    }

    this.selectedFile = file;
  }

  submit(): void {
    this.errorMessage = '';

    if (this.usernameForm.invalid || this.usernameAvailable !== true) {
      this.usernameForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.authService
      .completeOAuthSignup({
        setupToken: this.setupToken,
        username: this.username.value,
        bio: this.bio.value.trim() || null
      })
      .pipe(
        switchMap(() => (this.selectedFile ? this.authService.uploadProfilePicture(this.selectedFile) : of(null))),
        finalize(() => (this.isSubmitting = false))
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/dashboard']);
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        }
      });
  }
}
