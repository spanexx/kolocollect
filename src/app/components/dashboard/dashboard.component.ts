import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { User } from '../../models/User';
import { Community } from '../../models/Community';
import { AuthService } from '../../services/auth.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { WalletService } from '../../services/wallet.service';
import { CommunityService } from '../../services/community.service';
import { UserService } from '../../services/user.service';


@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  animations: [
    trigger('expandCollapse', [
      transition(':enter', [
        style({ maxHeight: 0, opacity: 0 }),
        animate('300ms ease-out', style({ maxHeight: '200px', opacity: 1 })),
      ]),
      transition(':leave', [
        style({ maxHeight: '200px', opacity: 1 }),
        animate('300ms ease-in', style({ maxHeight: 0, opacity: 0 })),
      ]),
    ]),
  ]
})
export class DashboardComponent implements OnInit {
  user: User | null = null;
  totalCommunities: number = 0;
  totalContributions: number = 0;
  totalSavings: number = 0;
  upcomingPayout: Date | null = null;
  walletBalance: number = 0;
  recentTransactions: { date: string, amount: number, type: string }[] = [];

  recentActivities: string[] = [];
  savingsGoals: { name: string; progress: number }[] = [];
  userCommunities: Community[] = [];
  showNotifications = false;
  unreadNotificationsCount = 5;
  openCommunityId: string | null = null; // Track which community is open

  communityNotifications = [
    "New member joined your community",
    "Upcoming payout schedule updated",
    "Reminder: Contribution due in 3 days"
  ];

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private walletService: WalletService,
    private communityService: CommunityService

  ) {}

  ngOnInit(): void {
    const currentUser = this.authService.currentUserValue?.user;
    if (currentUser) {
      this.user = currentUser;
      this.totalContributions = currentUser.contributions ? currentUser.contributions.length : 0;
      this.totalSavings = currentUser.totalSavings || 0;
      this.upcomingPayout = currentUser.upcomingPayout || null;
      this.recentActivities = currentUser.recentActivities || [];
      this.savingsGoals = currentUser.savingsGoals || [];
      this.recentTransactions = currentUser.recentTransactions || [];

      // Fetch wallet balance
      this.walletService.getWalletBalance(currentUser.id).subscribe(
        (response) => {
          this.walletBalance = response.availableBalance;
        },
        (error) => {
          if (error.status === 404) {
            console.error('Wallet not found. Please check the user setup.');
          } else {
            console.error('Error fetching wallet balance:', error);
          }
        }
      );

      // Fetch user's communities
      
      this.userService.getUserCommunities().subscribe(
        (communities) => {
          this.userCommunities = communities.communities;
          this.totalCommunities = this.userCommunities.length;
          
        },
        (error) => {
          if (error.status === 404) {
            console.error('No communities found for user.');
          } else {
            console.error('Error fetching communities:', error);
          }
        }
      );

    } else {
      console.error('User is not logged in. Redirecting to login.');
      this.router.navigate(['/login']);
    }
  }

  // Toggle notifications
  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
  }

  // Toggle community details visibility
  toggleCommunityDetails(communityId: string) {
    this.openCommunityId = this.openCommunityId === communityId ? null : communityId;
  }

  // Navigate to create a new community
  createCommunity() {
    this.router.navigate(['/create-community']);
  }

  // Navigate to wallet details page
  viewWalletDetails() {
    this.router.navigate(['/wallet']);
  }

  // Method to add funds (mock)
  addFunds() {
    this.router.navigate(['/add-funds']);

  }
}