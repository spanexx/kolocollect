import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-create-community',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './create-community.component.html',
  styleUrl: './../community/community.component.css'
})
export class CreateCommunityComponent {
  community = {
    name: '',
    description: '',
    contributionFrequency: 'monthly'
  };

  onSubmit() {
    console.log('Community Created:', this.community);
  }
}
