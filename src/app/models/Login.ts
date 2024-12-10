export interface LoginResponse {
  token: string;
  user: {
    _id: string; // Use _id instead of id to match the actual property
    name: string;
    email: string;
  };
  wallet: { // Add the wallet property to match the backend response
    availableBalance: number;
    fixedBalance: number;
    totalBalance: number;
  };
}
