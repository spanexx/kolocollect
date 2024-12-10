export interface User {
  id?: string;                     // MongoDB ObjectId as string
  name: string;                     // User's name
  email: string;                    // User's email, must be unique
  password?: string;                // Password is optional when updating the user, don't expose it on response
  role: 'user' | 'admin';           // User role, either 'user' or 'admin'
  dateJoined: Date;                 // Date the user joined, default is current date
  communities: string[];            // Array of community ObjectIds as strings
  totalSavings?: number;            // Total savings of the user
  upcomingPayout?: Date;            // Date of the next scheduled payout
  recentActivities?: string[];      // Array of recent activity descriptions
  savingsGoals?: {                  // Array of savings goals with progress tracking
    name: string;
    progress: number;
  }[];
  walletBalance: number;            // User's wallet balance
  walletTransactions: {             // Array to track wallet deposits and withdrawals
    amount: number;
    date: Date;
    type: 'deposit' | 'withdrawal'; // Type of transaction
  }[];
}
