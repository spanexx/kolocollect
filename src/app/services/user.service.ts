import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { IUser } from '@models/User';
import { ICommunity } from '@models/Community';
import { Wallet } from '@models/Wallet';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  // Fetch user profile
  getUserProfile(userId: string): Observable<{
    user: IUser;
    wallet: Wallet;
  }> {
    return this.http.get<{
      user: IUser;
      wallet: Wallet;
    }>(`${this.apiUrl}/profile/${userId}`);
  }

// Fetch communities associated with a user
getUserCommunities(userId: string): Observable<ICommunity[]> {
  return this.http.get<ICommunity[]>(`${this.apiUrl}/${userId}/communities`);
}


  // Update user profile
  updateUserProfile(userId: string, updates: Partial<IUser>): Observable<IUser> {
    return this.http.put<IUser>(`${this.apiUrl}/profile/${userId}`, updates);
  }

  // Manage communities
  addCommunityToUser(userId: string, communityId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/community`, { communityId });
  }

  removeCommunityFromUser(userId: string, communityId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${userId}/community/${communityId}`);
  }

  // Notifications
  getUserNotifications(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${userId}/notifications`);
  }

  markNotificationsAsRead(userId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${userId}/notifications/read`, {});
  }

  // Contributions
  getUserContributions(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${userId}/contributions`);
  }

  updateUserContributions(
    contributionData: {
      userId: string;
      communityId: string;
      amount: number;
      cycleId?: string;
      midCycleId?: string;
      penalty?: number;
      missed?: boolean;
    }
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/contributions/update`, contributionData);
  }

  // Payouts
  getUserPayouts(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/user/payouts/${userId}`);
  }

  checkNextInLineStatus(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/user/nextinline/${userId}`);
  }

  // Activity Logs
  logUserActivity(userId: string, activityDetails: { action: string; details?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/${userId}/activity`, activityDetails);
  }

  // Delete user
  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${userId}`);
  }
}
