import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IContribution } from '@models/Contribute';
import { CommunityService } from '../../services/community.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContributeService } from 'src/app/services/contribute.service';
import { IPaymentPlan } from '@models/Community';

@Component({
  selector: 'app-contribute-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './contribute-form.component.html',
  styleUrls: ['./contribute-form.component.css'],
})
export class ContributeFormComponent implements OnInit {
  @Input() communityId: string = '';
  @Input() showModal: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() contributionSubmitted = new EventEmitter<IContribution>();

  contributionAmount: number = 0;
  paymentMethod: string = '';
  cycleNumber: number | null = null; // Allow user to select a cycle
  midCycleId: string | null = null; // Optionally select mid-cycle
  paymentPlans: Array<'Full' | 'Incremental' | 'Shortfall'> = ['Full', 'Incremental', 'Shortfall']; // Supported payment plans
  selectedPaymentPlan: 'Full' | 'Incremental' | 'Shortfall' = 'Full';

  currentUser: any;
  community: any;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private contributionService: ContributeService,
    private communityService: CommunityService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.communityId = this.route.snapshot.paramMap.get('id') || this.communityId;
    this.currentUser = this.authService.currentUser?.subscribe((user) => {
      this.currentUser = user;
      if (!this.currentUser) {
        this.router.navigate(['/sign-in']);
      }
    });

    this.fetchCommunity();
  }

  fetchCommunity(): void {
    this.communityService.getCommunityById(this.communityId).subscribe({
      next: (community) => {
        this.community = community;
        if (this.community?.cycles?.length) {
          this.cycleNumber = this.community.cycles[0].cycleNumber; // Default to the first cycle
        }
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
    if (this.contributionAmount <= 0) {
      alert('Please enter a valid contribution amount.');
      return;
    }
    if (!this.paymentMethod) {
      alert('Please select a payment method.');
      return;
    }
    if (!this.cycleNumber) {
      alert('Please select a valid cycle.');
      return;
    }

    // Construct contribution object
    const contribution: IContribution = {
      _id: '', // Will be assigned by the backend
      userId: this.currentUser.id,
      communityId: this.communityId,
      amount: this.contributionAmount,
      cycleNumber: this.cycleNumber,
      midCycleId: this.midCycleId || undefined,
      status: 'pending',
      date: new Date(),
      penalty: 0,
      paymentPlan: {
        type: this.selectedPaymentPlan,
        remainingAmount: this.contributionAmount,
        installments: 0,
      },
    };

    // Emit contribution to parent component
    this.contributionSubmitted.emit(contribution);

    // Send the contribution to the backend
    this.contributionService.createContribution(contribution).subscribe({
      next: (response) => {
        console.log('Contribution created successfully:', response);
        this.closeModal();
        this.router.navigate([`/community/${this.communityId}`]);
      },
      error: (error) => {
        console.error('Error creating contribution:', error);
      },
    });
  }
}
