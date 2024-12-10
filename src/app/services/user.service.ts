import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { LoginResponse } from './../models/Login';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/api/users`;

  constructor(private http: HttpClient, private router: Router) {}

  register(user: { name: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

login(credentials: { email: string; password: string }): Observable<LoginResponse> {
  const redirectUrl = localStorage.getItem('redirectUrl');
  return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
    tap(response => {
      if (response.token && response.user._id) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('userId', response.user._id); // Use _id here
        localStorage.setItem('userName', response.user.name);
        localStorage.setItem('userEmail', response.user.email);

        // Store wallet details in localStorage
        localStorage.setItem('walletBalance', response.wallet.availableBalance.toString());
        localStorage.setItem('walletFixed', response.wallet.fixedBalance.toString());
        localStorage.setItem('walletTotal', response.wallet.totalBalance.toString());

        if (redirectUrl) {
          localStorage.removeItem('redirectUrl');
          this.router.navigate([redirectUrl]);
        } else {
          this.router.navigate(['/dashboard']);
        }
      }
    })
  );
}


  logout(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  getProfile(): Observable<any> {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      throw new Error('User ID not found in storage');
    }
    return this.http.get(`${this.apiUrl}/profile/${userId}`);
  }

  getUserCommunities(): Observable<any> {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      throw new Error('User ID not found in storage');
    }
    return this.http.get(`${this.apiUrl}/${userId}/communities`);
  }
}
