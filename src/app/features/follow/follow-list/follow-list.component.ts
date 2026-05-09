import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PublicUser } from '../../../shared/models/auth.models';
import { FollowRelationship } from '../follow.model';
import { FollowService } from '../follow.service';

type FollowListMode = 'followers' | 'following';
type EnrichedFollowRelationship = FollowRelationship & { displayUser?: PublicUser | null };

@Component({
  selector: 'app-follow-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './follow-list.component.html',
  styleUrl: './follow-list.component.css'
})
export class FollowListComponent implements OnInit, OnChanges {
  private readonly followService = inject(FollowService);
  private readonly authService = inject(AuthService);

  @Input() userId = this.getCurrentUserId();
  @Input() mode: FollowListMode = 'followers';

  relationships: EnrichedFollowRelationship[] = [];
  isLoading = false;
  errorMessage = '';

  get heading(): string {
    return this.mode === 'followers' ? 'Followers' : 'Following';
  }

  ngOnInit(): void {
    this.loadList();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['userId'] || changes['mode']) && !changes['userId']?.firstChange) {
      this.loadList();
    }
  }

  loadList(): void {
    if (!this.userId) {
      this.relationships = [];
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;
    const request$ =
      this.mode === 'followers'
        ? this.followService.getFollowers(this.userId)
        : this.followService.getFollowing(this.userId);

    request$
      .pipe(
        switchMap((relationships) => this.enrichRelationships(relationships ?? [])),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
      next: (relationships) => {
        this.relationships = relationships;
      },
      error: (error: Error) => {
        this.errorMessage = error.message;
      }
    });
  }

  getDisplayUserId(relationship: FollowRelationship): number {
    return this.mode === 'followers' ? relationship.followerId : relationship.followingId;
  }

  getInitial(relationship: EnrichedFollowRelationship): string {
    const user = relationship.displayUser;
    return (user?.fullName || user?.username || String(this.getDisplayUserId(relationship))).charAt(0).toUpperCase();
  }

  private enrichRelationships(relationships: FollowRelationship[]) {
    if (relationships.length === 0) {
      return of([]);
    }

    return forkJoin(
      relationships.map((relationship) =>
        this.authService.getPublicUser(this.getDisplayUserId(relationship)).pipe(
          map((displayUser) => ({ ...relationship, displayUser })),
          catchError(() => of({ ...relationship, displayUser: null }))
        )
      )
    );
  }

  private getCurrentUserId(): number {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}') as { userId?: number };
      return currentUser.userId ?? 0;
    } catch {
      return 0;
    }
  }
}
