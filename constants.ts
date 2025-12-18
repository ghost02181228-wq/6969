
import { Category, BankAccount } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat1', name: '薪資', type: '收入', icon: 'Coins' },
  { id: 'cat2', name: '獎金', type: '收入', icon: 'Trophy' },
  { id: 'cat3', name: '投資', type: '收入', icon: 'TrendingUp' },
  { id: 'cat4', name: '餐飲', type: '支出', icon: 'Utensils' },
  { id: 'cat5', name: '交通', type: '支出', icon: 'Car' },
  { id: 'cat6', name: '購物', type: '支出', icon: 'ShoppingBag' },
  { id: 'cat7', name: '居住', type: '支出', icon: 'Home' },
  { id: 'cat8', name: '娛樂', type: '支出', icon: 'Gamepad2' },
  { id: 'cat9', name: '醫療', type: '支出', icon: 'Stethoscope' },
  { id: 'cat10', name: '教育', type: '支出', icon: 'BookOpen' },
  { id: 'cat11', name: '其他', type: '支出', icon: 'Layers' },
];

export const DEFAULT_ACCOUNTS: BankAccount[] = [
  { id: 'acc1', name: '現金', balance: 10000, color: '#10B981' },
  { id: 'acc2', name: '銀行帳戶', balance: 50000, color: '#3B82F6' },
];

export const ACCOUNT_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6'
];
