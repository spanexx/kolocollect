import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommunityService } from '../../services/community.service';
import { Community } from '../../models/Community';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-community-detail',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './community-detail.component.html',
  styleUrl: './community-detail.component.css'
})
export class CommunityDetailComponent implements OnInit {
  community?: Community;
  communityId!: string;
  currentUserId!: string | null;
  

  constructor(
    private route: ActivatedRoute,
    private communityService: CommunityService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    const storedCommunity = localStorage.getItem('community');
    if (storedCommunity) {
      this.community = JSON.parse(storedCommunity);
      this.communityId = this.community?._id ?? '';  // Ensure communityId is always a string
      console.log("Loaded from local storage:", this.community);
    } else {
      this.communityId = this.route.snapshot.paramMap.get('id') ?? '';  // Fallback to empty string if null
      this.loadCommunityDetails();
    }
    this.currentUserId = this.authService.getUserId();
  }
  
  loadCommunityDetails(): void {
    this.communityService.getCommunityById(this.communityId).subscribe(
      (community) => {
        this.community = community;
        localStorage.setItem('community', JSON.stringify(this.community)); // Save community to local storage

      },
      (error) => {
        console.error('Error fetching community details:', error);
      }
    );
  }
  

  joinCommunity(): void {
    if (this.currentUserId) {
      console.log("Community Id:", this.communityId, "User Id:", this.currentUserId)
      this.communityService.joinCommunity(this.communityId, this.currentUserId).subscribe(
        (response) => {
          console.log('Successfully joined community:', response);
          this.loadCommunityDetails();
        },
        (error) => {
          console.error('Error joining community:', error);
        }
      );
    } else {
      console.error('User is not logged in');
      this.router.navigate(['/sign-in']);  // Redirect to login if user is not logged in
    }
  }
}