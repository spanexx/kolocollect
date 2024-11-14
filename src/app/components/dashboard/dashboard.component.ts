import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { User } from '../../models/User';
import { Community } from '../../models/Community';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  user: User | null = null;
  totalCommunities: number = 0;
  totalContributions: number = 0;
  totalSavings: number = 0;
  upcomingPayout: Date | null = null;

  recentActivities: string[] = [];
  savingsGoals: { name: string; progress: number }[] = [];
  userCommunities: Community[] = [];
  showNotifications = false; 
  unreadNotificationsCount = 5;

  communityNotifications = [
    "New member joined your community",
    "Upcoming payout schedule updated",
    "Reminder: Contribution due in 3 days"
  ];


  constructor(
    private authService: AuthService, 
    private router: Router
  ) {}
  ngOnInit(): void {
    // Get the current user from AuthService
    const currentUser = this.authService.currentUserValue?.user;
    console.log('Current User:', currentUser);  // Log the current user data
    
    if (currentUser) {
      // Set user data from AuthService
      this.user = currentUser;
      this.totalContributions = currentUser.contributions ? currentUser.contributions.length : 0;
      this.totalSavings = currentUser.totalSavings || 0;
      this.upcomingPayout = currentUser.upcomingPayout || null;
      this.recentActivities = currentUser.recentActivities || [];
      this.savingsGoals = currentUser.savingsGoals || [];
  
      // Pass the user ID to get the communities
      this.authService.getUserCommunities(currentUser.id).subscribe(
        (communities) => {
          this.userCommunities = communities;
          this.totalCommunities = this.userCommunities.length;
          console.log('User Communities:', this.userCommunities);  // Log the fetched communities
        },
        (error) => {
          console.error('Error fetching communities:', error);  // Log any errors
        }
      );

      
    } else {
      console.error('User is not logged in. Redirecting to login.');
      this.router.navigate(['/login']);
    }

    
  }
  

  createCommunity() {
    this.router.navigate(['/create-community']);
  }

    // Method to toggle notifications
    toggleNotifications() {
      this.showNotifications = !this.showNotifications;
    }
}
