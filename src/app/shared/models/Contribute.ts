import { IPaymentPlan } from '@models/Community';

export interface IContribution {
  _id: string;
  communityId: string;
  userId: string;
  cycleNumber: number;
  midCycleId?: string;
  amount: number;
  status: 'pending' | 'completed' | 'missed';
  date: Date;
  penalty: number;
  missedReason?: string;
  paymentPlan: IPaymentPlan;
}
