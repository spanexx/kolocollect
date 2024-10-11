import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { LoginResponse } from './../models/Login';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:5000/api/users';  

  constructor(private http: HttpClient, private router: Router) {}

  // Register a user
  register(user: { name: string; email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, user);
  }

  // Login a user
  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    const redirectUrl = localStorage.getItem('redirectUrl');
    console.log("Saved:", redirectUrl);
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        localStorage.setItem('token', response.token);
  
        const redirectUrl = localStorage.getItem('redirectUrl');
        if (redirectUrl) {
          localStorage.removeItem('redirectUrl');
          this.router.navigate([redirectUrl]);  
        } else {
          this.router.navigate(['/dashboard']);
        }
      })
    );
  }
  
  // Logout a user
  logout(): void {
    localStorage.removeItem('token');  // Remove JWT token from storage
  }

  // Check if the user is authenticated
  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');  // Returns true if token exists
  }

  // Get user profile (you may use this in other areas)
  getProfile(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/profile/${userId}`);
  }
}
