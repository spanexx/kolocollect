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

  // Register a user
  register(user: { name: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  // Login a user
  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    const redirectUrl = localStorage.getItem('redirectUrl');
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        if (response.token && response.user._id) {
          localStorage.setItem('token', response.token);
          localStorage.setItem('userId', response.user._id);
          localStorage.setItem('userName', response.user.name);
          localStorage.setItem('userEmail', response.user.email);
          // localStorage.setItem('userCommunities', response.user.);

  
          // Redirect user after login
          if (redirectUrl) {
            localStorage.removeItem('redirectUrl');
            this.router.navigate([redirectUrl]);  
          } else {
            this.router.navigate(['/dashboard']);
          }
        } else {
          console.error('Login response does not contain required user information');
        }
      })
    );
  }
  

  // Logout a user
  logout(): void {
    localStorage.removeItem('token');  // Remove JWT token
    localStorage.removeItem('userId'); // Remove userId
    localStorage.removeItem('userName'); // Remove userName
    localStorage.removeItem('userEmail'); // Remove userEmail
    this.router.navigate(['/login']);  // Redirect to login
  }

  // Check if the user is authenticated
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');  // Returns true if token exists
  }

  // Get user profile using userId from storage
  getProfile(): Observable<any> {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.error('User ID not found in storage');
      throw new Error('User ID not found in storage');
    }
    return this.http.get(`${this.apiUrl}/profile/${userId}`);
  }

  // Get communities associated with the user
  getUserCommunities(): Observable<any> {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.error('User ID not found in storage');
      throw new Error('User ID not found in storage');
    }
    return this.http.get(`${this.apiUrl}/${userId}/communities`);
  }
  

  // Get user details from local storage
  getUserDetails(): { userId: string | null; userName: string | null; userEmail: string | null, userCommunities: string | null} {
    return {
      userId: localStorage.getItem('userId'),
      userName: localStorage.getItem('userName'),
      userEmail: localStorage.getItem('userEmail'),
      userCommunities: localStorage.getItem('userCommunities')
    };
  }
}