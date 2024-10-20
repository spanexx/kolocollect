import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommunityService } from '../../services/community.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-join-community',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './join-community.component.html',
  styleUrl: './join-community.component.css'
})
export class JoinCommunityComponent implements OnInit {
  joinForm!: FormGroup;
  communityId: string = ''; // To hold community ID from route

  constructor(
    private fb: FormBuilder,
    private communityService: CommunityService,
    private authService: AuthService, // For user data
    private router: Router,
    private route: ActivatedRoute // For fetching community ID from route
  ) {}

  ngOnInit(): void {
    // Fetch community ID from route if available
    this.communityId = this.route.snapshot.paramMap.get('id') || '';

    // Pre-fill user details using AuthService
    const userName = this.authService.getUserId(); // Fetch logged-in user name or ID

    // Initialize the form
    this.joinForm = this.fb.group({
      communityId: [this.communityId, Validators.required],
      userName: ["", Validators.required] // Pre-fill the user name
    });
  }

  onSubmit(): void {
    const communityId = this.joinForm.value.communityId;
    const userId = this.authService.getUserId(); // Automatically get user ID from auth service

    if (userId) {
      this.communityService.joinCommunity(communityId, userId).subscribe({
        next: (response) => {
          console.log('Successfully joined community:', response);
          this.router.navigate(['/community', communityId]); // Redirect to community detail page
        },
        error: (error) => {
          console.error('Error joining community:', error);
        }
      });
    } else {
      console.error('User is not logged in');
    }
  }
}