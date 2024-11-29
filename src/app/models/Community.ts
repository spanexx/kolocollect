export interface Community {
  _id?: string; // Optional for new objects yet to be saved
  name: string; // Community name
  description?: string; // Optional field for community description
  contributionFrequency: 'weekly' | 'bi-weekly' | 'monthly'; // Limited to enum values
  maxMembers: number; // Maximum allowed members
  cycleLockEnabled: boolean; // Indicates if cycle withdrawals are locked
  backupFund: number; // Tracks 10% of contributions for backup
  availableBalance: number; // Tracks 90% of contributions for payouts
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
  members: number; // Current number of members in the community
  contributions: number; // Total contributions including backup fund
  nextPayout: Date; // Date of the next payout
  createdAt?: Date; // Auto-generated timestamp (optional for API)
  updatedAt?: Date; // Auto-generated timestamp (optional for API)

  // Optional fields for user-specific context
  userId?: string; // Optional field for API payload, for user-related actions
  userName?: string; // Optional for frontend display
  userEmail?: string; // Optional for frontend display
}
