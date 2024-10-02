import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  userName = 'John Doe'; // Example user name
  totalCommunities = 5; // Example stat
  totalContributions = 20;
  totalSavings = 1500; // Example savings amount
  upcomingPayout = new Date(); // Example upcoming payout date

  recentActivities = [
    'Contributed $100 to the "New Car Fund"',
    'Joined the "Wedding Fund" community',
    'Received a $500 payout from the "Home Savings" group'
  ];

  savingsGoals = [
    { name: 'New Car Fund', progress: 50 },
    { name: 'Wedding Fund', progress: 75 }
  ];

  userCommunities = [
    { id: 1, name: 'Home Savings', nextContribution: new Date() },
    { id: 2, name: 'Vacation Fund', nextContribution: new Date() }
  ];
}
