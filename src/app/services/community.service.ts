import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Community } from '../models/Community';
import { AuthService } from './auth.service';
import { Contribution } from '../models/Contribute';

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private apiUrl = `${environment.apiUrl}/api/communities`;
  private currentUserId: string | null = null;

  constructor(private http: HttpClient, private authService: AuthService) {
    // Initialize current user ID from AuthService
    this.currentUserId = this.authService.currentUserValue?.user?._id;
  }

  // Fetch all communities
  getCommunities(): Observable<Community[]> {
    return this.http.get<Community[]>(this.apiUrl);
  }

  // Fetch a community by ID
  getCommunityById(id: string): Observable<Community> {
    if (!id) {
      console.error('Community ID is required.');
      return new Observable<Community>();
    }
    return this.http.get<Community>(`${this.apiUrl}/${id}`);
  }

  // Join a community
  joinCommunity(joinRequest: { userId: string; communityId: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${joinRequest.communityId}/join`, {
      userId: joinRequest.userId,
    });
  }

  // Create a new community
  createCommunity(communityData: Community): Observable<Community> {
    return this.http.post<Community>(`${this.apiUrl}/create`, communityData);
  }

  // Update a community by ID
  updateCommunity(id: string, communityData: Community): Observable<Community> {
    return this.http.put<Community>(`${this.apiUrl}/update/${id}`, communityData);
  }

  // Delete a community by ID
  deleteCommunity(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete/${id}`);
  }

  // Search for communities by name
  searchCommunities(query: string): Observable<Community[]> {
    return this.http.get<Community[]>(`${this.apiUrl}?search=${query}`);
  }

  // Add a contribution to a community
  addContribution(contribution: Contribution): Observable<Community> {
    const apiUrl = `${environment.apiUrl}/api/contributions`; // Ensure environment-based URL is used
    return this.http.post<Community>(apiUrl, contribution);
  }
}
