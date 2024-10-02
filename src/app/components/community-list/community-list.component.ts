import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-community-list',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './community-list.component.html',
  styleUrl: './../community/community.component.css'
})
export class CommunityListComponent {
  communities = [
    { id: 1, name: 'Home Savings', description: 'Saving for a new home.', members: 10 },
    { id: 2, name: 'Vacation Fund', description: 'Saving for vacations together.', members: 8 },
    { id: 3, name: 'Wedding Fund', description: 'Saving for wedding expenses.', members: 15 }
  ];
}
