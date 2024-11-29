import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ContributionService } from '../../services/contribute.service';
import { Contribution } from '../../models/Contribute';
import { CommunityService } from '../../services/community.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contribute-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './contribute-form.component.html',
  styleUrls: ['./contribute-form.component.css'],
})
export class ContributeFormComponent implements OnInit {
  @Input() communityId: string = '';
  @Input() contributionDate: Date | null = null;
  @Input() showModal: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() contributionSubmitted = new EventEmitter<Contribution>();

  contributionAmount: number = 0;
  paymentMethod: string = '';
  currentUser: any;
  community: any;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private contributionService: ContributionService,
    private communityService: CommunityService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.communityId = this.route.snapshot.paramMap.get('id')!;
    this.currentUser = this.authService.currentUserValue?.user;

    if (!this.currentUser) {
      this.router.navigate(['/sign-in']);
      return;
    }

    // Fetch community details
    this.fetchCommunity();
  }

  fetchCommunity(): void {
    this.communityService.getCommunityById(this.communityId).subscribe({
      next: (community) => {
        this.community = community;
      },
      error: (err) => {
        console.error('Error fetching community details:', err);
      },
    });
  }

  openModal(): void {
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.close.emit(); // Emit event to close modal
  }

  submitContribution(): void {
    if (this.contributionAmount <= 0 || !this.paymentMethod) {
      alert('Please enter a valid amount and payment method.');
      return;
    }

    // Construct contribution object
    const contribution: Contribution = {
      userId: this.currentUser.id,
      communityId: this.communityId,
      amount: this.contributionAmount,
      contributionDate: (this.contributionDate || new Date()).toISOString(),
      status: 'Pending',
      paymentMethod: this.paymentMethod,
    };

    // Emit contribution to parent component
    this.contributionSubmitted.emit(contribution);

    // Optionally, send the contribution to the backend
    this.contributionService.createContribution(contribution).subscribe({
      next: (response) => {
        console.log('Contribution Response:', response);

        // Optionally update local community data
        if (this.community) {
          this.community.contributions = (this.community.contributions || 0) + this.contributionAmount;
          this.community.contributionsList = this.community.contributionsList || [];
          this.community.contributionsList.push(contribution);
        }

        this.closeModal();
        this.router.navigate([`/community/${this.communityId}`]);
      },
      error: (error) => {
        console.error('Error creating contribution:', error);
      },
    });
  }
}
