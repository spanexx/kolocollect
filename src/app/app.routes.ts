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
import { CommunitySettingsComponent } from './components/community-settings/community-settings.component';
import { ContributeFormComponent } from './components/contribute-form/contribute-form.component';
import { AddFundsComponent } from './components/wallet/add-funds/add-funds.component';
import { WithdrawFundComponent } from './components/wallet/withdraw-fund/withdraw-fund.component';
import { WalletComponent } from './components/wallet/wallet.component';
import { ContactComponent } from './components/contact/contact.component';

export const routes: Routes = [
  { path: '', component: HomepageComponent },
  { path: 'about', component: AboutComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'join-community', component: JoinCommunityComponent, canActivate: [authGuard] },
  { path: 'contribute', component: ContributeComponent, canActivate: [authGuard] }, // Protected route
  { path: 'receive-payout', component: ReceivePayoutComponent, canActivate: [authGuard] },  // Protected route
  { path: 'sign-in', component: SignInComponent },
  { path: 'sign-up', component: SignUpComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },  
  { path: 'latest', component: LatestComponent, canActivate: [authGuard] }, 
  { path: 'create-community', component: CreateCommunityComponent, canActivate: [authGuard] }, 
  { path: 'community-list', component: CommunityListComponent },
  { path: 'community/:id', component: CommunityDetailComponent, canActivate: [authGuard] },  
  { path: 'community/:id/settings', component: CommunitySettingsComponent, canActivate: [authGuard] },
  { path: 'community/:id/contribute', component: ContributeFormComponent },
  { path: 'wallet', component: WalletComponent },
  { path: 'add-funds', component: AddFundsComponent },
  { path: 'withdraw-fund', component: WithdrawFundComponent },


];
