import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: './header.component.html',
styleUrls: ['./header.component.css'] 
})
export class HeaderComponent {
  isMenuOpen = false;

  constructor(private userService: UserService, private router: Router) {}

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  // Check if the user is logged in
  isLoggedIn(): boolean {
    return this.userService.isAuthenticated();
  }

  // Logout the user
  logout() {
    this.userService.logout();
    this.router.navigate(['/sign-in']);
    this.closeMenu();
  }
}