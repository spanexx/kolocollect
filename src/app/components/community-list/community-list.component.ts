import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ICommunity } from '@models/Community';
import { CommunityService } from '../../services/community.service';

// Extend the ICommunity interface for UI purposes
interface ICommunityUI extends ICommunity {
  memberCount: number; // Add a computed member count property
}

@Component({
  selector: 'app-community-list',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './community-list.component.html',
  styleUrls: ['./../community/community.component.css']
})
export class CommunityListComponent implements OnInit {
  communities: ICommunityUI[] = []; // Use the extended interface

  constructor(private communityService: CommunityService) { }

  ngOnInit(): void {
    this.getCommunities();
  }

  getCommunities(): void {
    this.communityService.getAllCommunities().subscribe(
      (data: ICommunity[]) => {
        // Map the communities and calculate member count dynamically
        this.communities = data.map(community => ({
          ...community,
          memberCount: community.members?.length || 0 // Compute member count
        }));
      },
      (error) => console.log('Error fetching communities', error)
    );
  }
}
