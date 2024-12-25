import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { IContribution } from '@models/Contribute';



@Injectable({
  providedIn: 'root',
})
export class ContributeService {
  private apiUrl = `${environment.apiUrl}/contributions`;

  constructor(private http: HttpClient) {}

  // Fetch all contributions
  getAllContributions(): Observable<IContribution[]> {
    return this.http.get<IContribution[]>(`${this.apiUrl}`);
  }

  // Fetch a single contribution by ID
  getContributionById(id: string): Observable<IContribution> {
    return this.http.get<IContribution>(`${this.apiUrl}/${id}`);
  }

  // Create a new contribution
  createContribution(contributionData: IContribution): Observable<IContribution> {
    return this.http.post<IContribution>(`${this.apiUrl}/create`, contributionData);
  }

  // Update a contribution
  updateContribution(id: string, updates: Partial<IContribution>): Observable<IContribution> {
    return this.http.put<IContribution>(`${this.apiUrl}/${id}`, updates);
  }

  // Delete a contribution
  deleteContribution(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Fetch all contributions for a specific community
  getContributionsByCommunity(communityId: string): Observable<IContribution[]> {
    return this.http.get<IContribution[]>(`${this.apiUrl}/community/${communityId}`);
  }

  // Fetch all contributions by a specific user
  getContributionsByUser(userId: string): Observable<IContribution[]> {
    return this.http.get<IContribution[]>(`${this.apiUrl}/user/${userId}`);
  }

  // Fetch all missed contributions for a user in a community
  getMissedContributions(userId: string, communityId: string): Observable<IContribution[]> {
    return this.http.get<IContribution[]>(`${this.apiUrl}/missed?userId=${userId}&communityId=${communityId}`);
  }

  // Fetch total contributions for a community in a specific cycle
  getCycleTotal(communityId: string, cycleNumber: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/cycle-total?communityId=${communityId}&cycleNumber=${cycleNumber}`);
  }
}
