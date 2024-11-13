export interface Community {
  _id?: string;
  name: string;
  description: string;
  members: number;  // Default: 0
  maxMembers: number;  // Maximum number of members allowed in the community
  contributions: number;  // Default: 0
  nextPayout: Date;
  contributionFrequency: 'weekly' | 'bi-weekly' | 'monthly';  // Contribution frequency
  cycleLockEnabled: boolean;  // Whether cycle lock is enabled
  backupFund: number;  // Amount in the backup fund
  membersList: Array<{
    userId: string;
    name: string;
    email: string;
    contributionsPaid: number;  // Contributions paid by the member so far
  }>;
}
