import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IActivity, IContribution, IPayout, IUser } from '../../shared/models/User';
import { ICommunity } from '../../shared/models/Community';
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
  user!: IUser ;
  totalCommunities: number = 0;
  totalContributions: number = 0;
  totalSavings: number = 0;
  upcomingPayout: Date | null = null;
  upcomingPayouts: IPayout[] = [];
  totalPenalties: number = 0;
  totalContributed: number = 0;
  walletBalance: number = 0;
  userCommunities: ICommunity[] = [];
  recentActivities: IActivity[] = [];
  userContributions: IContribution[] = [];
  recentTransactions: { date: string, amount: number, type: string }[] = [];

  savingsGoals: { name: string; progress: number }[] = [];
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
      console.log(this.user)
      this.loadWalletBalance();
      this.loadUserCommunities();
      this.loadUserContributions();
      this.loadUserPayouts();
      this.loadActivityLogs();

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
      
      this.userService.getUserCommunities(this.user.id).subscribe(
        (communities) => {
          console.log(communities)
          this.userCommunities = communities;
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


  // Load wallet balance
  loadWalletBalance() {
    this.walletService.getWalletBalance(this.user.id).subscribe(
      (response) => {
        this.walletBalance = response.availableBalance;
      },
      (error) => {
        if (error.status === 404) {
          console.error('Wallet not found.');
        } else {
          console.error('Error fetching wallet balance:', error);
        }
      }
    );
  }

  // Load user communities
  loadUserCommunities() {
    this.userService.getUserCommunities(this.user.id).subscribe(
      (communities) => {
        this.userCommunities = communities;
      },
      (error) => {
        console.error('Error fetching user communities:', error);
      }
    );
  }

// Load user contributions
loadUserContributions() {
  this.userService.getUserContributions(this.user.id).subscribe(
    (response) => {
      // Extract contributions from the API response
      const contributions = response.contributions;
      this.totalSavings = contributions[0].totalContributed

      if (Array.isArray(contributions)) {
        this.userContributions = contributions;

        // Sum up totalContributed directly from contributions
        this.totalContributions = contributions.reduce(
          (total: number, c: IContribution) => total + c.totalContributed,
          0
        );
      } else {
        console.error('Invalid data type for contributions:', response);
        this.userContributions = [];
        this.totalContributions = 0;
      }
    },
    (error) => {
      console.error('Error fetching user contributions:', error);
      this.userContributions = [];
      this.totalContributions = 0;
    }
  );
}

  // Load user payouts
  loadUserPayouts() {
    this.userService.getUserPayouts(this.user.id).subscribe(
      (payouts) => {
        this.upcomingPayouts = payouts;
      },
      (error) => {
        console.error('Error fetching user payouts:', error);
      }
    );
  }

  // Load activity logs
  loadActivityLogs() {
    this.userService.getUserNotifications(this.user.id).subscribe(
      (activities) => {
        this.recentActivities = activities;
      },
      (error) => {
        console.error('Error fetching user activity logs:', error);
      }
    );
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