import { IMissedContribution } from "./User";

export interface ICommunity {
  _id?: string;
  name: string;
  description?: string; // Added for the description field
  admin: string;
  totalContribution: number;
  backupFund: number;
  lockPayout: boolean;
  midCycle: IMidCycle[];
  cycles: ICycle[];
  members: IMember[];
  contributions?: number; // Total contributions
  settings: ISettings;
  votes: IVote[];
  maxMembers?: number; // Added for max members
  nextPayout?: Date;
  payoutDetails?: IPayoutDetails;
  contributionFrequency: 'Daily' | 'Weekly' | 'Monthly'; // Added
  cycleLockEnabled: boolean; // Added
  isPrivate: boolean; // Added
  contributionLimit: number; // Added
}


export interface IMidCycle {
  cycleNumber: number;
  contributors: IContributor[];
  nextInLine: { userId: string };
  missedContributions: string[];
  isComplete: boolean;
  isReady: boolean;
  payoutAmount?: number;
  payoutDate?: Date;
}

export interface ICycle {
  cycleNumber: number;
  midCycles: string[];
  isComplete: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface IMember {
  userId: string;
  name?: string; // Added for better compatibility
  email?: string; // Added for better compatibility
  position?: number;
  contributionPaid: boolean;
  status: string;
  penalty: number;
  missedContributions: IMissedContribution[];
  paymentPlan: IPaymentPlan;
}


export interface ISettings {
  contributionFrequency: 'Daily' | 'Weekly' | 'Monthly';
  maxMembers: number;
  backupFundPercentage: number;
  isPrivate: boolean;
  minContribution: number;
  penalty: number;
  numMissContribution: number;
  firstCycleMin: number;
}

export interface IVote {
  topic: string;
  options: string[];
  votes: IVoteDetail[];
  numVotes: number;
  resolved: boolean;
  resolution?: string;
}

export interface IVoteDetail {
  userId: string;
  choice: string;
}

export interface IContributor {
  contributorId: string;
  contributions: IContributionDetail[];
}

export interface IContributionDetail {
  recipientId: string;
  amount: number;
}

export interface IPaymentPlan {
  type: 'Full' | 'Incremental' | 'Shortfall';
  remainingAmount: number;
  installments: number;
}

export interface IPayoutDetails {
  nextRecipient: string;
  cycleNumber: number;
  payoutAmount: number;
}
