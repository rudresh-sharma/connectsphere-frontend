import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { Observable, finalize } from 'rxjs';
import { FollowService } from '../follow.service';

@Component({
  selector: 'app-follow-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './follow-button.component.html',
  styleUrl: './follow-button.component.css'
})
export class FollowButtonComponent implements OnInit, OnChanges {
  private readonly followService = inject(FollowService);

  @Input({ required: true }) currentUserId = 0;
  @Input({ required: true }) targetUserId = 0;
  @Output() followChanged = new EventEmitter<boolean>();

  isFollowing = false;
  isLoading = false;
  errorMessage = '';

  get isSelf(): boolean {
    return Boolean(this.currentUserId && this.targetUserId && this.currentUserId === this.targetUserId);
  }

  ngOnInit(): void {
    this.loadStatus();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['currentUserId'] || changes['targetUserId']) && !changes['currentUserId']?.firstChange) {
      this.loadStatus();
    }
  }

  toggleFollow(): void {
    if (this.isSelf || this.isLoading || !this.currentUserId || !this.targetUserId) {
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;
    const request$: Observable<unknown> = this.isFollowing
      ? this.followService.unfollow(this.currentUserId, this.targetUserId)
      : this.followService.follow(this.currentUserId, this.targetUserId);

    request$.pipe(finalize(() => (this.isLoading = false))).subscribe({
      next: () => {
        this.isFollowing = !this.isFollowing;
        this.followChanged.emit(this.isFollowing);
      },
      error: (error: Error) => {
        this.errorMessage = error.message;
        this.loadStatus();
      }
    });
  }

  private loadStatus(): void {
    this.errorMessage = '';

    if (this.isSelf || !this.currentUserId || !this.targetUserId) {
      this.isFollowing = false;
      return;
    }

    this.isLoading = true;
    this.followService
      .getStatus(this.currentUserId, this.targetUserId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (status) => {
          this.isFollowing = status.following;
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        }
      });
  }
}
