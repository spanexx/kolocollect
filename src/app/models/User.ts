export interface User {
  _id?: string;             // MongoDB ObjectId as string
  name: string;             // User's name
  email: string;            // User's email, must be unique
  password?: string;        // Password is optional when updating the user, don't expose it on response
  role: 'user' | 'admin';   // User role, either 'user' or 'admin'
  dateJoined: Date;         // Date the user joined, default is current date
  communities: string[];    // Array of community ObjectIds as strings
}
