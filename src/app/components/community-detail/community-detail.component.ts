import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-community-detail',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './community-detail.component.html',
  styleUrl: './community-detail.component.css'
})
export class CommunityDetailComponent {
  community = {
    id: 1,
    name: 'Home Savings',
    description: 'Saving for a new home.',
    members: 10,
    contributions: 15000,
    nextPayout: new Date(),
    membersList: [
      { name: 'John Doe' },
      { name: 'Jane Smith' },
      { name: 'Michael Brown' }
    ]
  };
}
