import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommunityService } from '../../services/community.service';
import { AuthService } from '../../services/auth.service';
import { Community } from '../../models/Community';
import { User } from '../../models/User';
import { ContributeFormComponent } from '../contribute-form/contribute-form.component';
import { Contribution } from '../../models/Contribute';

@Component({
  selector: 'app-community-detail',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule, ContributeFormComponent],
  templateUrl: './community-detail.component.html',
  styleUrls: ['./community-detail.component.css'],
})
export class CommunityDetailComponent implements OnInit {
  community?: Community;
  communityId!: string;
  membersCount: number = 0;
  currentUser!: User;
  membersVisible: boolean = false; // Toggle visibility for members list
  showContributeModal: boolean = false;
  hasJoined: boolean = false; // Track if user has already joined

  constructor(
    private route: ActivatedRoute,
    private communityService: CommunityService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const newCommunityId = params.get('id');
      if (newCommunityId !== this.communityId) {
        this.communityId = newCommunityId || '';
        this.loadCommunityDetails();
      }
    });

    this.currentUser = this.authService.currentUserValue?.user;
    if (!this.currentUser) {
      this.router.navigate(['/sign-in']);
    }
  }

  loadCommunityDetails(): void {
    if (!this.communityId) return;
  
    this.communityService.getCommunityById(this.communityId).subscribe(
      (community) => {
        this.community = community;
        this.updateMembersCount();
        this.hasJoined = this.community.membersList?.some(
          (member) => member.userId === this.currentUser.id
        );
        localStorage.setItem('community', JSON.stringify(this.community));
      },
      (error) => {
        console.error('Error fetching community details:', error);
        alert('Failed to load community details. Please try again later.');
      }
    );
  }
  

  updateMembersCount(): void {
    if (this.community) {
      this.membersCount = this.community.membersList?.length || 0;
    }
  }

  goToCommunitySettings(): void {
    this.router.navigate(['/community', this.communityId, 'settings']);
  }

  toggleMembers(): void {
    this.membersVisible = !this.membersVisible;
  }

  joinCommunity(): void {
    if (this.hasJoined) {
      alert('You are already a member of this community.');
      return;
    }
  
    if (!this.currentUser?.id) {
      alert('User ID is not available. Please log in again.');
      return;
    }
  
    const joinRequest = {
      userId: this.currentUser.id, // Ensure currentUser.id is defined
      communityId: this.communityId,
    };
  
    this.communityService.joinCommunity(joinRequest).subscribe(
      () => {
        this.hasJoined = true;
        this.loadCommunityDetails(); // Refresh details after joining
        alert('You have successfully joined the community!');
      },
      (error) => {
        console.error('Error joining community:', error);
        alert('Failed to join the community. Please try again later.');
      }
    );
  }
  
  goToContributeForm(): void {
    this.showContributeModal = true;
  }

  closeContributeModal(): void {
    this.showContributeModal = false;
    this.loadCommunityDetails(); // Reload to reflect changes
  }

  handleContribution(contribution: Contribution): void {
    this.communityService.addContribution(contribution).subscribe(
      () => alert('Contribution added successfully!'),
      (error) => {
        console.error('Error adding contribution:', error);
        alert('Failed to add contribution. Please try again later.');
      }
    );
  }
}
