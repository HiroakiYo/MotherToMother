export interface AddCashDonationType {
  organizationId: number;
  date: Date;
  total: number;
}

export interface CashDonation {
  id: number;
  date: Date;
  total: number;
  Organization: {
    name: string;
  };
}
