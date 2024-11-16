import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Community } from '../../models/Community';
import { CommunityService } from '../../services/community.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-create-community',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './create-community.component.html',
  styleUrls: ['./create-community.component.css']
})
export class CreateCommunityComponent {
  community: Community = {
    name: '',
    description: '',
    contributionFrequency: 'monthly',
    maxMembers: 0,
    cycleLockEnabled: false,
    backupFund: 0,
    availableBalance: 0,
    isPrivate: false,
    contributionLimit: 1000,
    adminId: "",
    membersList: [],
    members: 0,               // Initialize members
    contributions: 0,         // Initialize contributions
    nextPayout: new Date()    // Initialize nextPayout
  };

  constructor(
    private communityService: CommunityService,
    private authService: AuthService
  ) {
    // Initialize adminId with the current user's ID from AuthService
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.community.adminId = currentUser.user.id;
      console.log(this.community);
    }
  }

  onSubmit() {
    const currentUser = this.authService.currentUserValue;
  
    if (!currentUser) {
      console.error('User is not logged in');
      return;
    }
  
    this.community.adminId = currentUser.user.id;
    this.community.membersList = [
      {
        userId: currentUser.user.id,
        name: currentUser.user.name,
        email: currentUser.user.email,
        contributionsPaid: currentUser.user.contributions?.paid || 0
      }
    ];
  
    console.log('Creating community with the following data:', this.community);
  
    // Create a payload object with the required API fields
    const payload = {
      ...this.community,
      userId: currentUser.user.id,
      userName: currentUser.user.name,
      userEmail: currentUser.user.email
    };
  
    this.communityService.createCommunity(payload).subscribe(
      (createdCommunity) => {
        console.log('Community created successfully:', createdCommunity);
        // Redirect or show success message
      },
      (error) => {
        console.error('Error creating community:', error);
      }
    );
  }
  
}
