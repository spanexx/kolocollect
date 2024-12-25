import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FixedFund, Transaction, Wallet } from '@models/Wallet';



@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private apiUrl = `${environment.apiUrl}/wallet`;

  constructor(private http: HttpClient) {}

  // Fetch wallet balance
  getWalletBalance(userId: string): Observable<{
    availableBalance: number;
    fixedBalance: number;
    totalBalance: number;
  }> {
    return this.http.get<{
      availableBalance: number;
      fixedBalance: number;
      totalBalance: number;
    }>(`${this.apiUrl}/${userId}/balance`);
  }

  // Fetch full wallet details
  getWalletDetails(userId: string): Observable<Wallet> {
    return this.http.get<Wallet>(`${this.apiUrl}/${userId}`);
  }

  // Create a wallet
  createWallet(walletData: Partial<Wallet>): Observable<Wallet> {
    return this.http.post<Wallet>(`${this.apiUrl}/create`, walletData);
  }

  // Add funds to wallet
  addFunds(userId: string, amount: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/add-funds`, { userId, amount });
  }

  // Withdraw funds from wallet
  withdrawFunds(userId: string, amount: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/withdraw-funds`, { userId, amount });
  }

  // Transfer funds to another wallet
  transferFunds(
    userId: string,
    amount: number,
    recipientId: string,
    description?: string
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/transfer-funds`, {
      userId,
      amount,
      recipientId,
      description,
    });
  }

  // Fetch wallet transaction history
// Fetch wallet transaction history with an optional filter type
getTransactionHistory(userId: string, filterType: string = 'all'): Observable<Transaction[]> {
  const url = `${this.apiUrl}/${userId}/transactions?filterType=${filterType}`;
  return this.http.get<Transaction[]>(url);
}


  // Fix funds (lock funds for a specific duration)
  fixFunds(userId: string, amount: number, duration: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/fix-funds`, {
      amount,
      duration,
    });
  }

  // Get fixed funds
  getFixedFunds(userId: string): Observable<FixedFund[]> {
    return this.http.get<FixedFund[]>(`${this.apiUrl}/${userId}/fixed-funds`);
  }
}
