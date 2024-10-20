import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Community } from '../models/Community';

@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  private apiUrl = `${environment.apiUrl}/api/communities`;

  constructor(private http: HttpClient) {}

  // Fetch all communities
  getCommunities(): Observable<Community[]> {
    return this.http.get<Community[]>(this.apiUrl);
  }

  // Fetch a community by ID
  getCommunityById(id?: string): Observable<Community> {
    const storedCommunity = localStorage.getItem('community');
    const communityId = id || (storedCommunity ? JSON.parse(storedCommunity)._id : null);

    if (!communityId) {
      throw new Error('Community ID is not available.');
    }
  
    return this.http.get<Community>(`${this.apiUrl}/${communityId}`);
  }
  

  // Create a new community
  createCommunity(communityData: Community): Observable<Community> {
    return this.http.post<Community>(this.apiUrl, communityData);
  }

  // Join a community
  joinCommunity(communityId: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/join`, { communityId, userId });
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
}