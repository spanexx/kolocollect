import { HttpInterceptor, HttpRequest, HttpHandler } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    console.log('AuthInterceptor: Intercepting HTTP request:', req.url);

    // Retrieve the token from AuthService
    const token = this.authService.getToken(); // Use a dedicated method to get the token
    console.log('AuthInterceptor: Retrieved token:', token);

    if (token) {
      console.log('AuthInterceptor: Cloning request with Authorization header...');
      const clonedReq = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });

      console.log('AuthInterceptor: Passing cloned request to next handler:', clonedReq);
      return next.handle(clonedReq);
    }

    console.log('AuthInterceptor: No token found. Passing original request to next handler.');
    return next.handle(req);
  }
}
