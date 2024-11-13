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

  constructor(
    private authService: AuthService, 
    private router: Router
  ) {}

  ngOnInit(): void {
    // Get the current user from AuthService
    const currentUser = this.authService.currentUserValue?.user;

    if (currentUser) {
      // Set user data from AuthService
      this.user = currentUser;
      this.totalContributions = currentUser.contributions ? currentUser.contributions.length : 0;
      this.totalSavings = currentUser.totalSavings || 0;
      this.upcomingPayout = currentUser.upcomingPayout || null;
      this.recentActivities = currentUser.recentActivities || [];
      this.savingsGoals = currentUser.savingsGoals || [];

      // Get the communities from the current user object
      this.userCommunities = currentUser.communities || [];
      this.totalCommunities = this.userCommunities.length;

    } else {
      console.error('User is not logged in. Redirecting to login.');
      this.router.navigate(['/login']);
    }
  }
}
