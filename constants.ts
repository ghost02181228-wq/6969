
import { Category, BankAccount } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat1', name: '薪資', type: '收入' },
  { id: 'cat2', name: '投資回報', type: '收入' },
  { id: 'cat3', name: '飲食', type: '支出' },
  { id: 'cat4', name: '交通', type: '支出' },
  { id: 'cat5', name: '娛樂', type: '支出' },
  { id: 'cat6', name: '房租', type: '支出' },
  { id: 'cat7', name: '購物', type: '支出' },
  { id: 'cat8', name: '醫療', type: '支出' },
];

export const DEFAULT_ACCOUNTS: BankAccount[] = [
  { id: 'acc1', name: '國泰世華', balance: 50000, color: '#00A859' },
  { id: 'acc2', name: '台新 Richart', balance: 25000, color: '#E60012' },
];

export const ACCOUNT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6'
];
