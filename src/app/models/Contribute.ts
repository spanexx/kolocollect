export interface Contribution {
    communityId: string;
    userId: string;
    amount: number;
    contributionDate: string;
    status?: 'Pending' | 'Completed';
    paymentMethod: string;
    transactionId?: string;  // Optional until it's available after successful contribution
  }
  