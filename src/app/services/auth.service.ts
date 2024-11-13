import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/users`;
  private currentUserSubject: BehaviorSubject<any>;
  public currentUser: Observable<any>;

  constructor(private http: HttpClient) {
    // Initialize currentUser from localStorage
    const storedUser = JSON.parse(localStorage.getItem('currentUser')!);
    this.currentUserSubject = new BehaviorSubject<any>(storedUser);
    this.currentUser = this.currentUserSubject.asObservable();
  }

  // Register a new user
  register(name: string, email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, { name, email, password });
  }

  // Login user and store details in localStorage
  login(email: string, password: string): Observable<any> {
    console.log('Login request data:', { email, password }); // Log request data
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password }).pipe(
      map(user => {
        console.log('Login response:', user); // Log response data
        if (user && user.token) {
          // Save user object and token in localStorage
          localStorage.setItem('currentUser', JSON.stringify(user));
          localStorage.setItem('userId', user.user._id);
          localStorage.setItem('userName', user.user.name);
          localStorage.setItem('userEmail', user.user.email);
          
          this.currentUserSubject.next(user);
        }
        return user;
      })
    );
  }
  

  // Logout user and clear localStorage
  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    this.currentUserSubject.next(null);
  }

  // Get the current logged-in user's ID
  getUserId(): string | null {
    return localStorage.getItem('userId');
  }

  // Check if the user is logged in
  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  public get currentUserValue(): any {
    return this.currentUserSubject.value;
  }
}
