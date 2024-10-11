import { Routes } from '@angular/router';
import { HomepageComponent } from './homepage/homepage.component';
import { JoinCommunityComponent } from './pages/join-community/join-community.component';
import { ContributeComponent } from './pages/contribute/contribute.component';
import { ReceivePayoutComponent } from './pages/receive-payout/receive-payout.component';
import { SignInComponent } from './components/sign-in/sign-in.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LatestComponent } from './components/latest/latest.component';
import { CommunityListComponent } from './components/community-list/community-list.component';
import { CommunityDetailComponent } from './components/community-detail/community-detail.component';
import { SignUpComponent } from './components/sign-up/sign-up.component';

export const routes: Routes = [
  { path: '', component: HomepageComponent },
  { path: 'join-community', component: JoinCommunityComponent },
  { path: 'contribute', component: ContributeComponent },
  { path: 'receive-payout', component: ReceivePayoutComponent },
  {path: 'sign-in', component: SignInComponent},
  {path: 'sign-up', component: SignUpComponent},
  {path: 'dashboard', component: DashboardComponent},
  {path: 'latest', component: LatestComponent},
  {path: 'community-list', component: CommunityListComponent},
  {path: 'community/:id', component: CommunityDetailComponent},


];
