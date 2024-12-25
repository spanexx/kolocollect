import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommunityService } from '../../services/community.service';
import { AuthService } from '../../services/auth.service';
import { ICommunity, IMember } from '../../shared/models/Community';
import { IUser } from '../../shared/models/User';
import { ContributeFormComponent } from '../contribute-form/contribute-form.component';
import { IContribution } from '../../shared/models/Contribute';
import { ContributeService } from 'src/app/services/contribute.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-community-detail',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule, ContributeFormComponent],
  templateUrl: './community-detail.component.html',
  styleUrls: ['./community-detail.component.css'],
})
export class CommunityDetailComponent implements OnInit, OnDestroy {
  community?: ICommunity;
  communityId!: string;
  membersCount: number = 0;
  currentUser?: IUser;
  currentUserId?:  string;
  membersVisible: boolean = false; // Toggle visibility for members list
  showContributeModal: boolean = false;
  hasJoined: boolean = false; // Track if user has already joined

  private userSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private communityService: CommunityService,
    private authService: AuthService,
    private router: Router,
    private contributeService: ContributeService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const newCommunityId = params.get('id');
      if (newCommunityId !== this.communityId) {
        this.communityId = newCommunityId || '';
        this.loadCommunityDetails();
      }
    });

    console.log('AuthService currentUserValue:', this.authService.currentUserValue);
    this.currentUserId = this.authService.currentUserValue?.user?.id || null;
    console.log('Extracted currentUserId:', this.currentUserId);

    this.userSubscription = this.authService.currentUser.subscribe((user) => {
      if (!user) {
        this.router.navigate(['/sign-in']);
      } else {
        this.currentUser = user;
      }
    });

  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe(); // Avoid memory leaks
  }

  loadCommunityDetails(): void {
    if (!this.communityId) return;

    this.communityService.getCommunityById(this.communityId).subscribe(
      (community) => {
        this.community = community;
        console.log(community, this.currentUser?.id)


        this.updateMembersCount();
        this.hasJoined = this.community.members.some(
          (member) => member.userId ===   this.currentUserId
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
      this.membersCount = this.community.members.length || 0;
    }
  }

  toggleMembers(): void {
    this.membersVisible = !this.membersVisible;
  }

  joinCommunity(): void {
    if (this.hasJoined) {
      alert('You are already a member of this community.');
      return;
    }

    if (!this.currentUser) {
      alert('User is not logged in. Please log in and try again.');
      return;
    }

    this.communityService.joinCommunity(this.communityId, this.currentUser.id).subscribe(
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

  handleContribution(contribution: IContribution): void {
    this.contributeService.createContribution(contribution).subscribe(
      () => {
        alert('Contribution added successfully!');
        this.loadCommunityDetails();
      },
      (error) => {
        console.error('Error adding contribution:', error);
        alert('Failed to add contribution. Please try again later.');
      }
    );
  }
}
