import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Contribution } from '../models/Contribute';
import { Community } from '../models/Community';

@Injectable({
  providedIn: 'root'
})
export class ContributionService {
  private apiUrl = `${environment.apiUrl}/api/contributions`;

  constructor(private http: HttpClient) {}

  // Create a new contribution
  createContribution(contribution: Contribution): Observable<Contribution> {
    return this.http.post<Contribution>(this.apiUrl, contribution);
  }

  // Fetch all contributions for a specific community
  getContributionsByCommunity(communityId: string): Observable<Contribution[]> {
    return this.http.get<Contribution[]>(`${this.apiUrl}/community/${communityId}`);
  }

  // Fetch all contributions for a specific user
  getContributionsByUser(userId: string): Observable<Contribution[]> {
    return this.http.get<Contribution[]>(`${this.apiUrl}/user/${userId}`);
  }


  addContribution(contribution: Contribution): Observable<Community> {
    return this.http.post<Community>('/api/contributions', contribution);
  }
  
}
