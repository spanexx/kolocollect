export interface LoginResponse {
  token: string;
  user: {               // Add the 'user' property here
    _id: string;
    name: string;
    email: string;
  };
}
