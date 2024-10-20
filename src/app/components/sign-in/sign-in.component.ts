import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [RouterModule, FormsModule, CommonModule, ReactiveFormsModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css'
})
export class SignInComponent {
  signInForm: FormGroup;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.signInForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit(signInForm: any): void {
    if (signInForm.valid) {
      this.authService.login(signInForm.value.email, signInForm.value.password).subscribe(
        (response) => {
          console.log('Login successful', response);

          // Check if there's a stored redirect URL
          const redirectUrl = localStorage.getItem('redirectUrl');
          if (redirectUrl) {
            localStorage.removeItem('redirectUrl');  // Clear it once used
            this.router.navigate([redirectUrl]);  // Navigate to saved URL
          } else {
            this.router.navigate(['/dashboard']);  // Default navigation
          }
        },
        (error) => {
          console.error('Login failed', error);
        }
      );
    }
  }
}