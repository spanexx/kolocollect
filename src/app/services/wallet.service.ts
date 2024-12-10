import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FixedFund, Transaction, Wallet } from '../models/Wallet';

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private apiUrl = `${environment.apiUrl}/api/wallet`;

  constructor(private http: HttpClient) {}

  getWallet(userId: string): Observable<Wallet> {
    return this.http.get<Wallet>(`${this.apiUrl}/${userId}/full`);
  }

  getWalletBalance(userId: string): Observable<{ availableBalance: number; totalBalance: number }> {
    return this.http.get<{ availableBalance: number; totalBalance: number }>(`${this.apiUrl}/${userId}/balance`);
  }

  // Updated addFunds method with captchaResponse
  addFunds(userId: string, amount: number, paymentMethodId: string, captchaResponse: string): Observable<{ clientSecret: string }> {
    return this.http.post<{ clientSecret: string }>(`${this.apiUrl}/${userId}/add`, { 
      amount, 
      paymentMethodId, 
      captchaResponse // Include the CAPTCHA response
    });
  }

  withdrawFunds(userId: string, amount: number, description: string): Observable<Wallet> {
    return this.http.post<Wallet>(`${this.apiUrl}/${userId}/withdraw`, { amount, description });
  }

  getTransactionHistory(userId: string, filterType: string): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.apiUrl}/${userId}/transactions`, { params: { filterType } });
  }

  fixFunds(userId: string, amount: number, duration: number): Observable<Wallet> {
    return this.http.post<Wallet>(`${this.apiUrl}/${userId}/fix`, { amount, duration });
  }

  transferFunds(userId: string, recipientId: string, amount: number, description: string): Observable<Wallet> {
    return this.http.post<Wallet>(`${this.apiUrl}/${userId}/transfer`, { recipientId, amount, description });
  }

  getFixedFunds(userId: string): Observable<FixedFund[]> {
    return this.http.get<FixedFund[]>(`${this.apiUrl}/${userId}/fixedFunds`);
  }

  getWalletByUserId(userId: string): Observable<Wallet> {
    return this.http.get<Wallet>(`http://localhost:5000/api/user/${userId}/wallet`);
  }
}
