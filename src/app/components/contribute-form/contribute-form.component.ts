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
  styleUrl: './contribute-form.component.css'
})
export class ContributeFormComponent implements OnInit {
  @Input() communityId: string = '';
  @Input() contributionDate: Date | null = null; // New Input
  contributionAmount: number = 0;
  paymentMethod: string = '';
  currentUser: any;
  @Input() showModal: boolean = false;  // Control modal visibility
  @Output() close = new EventEmitter<void>(); // Event to close modal


  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private contributionService: ContributionService,
    private communityService: CommunityService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.communityId = this.route.snapshot.paramMap.get('id')!;
    this.currentUser = this.authService.currentUserValue.user;

    if (!this.currentUser) {
      this.router.navigate(['/sign-in']);
    }
  }

  openModal() {
    this.showModal = true;
  }
// contribute-form.component.ts

closeModal(): void {
  this.close.emit(); // Emit event to close modal
}

submitContribution() {
  if (this.contributionAmount <= 0 || !this.paymentMethod) {
    alert("Please enter a valid amount and payment method.");
    return;
  }

  const contribution: Contribution = {
    userId: this.currentUser.id,
    communityId: this.communityId,
    amount: this.contributionAmount,
    contributionDate: (this.contributionDate || new Date()).toISOString(),
    status: 'Pending',
    paymentMethod: this.paymentMethod,
  };

  this.contributionService.createContribution(contribution).subscribe(
    response => {
      console.log('Contribution Response:', response);

      // Fetch and update community details locally
      this.communityService.getCommunityById(this.communityId).subscribe(
        community => {
          console.log('Original Community Details:', community);

          // Calculate 10% for backup fund and 90% for community available balance
          const backupAmount = this.contributionAmount * 0.1;
          const availableAmount = this.contributionAmount * 0.9;

          community.backupFund += backupAmount;
          community.contributions += this.contributionAmount; // Total contributions
          community.availableBalance += availableAmount;

          // Update the user's contributionsPaid in membersList
          const member = community.membersList.find(m => m.userId === this.currentUser.id);
          if (member) {
            member.contributionsPaid = (member.contributionsPaid || 0) + this.contributionAmount;
          }

          console.log('Updated Community Details (Frontend):', community);
        },
        error => {
          console.error('Error fetching updated community:', error);
        }
      );

      this.closeModal(); // Close modal after success
      this.router.navigate([`/community/${this.communityId}`]);
    },
    error => {
      console.error('Error creating contribution:', error);
    }
  );
}


}