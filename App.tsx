
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, 
  Plus, 
  PieChart, 
  LogOut, 
  Settings, 
  TrendingUp, 
  TrendingDown,
  Trash2,
  Edit2,
  BrainCircuit,
  Loader2,
  Menu,
  X
} from 'lucide-react';
import { 
  auth, 
  db, 
  isConfigured 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { 
  DEFAULT_CATEGORIES, 
  DEFAULT_ACCOUNTS, 
  ACCOUNT_COLORS 
} from './constants';
import { 
  AppState, 
  BankAccount, 
  Transaction, 
  Category,
  CategoryType 
} from './types';
import { analyzeFinances } from './geminiService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPieChart,
  Pie
} from 'recharts';

// --- UI Components ---

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'danger' | 'outline' | 'ghost' }> = ({ children, variant = 'primary', className, ...props }) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-500 hover:bg-slate-100'
  };
  return (
    <button className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Card: React.FC<{ children: React.ReactNode; title?: string; className?: string }> = ({ children, title, className }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    {title && <div className="px-6 py-4 border-bottom border-slate-100 font-bold text-lg">{title}</div>}
    <div className="p-6">{children}</div>
  </div>
);

// --- Main App ---

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [state, setState] = useState<AppState>({
    accounts: [],
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    isDemo: !isConfigured
  });

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'transactions' | 'ai'>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- Auth Handlers ---

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setAuthError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => auth && signOut(auth);

  // --- Data Synchronization ---

  useEffect(() => {
    if (!user || !db) {
      // In Demo Mode
      setState(prev => ({
        ...prev,
        accounts: DEFAULT_ACCOUNTS,
        transactions: [],
        isDemo: true
      }));
      return;
    }

    const accountsRef = collection(db, `users/${user.uid}/accounts`);
    const transRef = collection(db, `users/${user.uid}/transactions`);

    const unsubAccounts = onSnapshot(accountsRef, (snapshot) => {
      const accs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BankAccount[];
      setState(prev => ({ ...prev, accounts: accs.length > 0 ? accs : DEFAULT_ACCOUNTS }));
    });

    const unsubTrans = onSnapshot(transRef, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[];
      setState(prev => ({ ...prev, transactions: txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) }));
    });

    return () => {
      unsubAccounts();
      unsubTrans();
    };
  }, [user]);

  // --- Transaction Handlers ---

  const addTransaction = async (tx: Omit<Transaction, 'id'>) => {
    if (state.isDemo) {
      const newTx = { ...tx, id: Math.random().toString() };
      setState(prev => ({ 
        ...prev, 
        transactions: [newTx, ...prev.transactions],
        accounts: prev.accounts.map(acc => 
          acc.id === tx.accountId 
          ? { ...acc, balance: acc.balance + (tx.type === '收入' ? tx.amount : -tx.amount) }
          : acc
        )
      }));
      return;
    }
    if (!user || !db) return;
    await addDoc(collection(db, `users/${user.uid}/transactions`), tx);
    const accRef = doc(db, `users/${user.uid}/accounts`, tx.accountId);
    const targetAccount = state.accounts.find(a => a.id === tx.accountId);
    if (targetAccount) {
      await updateDoc(accRef, {
        balance: targetAccount.balance + (tx.type === '收入' ? tx.amount : -tx.amount)
      });
    }
  };

  const deleteTransaction = async (tx: Transaction) => {
    if (state.isDemo) {
      setState(prev => ({
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== tx.id),
        accounts: prev.accounts.map(acc => 
          acc.id === tx.accountId 
          ? { ...acc, balance: acc.balance + (tx.type === '收入' ? -tx.amount : tx.amount) }
          : acc
        )
      }));
      return;
    }
    if (!user || !db) return;
    await deleteDoc(doc(db, `users/${user.uid}/transactions`, tx.id));
    const accRef = doc(db, `users/${user.uid}/accounts`, tx.accountId);
    const targetAccount = state.accounts.find(a => a.id === tx.accountId);
    if (targetAccount) {
      await updateDoc(accRef, {
        balance: targetAccount.balance + (tx.type === '收入' ? -tx.amount : tx.amount)
      });
    }
  };

  // --- Account Handlers ---

  const addAccount = async (name: string, balance: number) => {
    const newAcc = { name, balance, color: ACCOUNT_COLORS[state.accounts.length % ACCOUNT_COLORS.length] };
    if (state.isDemo) {
      setState(prev => ({ ...prev, accounts: [...prev.accounts, { ...newAcc, id: Math.random().toString() }] }));
      return;
    }
    if (!user || !db) return;
    await addDoc(collection(db, `users/${user.uid}/accounts`), newAcc);
  };

  // --- AI Analysis ---

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzeFinances(state);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  // --- Renderers ---

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-12 h-12" /></div>;
  }

  if (!user && !state.isDemo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 bg-blue-600 rounded-2xl mb-4"><Wallet className="text-white w-8 h-8" /></div>
            <h1 className="text-2xl font-bold">金流大師</h1>
            <p className="text-slate-500">歡迎進入您的智慧理財中心</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">電子郵件</label>
              <input 
                type="email" required
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密碼</label>
              <input 
                type="password" required
                className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            <Button type="submit" className="w-full">{isRegistering ? '註冊帳號' : '登入'}</Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <button onClick={() => setIsRegistering(!isRegistering)} className="text-blue-600 hover:underline">
              {isRegistering ? '已經有帳號？點此登入' : '還沒有帳號？點此註冊'}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar - Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transition-transform md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-10">
            <div className="p-2 bg-blue-600 rounded-lg"><Wallet className="text-white w-5 h-5" /></div>
            <span className="font-bold text-xl">金流大師</span>
          </div>

          <nav className="flex-1 space-y-1">
            <button 
              onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'overview' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <PieChart size={20} /> 總覽
            </button>
            <button 
              onClick={() => { setActiveTab('accounts'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'accounts' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Wallet size={20} /> 銀行帳戶
            </button>
            <button 
              onClick={() => { setActiveTab('transactions'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'transactions' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <TrendingUp size={20} /> 收支紀錄
            </button>
            <button 
              onClick={() => { setActiveTab('ai'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'ai' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <BrainCircuit size={20} /> AI 智慧建議
            </button>
          </nav>

          <div className="pt-6 border-t border-slate-100">
            <div className="mb-4">
              <p className="text-xs text-slate-400 font-bold px-4 mb-2 uppercase tracking-widest">目前帳戶</p>
              <div className="px-4 py-2 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">{user?.email?.[0].toUpperCase() || 'D'}</div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium truncate">{user?.email || '展示模式'}</p>
                </div>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
              <LogOut size={20} /> 登出
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
             <div className="p-1.5 bg-blue-600 rounded-lg"><Wallet className="text-white w-4 h-4" /></div>
             <span className="font-bold">金流大師</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white rounded-lg shadow-sm border border-slate-200"><Menu size={20} /></button>
        </div>

        {/* Dynamic Views */}
        {activeTab === 'overview' && <OverviewView state={state} onAddTransaction={addTransaction} />}
        {activeTab === 'accounts' && <AccountsView state={state} onAddAccount={addAccount} />}
        {activeTab === 'transactions' && <TransactionsView state={state} onDeleteTransaction={deleteTransaction} />}
        {activeTab === 'ai' && <AIView analysis={aiAnalysis} isAnalyzing={isAnalyzing} onRunAnalysis={runAnalysis} />}
      </main>

      {/* Sidebar Overlay */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
    </div>
  );
};

// --- Sub-Views ---

const OverviewView: React.FC<{ state: AppState, onAddTransaction: (tx: any) => void }> = ({ state, onAddTransaction }) => {
  const [showAddTx, setShowAddTx] = useState(false);
  const [txForm, setTxForm] = useState({ accountId: '', categoryId: '', amount: 0, type: '支出' as CategoryType, note: '', date: new Date().toISOString().split('T')[0] });

  const totalBalance = useMemo(() => state.accounts.reduce((sum, a) => sum + a.balance, 0), [state.accounts]);
  
  const chartData = useMemo(() => {
    return state.accounts.map(acc => ({ name: acc.name, balance: acc.balance, color: acc.color }));
  }, [state.accounts]);

  const categorySpending = useMemo(() => {
    const data: Record<string, number> = {};
    state.transactions.filter(t => t.type === '支出').forEach(t => {
      const cat = state.categories.find(c => c.id === t.categoryId)?.name || '未分類';
      data[cat] = (data[cat] || 0) + t.amount;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [state.transactions, state.categories]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 bg-blue-600 border-none text-white">
          <p className="text-blue-100 text-sm font-medium">總資產淨額</p>
          <h2 className="text-3xl font-bold mt-1">NT$ {totalBalance.toLocaleString()}</h2>
          <div className="mt-6 flex gap-4">
             <div className="flex-1 bg-white/10 rounded-lg p-3">
               <div className="flex items-center gap-2 text-xs text-blue-100 mb-1"><TrendingUp size={14} /> 帳戶數量</div>
               <div className="font-bold">{state.accounts.length}</div>
             </div>
             <div className="flex-1 bg-white/10 rounded-lg p-3">
               <div className="flex items-center gap-2 text-xs text-blue-100 mb-1"><TrendingDown size={14} /> 本月支出</div>
               <div className="font-bold">{state.transactions.filter(t => t.type === '支出').reduce((s, t) => s + t.amount, 0).toLocaleString()}</div>
             </div>
          </div>
        </Card>

        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">帳戶分佈</h3>
            <PieChart size={20} className="text-slate-400" />
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="支出分類統計">
          <div className="h-64">
            {categorySpending.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={categorySpending}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categorySpending.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 italic">尚未有支出紀錄</div>
            )}
          </div>
        </Card>

        <Card title="快速記帳">
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            onAddTransaction(txForm);
            setTxForm({ ...txForm, amount: 0, note: '' });
          }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">帳戶</label>
                <select 
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  value={txForm.accountId} onChange={e => setTxForm({...txForm, accountId: e.target.value})}
                  required
                >
                  <option value="">選擇帳戶</option>
                  {state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">類型</label>
                <select 
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  value={txForm.type} onChange={e => setTxForm({...txForm, type: e.target.value as CategoryType})}
                >
                  <option value="支出">支出</option>
                  <option value="收入">收入</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">分類</label>
              <select 
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                value={txForm.categoryId} onChange={e => setTxForm({...txForm, categoryId: e.target.value})}
                required
              >
                <option value="">選擇分類</option>
                {state.categories.filter(c => c.type === txForm.type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">金額</label>
                <input 
                  type="number" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  value={txForm.amount || ''} onChange={e => setTxForm({...txForm, amount: Number(e.target.value)})}
                  placeholder="0" required
                />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">日期</label>
                 <input 
                  type="date" className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                  value={txForm.date} onChange={e => setTxForm({...txForm, date: e.target.value})}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">儲存交易紀錄</Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

const AccountsView: React.FC<{ state: AppState, onAddAccount: (name: string, balance: number) => void }> = ({ state, onAddAccount }) => {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState<number>(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">帳戶管理</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.accounts.map(acc => (
          <div key={acc.id} className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: acc.color }}></div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-slate-50 rounded-lg group-hover:scale-110 transition-transform"><Wallet size={20} className="text-slate-400" /></div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">銀行帳戶</p>
            </div>
            <h3 className="font-bold text-lg mb-1">{acc.name}</h3>
            <p className="text-2xl font-bold text-slate-900">NT$ {acc.balance.toLocaleString()}</p>
          </div>
        ))}
        
        <Card className="flex flex-col items-center justify-center border-dashed bg-slate-50/50">
          <p className="font-bold mb-4">新增帳戶</p>
          <div className="space-y-3 w-full">
            <input 
              placeholder="帳戶名稱 (如: 薪資戶)" 
              className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none"
              value={name} onChange={e => setName(e.target.value)}
            />
            <input 
              type="number" placeholder="初始餘額" 
              className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none"
              value={balance || ''} onChange={e => setBalance(Number(e.target.value))}
            />
            <Button onClick={() => { onAddAccount(name, balance); setName(''); setBalance(0); }} className="w-full" disabled={!name}>確認新增</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

const TransactionsView: React.FC<{ state: AppState, onDeleteTransaction: (tx: Transaction) => void }> = ({ state, onDeleteTransaction }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">歷史交易紀錄</h2>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-widest border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">日期</th>
                <th className="px-6 py-4">帳戶</th>
                <th className="px-6 py-4">分類</th>
                <th className="px-6 py-4">備註</th>
                <th className="px-6 py-4 text-right">金額</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.transactions.length > 0 ? state.transactions.map(tx => {
                const acc = state.accounts.find(a => a.id === tx.accountId);
                const cat = state.categories.find(c => c.id === tx.categoryId);
                return (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 text-sm text-slate-500">{tx.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: acc?.color }}></div>
                        <span className="text-sm font-medium">{acc?.name || '未知帳戶'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === '收入' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {cat?.name || tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 italic">{tx.note || '-'}</td>
                    <td className={`px-6 py-4 text-right font-bold ${tx.type === '收入' ? 'text-green-600' : 'text-slate-900'}`}>
                      {tx.type === '收入' ? '+' : '-'} {tx.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onDeleteTransaction(tx)}
                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">目前沒有任何交易紀錄</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const AIView: React.FC<{ analysis: string | null, isAnalyzing: boolean, onRunAnalysis: () => void }> = ({ analysis, isAnalyzing, onRunAnalysis }) => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-purple-100 rounded-3xl"><BrainCircuit className="text-purple-600 w-10 h-10" /></div>
        <h2 className="text-3xl font-bold">AI 智慧財務報告</h2>
        <p className="text-slate-500 max-w-md mx-auto">我們將使用 Gemini-3-Pro 先進模型分析您的收支行為，並提供專業的財務優化建議。</p>
        <Button 
          onClick={onRunAnalysis} 
          disabled={isAnalyzing}
          className="bg-purple-600 hover:bg-purple-700 px-8 py-3 rounded-xl text-lg shadow-lg shadow-purple-200"
        >
          {isAnalyzing ? (
            <div className="flex items-center gap-2"><Loader2 className="animate-spin" /> 分析中...</div>
          ) : '生成 AI 報告'}
        </Button>
      </div>

      {analysis && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 border-purple-200 bg-purple-50/30">
          <div className="prose prose-slate max-w-none">
            <div className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
              {analysis}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
        <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">1</div>
          <p className="text-sm font-bold">智慧分類</p>
          <p className="text-xs text-slate-400 mt-1">自動識別不尋常的支出高峰</p>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">2</div>
          <p className="text-sm font-bold">預算優化</p>
          <p className="text-xs text-slate-400 mt-1">根據歷史數據建議每月額度</p>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center">
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">3</div>
          <p className="text-sm font-bold">目標追蹤</p>
          <p className="text-xs text-slate-400 mt-1">計算您距離財務目標還有多遠</p>
        </div>
      </div>
    </div>
  );
};

export default App;
