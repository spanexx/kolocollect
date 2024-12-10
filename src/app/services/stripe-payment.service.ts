import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class StripePaymentService {
  private stripe: Stripe | null = null;
  private apiUrl = `${environment.apiUrl}/stripe`;

  constructor(private http: HttpClient) {
    this.initializeStripe();
  }

  // Initialize Stripe with the publishable key
  private async initializeStripe(): Promise<void> {
    this.stripe = await loadStripe(environment.stripePublishableKey);
    if (!this.stripe) {
      console.error('Failed to initialize Stripe');
    }
  }

  // Create a Payment Intent by calling the backend
  createPaymentIntent(amount: number, currency: string = 'eur') {
    return this.http.post<any>(`${this.apiUrl}/create-payment-intent`, { amount, currency });
  }

  // Confirm the payment using the client secret
  async confirmCardPayment(clientSecret: string, cardElement: any, billingDetails: { name: string }) {
    if (!this.stripe) {
      throw new Error('Stripe is not initialized');
    }

    const result = await this.stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: billingDetails,
      },
    });

    if (result.error) {
      console.error('Payment failed:', result.error.message);
      return { success: false, error: result.error.message };
    }

    if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
      console.log('Payment successful!', result.paymentIntent);
      return { success: true, paymentIntent: result.paymentIntent };
    }

    return { success: false, error: 'Unexpected payment status' };
  }
}
