export interface Transaction {
  amount: number; // Amount of the transaction
  type: 'deposit' | 'withdrawal' | 'fixed' | 'transfer'; // Extended types of transaction
  date: Date; // Date of transaction
  description: string; // Description of the transaction
  recipient?: string; // Optional recipient ID (for transfers)
}

export interface FixedFund {
  amount: number; // Fixed amount
  startDate: Date; // Start date of fixed funds
  endDate: Date; // Maturity date of the fixed fund
  isMatured: boolean; // Indicates whether the funds are matured
}

export interface Wallet {
  userId: string; // User's unique ID
  balance: number; // Current balance of the wallet
  transactions: Transaction[]; // Array of transactions
  fixedFunds: FixedFund[]; // Array of fixed fund records
}
