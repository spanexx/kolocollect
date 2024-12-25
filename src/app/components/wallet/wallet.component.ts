import { Component, OnInit } from '@angular/core';
import { Transaction, Wallet, FixedFund } from '../../shared/models/Wallet';
import { WalletService } from '../../services/wallet.service';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.css'],
})
export class WalletComponent implements OnInit {
  userId: string | null = null;
  wallet: Wallet | null = null;
  transactions: Transaction[] = [];
  walletBalance: number = 0;
  fixedFunds: FixedFund[] = [];
  fixedAmount: number = 0;
  transferAmount: number = 0;
  recipientId: string = '';
  filterType: string = 'all';
  filteredTransactions: Transaction[] = [];
  recentActivities: string[] = [];
  fixDuration: number = 1; // Default duration in days

  showFixForm: boolean = false;
  showTransferForm: boolean = false;

  constructor(
    private walletService: WalletService, 
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit(): void {

    this.userId = this.authService.currentUserValue.user.id;
    console.log('Extracted currentUserId:', this.userId);
    if (this.userId) {
      this.loadWalletDetails();
      this.loadTransactionHistory();
      this.loadWalletBalance();
      this.loadFixedFunds();
      this.loadRecentActivities();
    }
  }

  loadWalletDetails(): void {
    if (this.userId) {
      this.walletService.getWalletDetails(this.userId).subscribe({
        next: (wallet: Wallet) => {
          this.wallet = wallet;
        },
        error: (err: any) => console.error('Error loading wallet details:', err),
      });
    }
  }

  loadWalletBalance(): void {
    if (this.userId) {
      this.walletService.getWalletBalance(this.userId).subscribe({
        next: (response: { availableBalance: number; fixedBalance: number; totalBalance: number }) => {
          console.log("Total Balance: " ,response)
          this.walletBalance = response.availableBalance;
        },
        error: (err: any) => console.error('Error loading wallet balance:', err),
      });
    }
  }

  loadTransactionHistory(): void {
    if (this.userId) {
      this.walletService.getTransactionHistory(this.userId).subscribe({
        next: (transactions: Transaction[]) => {
          this.transactions = transactions;
          this.filteredTransactions = transactions;
        },
        error: (err: any) => console.error('Error loading transactions:', err),
      });
    }
  }

  filterTransactions(): void {
    if (this.filterType === 'all') {
      this.filteredTransactions = this.transactions;
    } else {
      this.filteredTransactions = this.transactions.filter(
        (transaction) => transaction.type === this.filterType
      );
    }
  }

  loadFixedFunds(): void {
    if (this.userId) {
      this.walletService.getFixedFunds(this.userId).subscribe({
        next: (fixedFunds: FixedFund[]) => {
          this.fixedFunds = fixedFunds;
        },
        error: (err: any) => console.error('Error loading fixed funds:', err),
      });
    }
  }

  loadRecentActivities(): void {
    this.recentActivities = [
      'Added funds: 500 USD',
      'Withdrawn funds: 200 USD',
      'Fixed 100 USD for 30 days',
      'Transferred 50 USD to user123',
    ];
  }

  fixFunds(): void {
    if (this.fixedAmount > 0) {
      this.walletService.fixFunds(this.userId!, this.fixedAmount, this.fixDuration).subscribe({
        next: () => {
          this.loadWalletBalance();
          this.loadFixedFunds();
          this.recentActivities.push(`Fixed ${this.fixedAmount} USD for ${this.fixDuration} days`);
          this.fixedAmount = 0;
          this.showFixForm = false;
        },
        error: (err: any) => console.error('Error fixing funds:', err),
      });
    } else {
      console.error('Amount must be greater than zero');
    }
  }

  transferFunds(): void {
    if (this.transferAmount > 0 && this.recipientId) {
      const description = `Transfer to ${this.recipientId}`;
      this.walletService
        .transferFunds(this.userId!, this.transferAmount, this.recipientId, description)
        .subscribe({
          next: () => {
            this.loadWalletBalance();
            this.recentActivities.push(`Transferred ${this.transferAmount} USD to ${this.recipientId}`);
            this.transferAmount = 0;
            this.recipientId = '';
            this.showTransferForm = false;
          },
          error: (err: any) => console.error('Error transferring funds:', err),
        });
    } else {
      console.error('Amount and recipient ID are required');
    }
  }

  toggleFixForm(): void {
    this.showFixForm = !this.showFixForm;
  }

  toggleTransferForm(): void {
    this.showTransferForm = !this.showTransferForm;
  }
}
