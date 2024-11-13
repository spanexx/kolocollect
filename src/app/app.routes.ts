import { Routes } from '@angular/router';
import { HomepageComponent } from './homepage/homepage.component';
import { ContributeComponent } from './pages/contribute/contribute.component';
import { ReceivePayoutComponent } from './pages/receive-payout/receive-payout.component';
import { SignInComponent } from './components/sign-in/sign-in.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LatestComponent } from './components/latest/latest.component';
import { CommunityListComponent } from './components/community-list/community-list.component';
import { CommunityDetailComponent } from './components/community-detail/community-detail.component';
import { SignUpComponent } from './components/sign-up/sign-up.component';
import { authGuard } from './services/auth.guard';  // Import the functional auth guard
import { JoinCommunityComponent } from './components/join-community/join-community.component';
import { AboutComponent } from './components/about/about.component';
import { CreateCommunityComponent } from './components/create-community/create-community.component';

export const routes: Routes = [
  { path: '', component: HomepageComponent },
  { path: 'about', component: AboutComponent },
  { path: 'join-community', component: JoinCommunityComponent, canActivate: [authGuard] },
  { path: 'contribute', component: ContributeComponent, canActivate: [authGuard] }, // Protected route
  { path: 'receive-payout', component: ReceivePayoutComponent, canActivate: [authGuard] },  // Protected route
  { path: 'sign-in', component: SignInComponent },
  { path: 'sign-up', component: SignUpComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },  // Protected route
  { path: 'latest', component: LatestComponent, canActivate: [authGuard] },  // Protected route
  { path: 'create-community', component: CreateCommunityComponent, canActivate: [authGuard] },  // Protected route
  { path: 'community-list', component: CommunityListComponent },
  { path: 'community/:id', component: CommunityDetailComponent, canActivate: [authGuard] },  // Protected route
];
