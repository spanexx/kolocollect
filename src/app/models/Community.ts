export interface Community {
  _id?: string; // Optional for new objects yet to be saved
  name: string; // Community name
  description?: string; // Optional field for community description
  contributions: number; // Total contributions including backup fund
  availableBalance: number; // Tracks 90% of contributions for payouts
  nextPayout: Date; // Date of the next payout
  members: number; // Current number of members in the community
  maxMembers: number; // Maximum allowed members
  contributionFrequency: 'weekly' | 'bi-weekly' | 'monthly'; // Limited to enum values
  cycleLockEnabled: boolean; // Indicates if cycle withdrawals are locked
  backupFund: number; // Tracks 10% of contributions for backup
  isPrivate: boolean; // Indicates if the community is private
  contributionLimit: number; // Maximum allowed contribution per user
  adminId: string; // ID of the community administrator
  membersList: Array<{
    userId: string; // ID of the member
    name: string; // Member's name
    email: string; // Member's email
    contributionsPaid?: {
      total: number; // Total contributions by the user
      records?: Array<{
        amount: number; // Amount contributed in a specific record
        date: Date; // Date of the contribution
      }>;
    };
  }>;
  contributionsList?: Array<{
    userId: string; // ID of the user who made the contribution
    amount: number; // Amount contributed
    paymentMethod?: string; // Optional payment method used
    contributionDate: Date; // Date of the contribution
  }>;
  createdAt?: Date; // Auto-generated timestamp
  updatedAt?: Date; // Auto-generated timestamp

  // Optional fields for user-specific context
  userId?: string; // Optional field for API payload, for user-related actions
  userName?: string; // Optional for frontend display
  userEmail?: string; // Optional for frontend display
}
