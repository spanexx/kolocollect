import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommunityService } from '../../services/community.service';
import { AuthService } from '../../services/auth.service';
import { Community } from '../../models/Community';
import { User } from '../../models/User';  // Import User model
import { ContributeFormComponent } from '../contribute-form/contribute-form.component';

@Component({
  selector: 'app-community-detail',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule, ContributeFormComponent],
  templateUrl: './community-detail.component.html',
  styleUrls: ['./community-detail.component.css']
})
export class CommunityDetailComponent implements OnInit {
  community?: Community;
  communityId!: string;
  membersCount: number = 0; 
  currentUser!: User; 
  customDate: Date = new Date('2024-11-16'); // Example date

  membersVisible: boolean = false; 
  showContributeModal: boolean = false; // Flag to control modal visibility

  constructor(
    private route: ActivatedRoute,
    private communityService: CommunityService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.communityId = this.route.snapshot.paramMap.get('id') ?? '';

    // Get current user from AuthService
    this.currentUser = this.authService.currentUserValue.user;
    console.log(this.currentUser.id);

    // If no current user, redirect to sign-in
    if (!this.currentUser) {
      console.error('User is not logged in. Redirecting to sign-in.');
      this.router.navigate(['/sign-in']);
      return;
    }

    const storedCommunity = localStorage.getItem('community');
    if (storedCommunity) {
      // If a community is already in local storage, load it
      const parsedCommunity = JSON.parse(storedCommunity);
      // Check if the communityId from the route matches the stored one
      if (parsedCommunity?._id === this.communityId) {
        this.community = parsedCommunity;
        this.updateMembersCount(); // Update the members count based on local storage
      } else {
        // If the communityId doesn't match, fetch it from the API
        this.loadCommunityDetails();
      }
    } else {
      // If there's no community in local storage, fetch it from the API
      this.loadCommunityDetails();
    }
  }

  loadCommunityDetails(): void {
    if (!this.communityId) {
      console.error('Community ID is missing');
      return;
    }

    this.communityService.getCommunityById(this.communityId).subscribe(
      (community) => {
        console.log('Community details returned from API:', community);
        
        this.community = community;
        this.updateMembersCount(); // Update members count after loading from API

        // Save community to local storage
        localStorage.setItem('community', JSON.stringify(this.community));
      },
      (error) => {
        console.error('Error fetching community details:', error);
      }
    );
  }

  // Method to calculate and update the members count
  updateMembersCount(): void {
    if (this.community) {
      this.membersCount = this.community.membersList?.length || 0;
    }
  }

  joinCommunity(): void {
    if (!this.authService.isLoggedIn()) {
      console.error('User is not logged in. Redirecting to sign-in.');
      this.router.navigate(['/sign-in'], { queryParams: { redirectUrl: this.router.url } });
      return;
    }
  
    const currentUserId = this.authService.currentUserValue?.user?.id;

    console.log('Current user ID:', currentUserId);
    console.log('Current community ID:', this.communityId);
  
    if (!currentUserId || !this.communityId) {
      console.error('Missing user ID or community ID.');
      return;
    }
  
    const joinRequest = {
      userId: currentUserId,
      communityId: this.communityId
    };
  
    this.communityService.joinCommunity(joinRequest).subscribe({
      next: (response) => {
        console.log('Successfully joined community:', response);
        this.loadCommunityDetails();  // Reload community details after joining
      },
      error: (error) => {
        if (error.status === 401 && error.message.includes("Cycle lock is enabled")) {
          alert(error.message);
        } else {
          console.error("Error joining community:", error);
        }
      }
    });
  }

  goToCommunitySettings(): void {
    this.router.navigate([`/community/${this.communityId}/settings`]);
  }

  // Modified to open the modal instead of navigating to a new route
  goToContributeForm(): void {
    this.showContributeModal = true; // Show the modal when the contribute button is clicked
  }

  // Method to close the modal
  closeContributeModal(): void {
    this.showContributeModal = false; // Hide the modal when closing
  }

  toggleMembers() {
    this.membersVisible = !this.membersVisible;
  }
}
