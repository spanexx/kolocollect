export interface Community {
  _id?: string;
  name: string;
  description: string;
  contributionFrequency: string;
  maxMembers: number;
  cycleLockEnabled: boolean;
  backupFund: number;
  availableBalance: number; // Tracks 90% contributions
  isPrivate: boolean;
  contributionLimit: number;
  adminId: string;
  membersList: Array<{ userId: string; name: string; email: string; contributionsPaid?: number }>;
  members: number;
  contributions: number;
  nextPayout: Date;
  userId?: string; // Optional field for API payload
  userName?: string; // Optional field for API payload
  userEmail?: string; // Optional field for API payload
}
