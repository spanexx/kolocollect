import { Component, OnInit } from '@angular/core';
import { Transaction, Wallet, FixedFund } from '../../models/Wallet';
import { WalletService } from '../../services/wallet.service';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.css']
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
  
  // Declare fixDuration property here
  fixDuration: number = 1; // Default duration is 1 day

  // Flags for form visibility
  showFixForm: boolean = false;
  showTransferForm: boolean = false;

  constructor(
    private walletService: WalletService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.userId = localStorage.getItem('userId');
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
      this.walletService.getWallet(this.userId).subscribe({
        next: (wallet) => {
          this.wallet = wallet;
        },
        error: (err) => console.error('Error loading wallet details:', err),
      });
    }
  }

  loadWalletBalance(): void {
    if (this.userId) {
      this.walletService.getWalletBalance(this.userId).subscribe({
        next: (response) => {
          this.walletBalance = response.availableBalance;
        },
        error: (err) => console.error('Error loading wallet balance:', err),
      });
    }
  }

  loadTransactionHistory(): void {
    if (this.userId) {
      this.walletService.getTransactionHistory(this.userId, this.filterType).subscribe({
        next: (transactions) => {
          console.log(transactions)
          this.transactions = transactions;
          this.filteredTransactions = transactions;
        },
        error: (err) => console.error('Error loading transactions:', err),
      });
      
    }
  }
  filterTransactions(): void {
    if (this.userId && this.filterType === 'all') {
      this.walletService.getTransactionHistory(this.userId, this.filterType).subscribe({
        next: (transactions) => {
          this.transactions = transactions;
          this.filteredTransactions = transactions;
        },
        error: (err) => console.error('Error loading transactions:', err),
      });
      
    }else{
      this.filteredTransactions = this.transactions.filter(
        transaction => transaction.type === this.filterType

      )
    }
  }
  

  loadFixedFunds(): void {
    if (this.userId) {
      this.walletService.getFixedFunds(this.userId).subscribe({
        next: (fixedFunds) => {
          this.fixedFunds = fixedFunds;
        },
        error: (err) => console.error('Error loading fixed funds:', err),
      });
    }
  }

  loadRecentActivities(): void {
    this.recentActivities = [
      "Added funds: 500 USD",
      "Withdrawn funds: 200 USD",
      "Fixed 100 USD for 30 days",
      "Transferred 50 USD to user123"
    ];
  }

  fixFunds(): void {
    if (this.fixedAmount > 0) {
      this.walletService.fixFunds(this.userId!, this.fixedAmount, this.fixDuration).subscribe({
        next: (wallet) => {
          this.wallet = wallet;
          this.loadWalletBalance();
          this.loadFixedFunds();
          this.recentActivities.push(`Fixed ${this.fixedAmount} USD for ${this.fixDuration} days`);
          this.fixedAmount = 0;
          this.showFixForm = false;
        },
        error: (err) => console.error('Error fixing funds:', err),
      });
    } else {
      console.error('Amount must be greater than zero');
    }
  }

  transferFunds(): void {
    if (this.transferAmount > 0 && this.recipientId) {
      const description = `Transfer to ${this.recipientId}`;
      this.walletService
        .transferFunds(this.userId!, this.recipientId, this.transferAmount, description)
        .subscribe({
          next: (wallet) => {
            this.wallet = wallet;
            this.loadWalletBalance();
            this.recentActivities.push(`Transferred ${this.transferAmount} USD to ${this.recipientId}`);
            this.transferAmount = 0;
            this.recipientId = '';
            this.showTransferForm = false;
          },
          error: (err) => console.error('Error transferring funds:', err),
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
