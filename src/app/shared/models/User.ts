export interface IUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  dateJoined: Date;
  communities: string[];
  contributions: IContribution[];
  votes: IVote[];
  notifications: INotification[];
  activityLog: IActivity[];
  payouts: IPayout[];
  totalPenalties?: number;
  totalCommunities?: number;
  totalContributions?: number;
}

export interface IContribution {
  communityId: string;
  cycleId?: string;
  midCycleId?: string;
  totalContributed: number;
  positionInCycle?: number;
  contributionsPaid: IContributionPaid[];
  missedContributions: IMissedContribution[];
  penalty: number;
}

export interface IVote {
  communityId: string;
  topic: string;
  choice: string;
  date: Date;
}

export interface INotification {
  type: 'info' | 'warning' | 'alert' | 'penalty' | 'payout';
  message: string;
  date: Date;
  communityId?: string;
}

export interface IActivity {
  action: string;
  details?: string;
  date: Date;
}

export interface IPayout {
  communityId: string;
  amount: number;
  date: Date;
}

export interface IContributionPaid {
  amount: number;
  date: Date;
}

export interface IMissedContribution {
  cycleId: string;
  midCycleId?: string;
  amount: number;
}
