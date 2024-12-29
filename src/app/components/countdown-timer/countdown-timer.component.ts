import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-countdown-timer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="timeRemaining">
      <h3>Next Payout In:</h3>
      <p>{{ timeRemaining.days }}d {{ timeRemaining.hours }}h {{ timeRemaining.minutes }}m {{ timeRemaining.seconds }}s</p>
    </div>
    <p *ngIf="!timeRemaining">Countdown expired or invalid date.</p>
  `,
styleUrls: ['./countdown-timer.component.css'],
})
export class CountdownTimerComponent implements OnInit, OnDestroy {
  @Input() targetDate!: string | null;
  timeRemaining: { days: number; hours: number; minutes: number; seconds: number } | null = null;

  private timerSubscription!: Subscription;

  ngOnInit() {
    if (this.targetDate) {
      this.updateCountdown(); // Initialize the countdown
      this.timerSubscription = interval(1000).subscribe(() => this.updateCountdown());
    }
  }

  ngOnDestroy() {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe(); // Clean up the subscription
    }
  }

  private updateCountdown() {
    if (!this.targetDate) {
      this.timeRemaining = null;
      return;
    }

    const targetTime = new Date(this.targetDate).getTime();
    const now = Date.now();
    const timeDifference = targetTime - now;

    if (timeDifference <= 0) {
      this.timeRemaining = null; // Timer expired
      return;
    }

    const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

    this.timeRemaining = { days, hours, minutes, seconds };
  }
}
