import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Community } from '../models/Community';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/users`;
  private currentUserSubject: BehaviorSubject<any>;
  public currentUser: Observable<any>;

  constructor(private http: HttpClient) {
    const storedUser = JSON.parse(localStorage.getItem('currentUser')!);
    this.currentUserSubject = new BehaviorSubject<any>(storedUser);
    this.currentUser = this.currentUserSubject.asObservable();
  }

  register(name: string, email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, { name, email, password });
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { email, password }).pipe(
      map(user => {
        if (user && user.token) {
          localStorage.setItem('currentUser', JSON.stringify(user));
          localStorage.setItem('userId', user.user.id);
          localStorage.setItem('userName', user.user.name);
          localStorage.setItem('userEmail', user.user.email);

          // Add wallet information to storage
          localStorage.setItem('walletBalance', user.wallet.availableBalance);
          localStorage.setItem('walletFixed', user.wallet.fixedBalance);
          localStorage.setItem('walletTotal', user.wallet.totalBalance);

          this.currentUserSubject.next(user);
        }
        return user;
      })
    );
  }

  logout(): void {
    localStorage.clear();
    this.currentUserSubject.next(null);
  }

  getUserId(): string | null {
    return this.currentUserSubject.value?.user?.id || null;
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  public get currentUserValue(): any {
    return this.currentUserSubject.value;
  }

  getUserCommunities(userId: string): Observable<Community[]> {
    return this.http.get<Community[]>(`${this.apiUrl}/${userId}/communities`);
  }
}
