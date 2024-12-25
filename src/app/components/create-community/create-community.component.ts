import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ICommunity, IMember } from '../../shared/models/Community';
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
  community: ICommunity = {
    _id: '',
    name: '',
    description: '',
    admin: '',
    totalContribution: 0,
    backupFund: 0,
    lockPayout: false,
    midCycle: [],
    cycles: [],
    members: [],
    settings: {
      contributionFrequency: 'Monthly',
      maxMembers: 10,
      backupFundPercentage: 5,
      isPrivate: false,
      minContribution: 100,
      penalty: 10,
      numMissContribution: 3,
      firstCycleMin: 5,
    },
    votes: [],
    contributions: 0,
    maxMembers: 10,
    nextPayout: new Date(),
    payoutDetails: undefined,
    contributionFrequency: 'Monthly', // Added default value
    cycleLockEnabled: false, // Added default value
    isPrivate: false, // Added default value
    contributionLimit: 1000, // Added default value
  };

  constructor(
    private communityService: CommunityService,
    private authService: AuthService
  ) {
    // Initialize admin with the current user's ID from AuthService
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.community.admin = currentUser.user.id;
    }
  }

  onSubmit() {
    const currentUser = this.authService.currentUserValue;

    if (!currentUser) {
      console.error('User is not logged in');
      return;
    }

    // Add the admin as the first member of the community
    const adminMember: IMember = {
      userId: currentUser.user.id,
      name: currentUser.user.name,
      email: currentUser.user.email,
      position: 1,
      contributionPaid: false,
      status: 'active',
      penalty: 0,
      missedContributions: [],
      paymentPlan: {
        type: 'Full',
        remainingAmount: 0,
        installments: 0,
      },
    };

    this.community.members = [adminMember];

    console.log('Creating community with the following data:', this.community);

    this.communityService.createCommunity(this.community).subscribe(
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
