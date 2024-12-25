import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ICommunity } from '@models/Community';

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private apiUrl = `${environment.apiUrl}/communities`;

  constructor(private http: HttpClient) {}

  // Fetch all communities
  getAllCommunities(): Observable<ICommunity[]> {
    return this.http.get<ICommunity[]>(`${this.apiUrl}`);
  }

  getCommunityById(communityId: string): Observable<ICommunity>{
    return this.http.get<ICommunity>(`${this.apiUrl}/${communityId}`)
  }

  // Create a new community
  createCommunity(communityData: Partial<ICommunity>): Observable<ICommunity> {
    return this.http.post<ICommunity>(`${this.apiUrl}/create`, communityData);
  }



  // Join a community
  joinCommunity(communityId: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/join/${communityId}`, { userId });
  }

  // Start a new mid-cycle
  startMidCycle(communityId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/midcycle/start/${communityId}`, {});
  }

  // Finalize a cycle
  finalizeCycle(communityId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/cycle/finalize/${communityId}`, {});
  }

  // Update community settings
  updateSettings(communityId: string, settings: Partial<ICommunity['settings']>): Observable<ICommunity> {
    return this.http.put<ICommunity>(`${this.apiUrl}/update/${communityId}`, settings);
  }

  // Delete a community
  deleteCommunity(communityId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete/${communityId}`);
  }

  // Distribute payouts
  distributePayouts(communityId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/payouts/distribute/${communityId}`, {});
  }

  // Record contributions
  recordContribution(
    contributionData: {
      communityId: string;
      contributorId: string;
      contributions: { recipientId: string; amount: number }[];
    }
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/contribution/record`, contributionData);
  }

  // Skip payouts for defaulters
  skipPayoutForDefaulters(communityId: string, midCycleId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/payouts/skip/${communityId}/${midCycleId}`, {});
  }

  // Reactivate a member
  reactivateMember(communityId: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/member/reactivate/${communityId}/${userId}`, {});
  }

  // Calculate total owed by a user in a community
  calculateTotalOwed(communityId: string, userId: string): Observable<{ totalOwed: number }> {
    return this.http.get<{ totalOwed: number }>(`${this.apiUrl}/calculate/owed/${communityId}/${userId}`);
  }

  // Process back payments for a user
  processBackPayment(communityId: string, userId: string, paymentAmount: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/payment/back/${communityId}/${userId}`, { paymentAmount });
  }

  // Apply resolved votes
  applyResolvedVotes(communityId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/votes/apply/${communityId}`, {});
  }

  // Get mid-cycle contributions
  getMidCycleContributions(communityId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${communityId}/midcycle-contributions`);
  }

  // Get payout information
  getPayoutInfo(communityId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/payout/${communityId}`);
  }
}
