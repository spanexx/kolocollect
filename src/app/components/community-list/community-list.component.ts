import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Community } from '../../models/Community';
import { CommunityService } from '../../services/community.service';

@Component({
  selector: 'app-community-list',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './community-list.component.html',
  styleUrls: ['./../community/community.component.css']
})
export class CommunityListComponent implements OnInit {
  communities: Community[] = [];

  constructor(private communityService: CommunityService) { }

  ngOnInit(): void {
    this.getCommunities();
  }

  getCommunities(): void {
    this.communityService.getCommunities().subscribe(
      (data: Community[]) => {
        // For each community, dynamically calculate the number of members
        this.communities = data.map(community => ({
          ...community,
          members: community.membersList?.length || 0 // Calculate members count dynamically
        }));
      },
      (error) => console.log('Error fetching communities', error)
    );
  }
}
