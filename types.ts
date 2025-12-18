
export type CategoryType = '收入' | '支出';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  balance: number;
  color: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: CategoryType;
  date: string;
  note: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface AppState {
  accounts: BankAccount[];
  categories: Category[];
  transactions: Transaction[];
  isDemo: boolean;
}
