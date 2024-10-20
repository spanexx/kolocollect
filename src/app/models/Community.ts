export interface Community {
  _id?: string;
  name: string;
  description: string;
  members: number;  // Default: 0
  contributions: number;  // Default: 0
  nextPayout: Date;
  membersList: Array<{ userId: string, name: string, email: string }>; // Store user object details
}
