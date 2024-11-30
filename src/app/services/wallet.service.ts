import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FixedFund, Transaction, Wallet } from '../models/Wallet';

@Injectable({
  providedIn: 'root',
})
export class WalletService {
  private apiUrl = `${environment.apiUrl}/api/wallet`; // API endpoint for wallet

  constructor(private http: HttpClient) {}

  // Get full wallet details for the current user (includes balance and transaction history)
  getWallet(userId: string): Observable<Wallet> {
    return this.http.get<Wallet>(`${this.apiUrl}/${userId}/full`);
  }

  // Get wallet balance for the current user
  getWalletBalance(userId: string): Observable<{ walletBalance: number }> {
    return this.http.get<{ walletBalance: number }>(`${this.apiUrl}/${userId}`);
  }

  // Add funds to the wallet
  addFunds(userId: string, amount: number, description: string): Observable<Wallet> {
    return this.http.post<Wallet>(`${this.apiUrl}/${userId}/add`, {
      amount,
      description,
    });
  }

  // Withdraw funds from the wallet
  withdrawFunds(userId: string, amount: number, description: string): Observable<Wallet> {
    return this.http.post<Wallet>(`${this.apiUrl}/${userId}/withdraw`, {
      amount,
      description,
    });
  }

  // Get transaction history for the wallet
  getTransactionHistory(userId: string, filterType: string): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.apiUrl}/${userId}/transactions`, {
      params: { filterType }, // pass the filterType as a query param
    });
  }
  


  // Fix funds (lock a specific amount for a period)
fixFunds(userId: string, amount: number, duration: number): Observable<Wallet> {
  return this.http.post<Wallet>(`${this.apiUrl}/${userId}/fix`, { amount, duration });
}

// Transfer funds to another user
transferFunds(userId: string, recipientId: string, amount: number, description: string): Observable<Wallet> {
  return this.http.post<Wallet>(`${this.apiUrl}/${userId}/transfer`, { recipientId, amount, description });
}

// Get fixed funds information
getFixedFunds(userId: string): Observable<FixedFund[]> {
  return this.http.get<FixedFund[]>(`${this.apiUrl}/${userId}/fixedFunds`);
}

}
