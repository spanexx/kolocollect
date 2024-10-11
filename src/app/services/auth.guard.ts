import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const token = localStorage.getItem('token');
  const router = inject(Router);

  if (token) {
    return true;
  } else {
    console.log("Redirecting to sign-in, saving URL:", state.url);  // Debugging log
    localStorage.setItem('redirectUrl', state.url);  // Save the requested URL
    router.navigate(['/sign-in']);  // Redirect to sign-in page
    return false;
  }
};
