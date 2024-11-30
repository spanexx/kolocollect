import { Component, OnInit } from '@angular/core';
import { WalletService } from '../../../services/wallet.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-withdraw-fund',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './withdraw-fund.component.html',
  styleUrl: './withdraw-fund.component.css'
})
export class WithdrawFundComponent implements OnInit {
  userId: string | null = null;
  amount: number = 0;
  description: string = '';

  constructor(
    private walletService: WalletService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userId = localStorage.getItem('userId');
  }

  withdrawFunds(): void {
    if (this.userId && this.amount > 0) {
      this.walletService.withdrawFunds(this.userId, this.amount, this.description).subscribe({
        next: (wallet) => {
          console.log('Funds withdrawn successfully', wallet);
          this.router.navigate(['/wallet']); // Redirect to wallet page
        },
        error: (err) => console.error('Error withdrawing funds:', err),
      });
    }
  }
}