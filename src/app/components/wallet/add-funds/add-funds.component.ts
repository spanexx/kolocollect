import { Component, OnInit } from '@angular/core';
import { WalletService } from '../../../services/wallet.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-funds',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './add-funds.component.html',
  styleUrl: './add-funds.component.css'
})
export class AddFundsComponent implements OnInit {
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

  addFunds(): void {
    if (this.userId && this.amount > 0) {
      this.walletService.addFunds(this.userId, this.amount, this.description).subscribe({
        next: (wallet) => {
          console.log('Funds added successfully', wallet);
          this.router.navigate(['/wallet']); // Redirect to wallet page
        },
        error: (err) => console.error('Error adding funds:', err),
      });
    }
  }
}