import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-report-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-dialog.component.html',
  styleUrl: './report-dialog.component.css'
})
export class ReportDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() title = 'Report content';
  @Input() subjectLabel = 'this content';
  @Input() loading = false;
  @Input() errorMessage = '';
  @Input() defaultReason = 'Spam or inappropriate content';
  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<string>();

  reason = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.reason = this.defaultReason;
    }
  }

  close(): void {
    if (this.loading) {
      return;
    }

    this.closed.emit();
  }

  submit(): void {
    const normalizedReason = this.reason.trim();
    if (!normalizedReason || this.loading) {
      return;
    }

    this.submitted.emit(normalizedReason);
  }
}
