import { Component, OnInit } from '@angular/core';
import { WalletService } from '../../../services/wallet.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { loadStripe, Stripe, StripeCardElement } from '@stripe/stripe-js';
import { environment } from '../../../../environments/environment';  // Import environment

declare var hcaptcha: any; // Declare hCaptcha globally

@Component({
  selector: 'app-add-funds',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './add-funds.component.html',
  styleUrls: ['./add-funds.component.css'],
})
export class AddFundsComponent implements OnInit {
  userId: string | null = null;
  amount: number = 0;
  description: string = '';
  userName: string = '';
  private stripe: Stripe | null = null;
  private cardElement: StripeCardElement | null = null;
  loading: boolean = false;
  captchaVerified: boolean = false;
  hCaptchaError: boolean = false;
  captchaResponse: string = ''; // Store the CAPTCHA response
  hCaptchaSiteKey: string = environment.hCaptchaSiteKey; // Now accessible

  constructor(private walletService: WalletService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    this.userId = localStorage.getItem('userId');
    this.userName = localStorage.getItem('userName') || 'Anonymous User';

    // Initialize Stripe
    this.stripe = await loadStripe(environment.stripePublishableKey);
    if (!this.stripe) {
      console.error('Stripe failed to initialize');
      return;
    }

    const elements = this.stripe.elements();
    this.cardElement = elements.create('card');
    this.cardElement.mount('#card-element');
    this.cardElement.on('change', (event: any) => {
      const displayError = document.getElementById('card-errors');
      if (event.error && displayError) {
        displayError.textContent = event.error.message;
      } else if (displayError) {
        displayError.textContent = '';
      }
    });

    // Initialize hCaptcha
    this.initHCaptcha();
  }

  initHCaptcha() {
    const captchaContainer = document.getElementById('hcaptcha-container');
    if (captchaContainer) {
      hcaptcha.render(captchaContainer, {
        sitekey: this.hCaptchaSiteKey,
        callback: (token: string) => {
          this.captchaVerified = true;
          this.hCaptchaError = false;
          this.captchaResponse = token; // Store the CAPTCHA response
        },
        'expired-callback': () => {
          this.captchaVerified = false;
        },
        'error-callback': () => {
          this.captchaVerified = false;
          this.hCaptchaError = true;
        },
      });
    }
  }

  addFunds(): void {
    if (!this.captchaVerified) {
      this.hCaptchaError = true;
      return;
    }

    if (this.userId && this.amount > 0 && this.description.trim()) {
      this.loading = true;
      // Pass the captchaResponse to the addFunds service method
      this.walletService.addFunds(this.userId, this.amount).subscribe({
        next: (response) => {
          const { clientSecret } = response;
          if (clientSecret) {
            this.confirmCardPayment(clientSecret);
          } else {
            console.error('Client secret is missing from the response');
            this.loading = false;
          }
        },
        error: (err) => {
          console.error('Error adding funds:', err);
          this.loading = false;
        },
      });
    }
  }

  async confirmCardPayment(clientSecret: string): Promise<void> {
    if (!this.stripe || !this.cardElement) {
      console.error('Stripe or card element is not initialized');
      this.loading = false;
      return;
    }

    const result = await this.stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: this.cardElement,
        billing_details: { name: this.userName },
      },
    });

    if (result.error) {
      console.error('Payment failed:', result.error.message);
      const displayError = document.getElementById('card-errors');
      if (displayError) {
        displayError.textContent = result.error.message || 'Payment failed.';
      }
      this.loading = false;
    } else if (result.paymentIntent?.status === 'succeeded') {
      console.log('Payment successful:', result.paymentIntent);
      this.router.navigate(['/wallet']);
      this.loading = false;
    }
  }
}
