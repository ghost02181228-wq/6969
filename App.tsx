
import React, { useState, useEffect, useMemo } from 'react';
import * as Icons from 'lucide-react';
import { 
  Wallet, PieChart, LogOut, TrendingUp, TrendingDown, 
  Trash2, BrainCircuit, Loader2, Menu, Plus, ShieldCheck, 
  PlayCircle, Info, Database, FlaskConical, Settings, 
  ChevronRight, Calendar, Target, User as UserIcon, X, Search, AlertCircle
} from 'lucide-react';
import { auth, db, isConfigured } from './firebase';
// Fix: Consolidated Firebase Auth imports to resolve member resolution errors
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, setDoc, getDoc
} from 'firebase/firestore';
import { 
  DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS, ACCOUNT_COLORS 
} from './constants';
import { 
  AppState, BankAccount, Transaction, CategoryType, UserProfile 
} from './types';
import { analyzeFinances } from './geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts';

// 動態圖標元件
const CategoryIcon = ({ name, size = 20, className = "" }: { name: string, size?: number, className?: string }) => {
  const IconComponent = (Icons as any)[name] || Icons.HelpCircle;
  return <IconComponent size={size} className={className} />;
};

// --- 通用 UI 元件 ---
const Button = ({ children, variant = 'primary', className = '', loading = false, ...props }: any) => {
  const variants: any = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95',
    secondary: 'bg-slate-800 text-white hover:bg-slate-900 active:scale-95',
    danger: 'bg-red-500 text-white hover:bg-red-600 active:scale-95',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-95',
    ghost: 'text-slate-500 hover:bg-slate-100 active:scale-95',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95'
  };
  return (
    <button 
      className={`px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${variants[variant]} ${className}`} 
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" size={18} /> : children}
    </button>
  );
};

const Card = ({ children, title, className = '', headerAction, subtitle }: any) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    {(title || headerAction) && (
      <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
        <div>
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {headerAction}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<'selection' | 'production' | 'test'>('selection');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [state, setState] = useState<AppState>({
    accounts: DEFAULT_ACCOUNTS,
    categories: DEFAULT_CATEGORIES,
    transactions: [],
    userProfile: null,
    isDemo: true
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'transactions' | 'ai' | 'profile'>('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  // 初始化狀態
  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      const saved = localStorage.getItem('finance_app_data');
      if (saved) {
        try { setState(JSON.parse(saved)); } catch(e) {}
      }
      return;
    }
    
    return onAuthStateChanged(auth!, (u) => {
      setUser(u);
      if (u) {
        setAppMode('production');
        loadUserProfile(u.uid);
      }
      setLoading(false);
    });
  }, []);

  const loadUserProfile = async (uid: string) => {
    if (!db) return;
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      setState(p => ({ ...p, userProfile: docSnap.data() as UserProfile }));
    } else {
      const newProfile: UserProfile = { uid, email: user?.email || '', displayName: '新使用者', monthlyBudget: 20000, budgets: [] };
      await setDoc(docRef, newProfile);
      setState(p => ({ ...p, userProfile: newProfile }));
    }
  };

  useEffect(() => {
    if (appMode !== 'production' || !user || !db) return;
    const unsubAccs = onSnapshot(collection(db, `users/${user.uid}/accounts`), (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() })) as BankAccount[];
      setState(p => ({ ...p, accounts: data.length > 0 ? data : DEFAULT_ACCOUNTS }));
    });
    const unsubTxs = onSnapshot(collection(db, `users/${user.uid}/transactions`), (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[];
      setState(p => ({ ...p, transactions: data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) }));
    });
    return () => { unsubAccs(); unsubTxs(); };
  }, [appMode, user]);

  useEffect(() => {
    if (appMode === 'test') {
      localStorage.setItem('finance_app_data', JSON.stringify(state));
    }
  }, [state, appMode]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setAuthError('');
    setLoading(true);
    try {
      if (isRegistering) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) { 
      setAuthError(err.message.includes('auth/user-not-found') ? "找不到使用者" : "驗證失敗，請檢查資料"); 
    } finally {
      setLoading(false);
    }
  };

  const addTransaction = async (tx: Omit<Transaction, 'id'>) => {
    if (appMode === 'test' || !user || !db) {
      const newTx = { ...tx, id: Date.now().toString() };
      setState(p => ({ 
        ...p, 
        transactions: [newTx, ...p.transactions],
        accounts: p.accounts.map(a => a.id === tx.accountId ? { ...a, balance: a.balance + (tx.type === '收入' ? tx.amount : -tx.amount) } : a)
      }));
      return;
    }
    await addDoc(collection(db, `users/${user.uid}/transactions`), tx);
    const acc = state.accounts.find(a => a.id === tx.accountId);
    if (acc) {
      const accRef = doc(db, `users/${user.uid}/accounts`, tx.accountId);
      await updateDoc(accRef, { balance: acc.balance + (tx.type === '收入' ? tx.amount : -tx.amount) });
    }
  };

  const deleteTransaction = async (txId: string) => {
    if (!confirm("確定要刪除此筆交易嗎？")) return;
    const txToDelete = state.transactions.find(t => t.id === txId);
    if (!txToDelete) return;

    if (appMode === 'test' || !user || !db) {
      setState(p => ({
        ...p,
        transactions: p.transactions.filter(t => t.id !== txId),
        accounts: p.accounts.map(a => 
          a.id === txToDelete.accountId 
            ? { ...a, balance: a.balance - (txToDelete.type === '收入' ? txToDelete.amount : -txToDelete.amount) } 
            : a
        )
      }));
      return;
    }

    try {
      await deleteDoc(doc(db, `users/${user.uid}/transactions`, txId));
      const acc = state.accounts.find(a => a.id === txToDelete.accountId);
      if (acc) {
        const accRef = doc(db, `users/${user.uid}/accounts`, txToDelete.accountId);
        await updateDoc(accRef, { 
          balance: acc.balance - (txToDelete.type === '收入' ? txToDelete.amount : -txToDelete.amount) 
        });
      }
    } catch (e) {
      console.error("刪除失敗", e);
    }
  };

  const addAccount = async (name: string, balance: number) => {
    const newAccData = { name, balance, color: ACCOUNT_COLORS[state.accounts.length % ACCOUNT_COLORS.length] };
    if (appMode === 'test' || !user || !db) {
      setState(p => ({ ...p, accounts: [...p.accounts, { ...newAccData, id: Date.now().toString() }] }));
      return;
    }
    await addDoc(collection(db, `users/${user.uid}/accounts`), newAccData);
  };

  const handleRunAI = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeFinances(state);
      setAiResult(result);
    } catch (error) {
      setAiResult("分析失敗，請檢查 API Key 設定。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLogout = () => {
    if (auth) signOut(auth);
    setAppMode('selection');
    setUser(null);
    setState({ accounts: DEFAULT_ACCOUNTS, categories: DEFAULT_CATEGORIES, transactions: [], userProfile: null, isDemo: true });
  };

  const handleClearAllData = () => {
    if (!confirm("⚠️ 警告：這將會清除所有交易與帳戶設定，確定嗎？")) return;
    if (appMode === 'test') {
      localStorage.removeItem('finance_app_data');
      setState({ accounts: DEFAULT_ACCOUNTS, categories: DEFAULT_CATEGORIES, transactions: [], userProfile: null, isDemo: true });
      alert("資料已重設");
    } else {
      alert("雲端模式暫不支援一鍵清除，請手動刪除單筆資料。");
    }
  };

  const handleExportCSV = () => {
    if (state.transactions.length === 0) {
      alert("尚無交易資料可匯出");
      return;
    }
    const headers = ['日期', '類型', '分類', '帳戶', '金額', '備註'];
    const rows = state.transactions.map(tx => [
      tx.date,
      tx.type,
      state.categories.find(c => c.id === tx.categoryId)?.name || '未分類',
      state.accounts.find(a => a.id === tx.accountId)?.name || '未知',
      tx.amount,
      tx.note.replace(/,/g, ' ')
    ]);
    const csvContent = "\ufeff" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `金流大師_報表_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateMonthlyBudget = async (amount: number) => {
    if (appMode === 'production' && user && db) {
      await updateDoc(doc(db, "users", user.uid), { monthlyBudget: amount });
    }
    setState(p => ({ ...p, userProfile: p.userProfile ? { ...p.userProfile, monthlyBudget: amount } : null }));
    alert("預算已更新");
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  if (appMode === 'selection' || (appMode === 'production' && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-blue-50">
        <div className="w-full max-w-md">
          <Card className="shadow-2xl border-none">
            <div className="text-center mb-8 pt-4">
              <div className="inline-block p-4 bg-blue-600 rounded-3xl mb-4 shadow-lg shadow-blue-200">
                <Wallet className="text-white" size={32} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">金流大師 <span className="text-blue-600">AI</span></h1>
              <p className="text-slate-500 mt-2 font-medium">智慧理財，從現在開始</p>
            </div>

            {appMode === 'selection' ? (
              <div className="space-y-4">
                <button onClick={() => isConfigured ? setAppMode('production') : alert('⚠️ Firebase 未設定。請在 firebase.ts 中填寫您的設定以啟用雲端模式。')} className="w-full flex items-center justify-between p-5 bg-white border-2 border-slate-100 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all group">
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors"><Database /></div>
                    <div>
                      <p className="font-bold text-slate-800">雲端模式 (Firebase)</p>
                      <p className="text-xs text-slate-400">登入帳號，多端同步您的資產資料</p>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
                </button>
                
                <button onClick={() => setAppMode('test')} className="w-full flex items-center justify-between p-5 bg-white border-2 border-slate-100 rounded-2xl hover:border-amber-500 hover:bg-amber-50 transition-all group">
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors"><FlaskConical /></div>
                    <div>
                      <p className="font-bold text-slate-800">本機模式 (LocalStorage)</p>
                      <p className="text-xs text-slate-400">免登入，資料僅保存在此瀏覽器中</p>
                    </div>
                  </div>
                  <ChevronRight className="text-slate-300 group-hover:text-amber-500 transform group-hover:translate-x-1 transition-all" />
                </button>
                <div className="mt-8 flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-slate-500 text-xs leading-relaxed">
                  <Info size={14} className="shrink-0" />
                  <p>本系統整合 Google Gemini 3 Pro AI 引擎，能根據您的消費行為提供專業的理財建議與預測。</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAuth} className="space-y-5">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-black text-slate-800">{isRegistering ? '建立新帳號' : '歡迎回來'}</h2>
                  <button type="button" onClick={() => setAppMode('selection')} className="text-sm font-bold text-blue-600 hover:text-blue-700">返回</button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 ml-1">電子郵件</label>
                  <input type="email" placeholder="example@mail.com" className="w-full p-4 bg-slate-50 border-transparent border-2 focus:border-blue-500 focus:bg-white rounded-xl transition-all outline-none" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 ml-1">安全密碼</label>
                  <input type="password" placeholder="••••••••" className="w-full p-4 bg-slate-50 border-transparent border-2 focus:border-blue-500 focus:bg-white rounded-xl transition-all outline-none" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                {authError && <div className="p-3 bg-red-50 text-red-500 text-xs rounded-lg font-bold flex items-center gap-2"><AlertCircle size={14}/>{authError}</div>}
                <Button type="submit" className="w-full py-4 text-lg shadow-blue-200" loading={loading}>{isRegistering ? '立即註冊' : '登入系統'}</Button>
                <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-slate-500 text-sm font-medium hover:text-blue-600 transition-colors">
                  {isRegistering ? '已經有帳號？點此登入' : '還沒有帳號嗎？點此快速註冊'}
                </button>
              </form>
            )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col p-6 space-y-2 border-r border-slate-800">
        <div className="flex items-center gap-3 font-black text-2xl text-blue-400 mb-10 px-2">
          <div className="p-2 bg-blue-600/20 rounded-lg"><Wallet size={24}/></div>
          金流大師
        </div>
        
        <NavButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<PieChart size={20}/>} label="儀表板" />
        <NavButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={<Wallet size={20}/>} label="資產帳戶" />
        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<Calendar size={20}/>} label="收支明細" />
        <NavButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} icon={<BrainCircuit size={20}/>} label="AI 理財建議" />
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<UserIcon size={20}/>} label="個人設定" />
        
        <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
          <div className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${appMode === 'production' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'}`}>
             <div className={`w-1.5 h-1.5 rounded-full ${appMode === 'production' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
             {appMode === 'production' ? '雲端同步中' : '本機模式'}
          </div>
          
          <div className="group flex items-center gap-3 p-3 bg-slate-800/50 rounded-2xl hover:bg-slate-800 transition-all">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
              {state.userProfile?.displayName?.[0] || 'U'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate">{state.userProfile?.displayName || "訪客使用者"}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email || "Local User"}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition-colors"><LogOut size={16}/></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {/* Fix: Passed setActiveTab as onNavigate to OverviewView */}
          {activeTab === 'overview' && <OverviewView state={state} onAdd={addTransaction} onNavigate={setActiveTab} />}
          {activeTab === 'accounts' && <AccountsView state={state} onAdd={addAccount} />}
          {activeTab === 'transactions' && <TransactionsView state={state} onDelete={deleteTransaction} />}
          {activeTab === 'ai' && <AIView result={aiResult} loading={isAnalyzing} onRun={handleRunAI} />}
          {activeTab === 'profile' && (
            <ProfileView 
              userProfile={state.userProfile} 
              onUpdateBudget={updateMonthlyBudget}
              onClearData={handleClearAllData}
              onExport={handleExportCSV}
              onUpdateName={async (name) => {
                if(user && db) await updateDoc(doc(db, "users", user.uid), { displayName: name });
                setState(p => ({ ...p, userProfile: p.userProfile ? { ...p.userProfile, displayName: name } : null }));
                alert("姓名已更新");
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-3 p-4 rounded-2xl font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'}`}>
    {icon} <span>{label}</span>
  </button>
);

// Fix: Added onNavigate to component props to resolve scope issues with setActiveTab
const OverviewView = ({ state, onAdd, onNavigate }: any) => {
  const [form, setForm] = useState({ accountId: '', categoryId: '', amount: 0, type: '支出' as CategoryType, date: new Date().toISOString().split('T')[0], note: '' });
  const total = useMemo(() => state.accounts.reduce((s: number, a: any) => s + a.balance, 0), [state.accounts]);
  
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTransactions = state.transactions.filter((t: any) => t.date.startsWith(currentMonth));
  const monthIncome = monthTransactions.filter((t: any) => t.type === '收入').reduce((s: number, t: any) => s + t.amount, 0);
  const monthExpense = monthTransactions.filter((t: any) => t.type === '支出').reduce((s: number, t: any) => s + t.amount, 0);
  
  const budget = state.userProfile?.monthlyBudget || 0;
  const budgetPercent = budget > 0 ? Math.min((monthExpense / budget) * 100, 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800">我的財富總覽</h2>
          <p className="text-slate-500 font-medium">今天是 {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3">
             <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><TrendingUp size={18}/></div>
             <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase">本月收入</p>
               <p className="font-black text-slate-800">+{monthIncome.toLocaleString()}</p>
             </div>
          </div>
          <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-3">
             <div className="p-2 bg-rose-100 text-rose-600 rounded-xl"><TrendingDown size={18}/></div>
             <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase">本月支出</p>
               <p className="font-black text-slate-800">-{monthExpense.toLocaleString()}</p>
             </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-xl shadow-blue-200 relative overflow-hidden group">
          <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform">
             <Wallet size={160} />
          </div>
          <div className="relative z-10">
            <p className="text-blue-100 text-xs font-black uppercase tracking-widest">資產淨值 (Net Worth)</p>
            <h2 className="text-4xl font-black mt-2 leading-none">NT$ {total.toLocaleString()}</h2>
            <div className="mt-8 flex items-center gap-2 text-sm text-blue-100 font-medium">
               <ShieldCheck size={16} /> 資產安全加密中
            </div>
          </div>
        </Card>

        <Card title="預算追蹤" subtitle="本月預算達成率" className="md:col-span-1">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-2xl font-black text-slate-800">{budgetPercent.toFixed(1)}%</p>
                <p className="text-xs text-slate-500">已使用 {monthExpense.toLocaleString()} 元</p>
              </div>
              <p className="text-xs font-bold text-slate-400">總額 {budget.toLocaleString()}</p>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
               <div 
                 className={`h-full transition-all duration-1000 ease-out rounded-full ${budgetPercent > 90 ? 'bg-rose-500' : budgetPercent > 70 ? 'bg-amber-500' : 'bg-blue-500'}`} 
                 style={{ width: `${budgetPercent}%` }}
               />
            </div>
            <p className="text-[10px] text-slate-400 italic">
              {budgetPercent > 100 ? "⚠️ 您已超出預算，建議減少非必要支出。" : "✅ 預算控制良好，請繼續保持。"}
            </p>
          </div>
        </Card>

        <Card title="快速記帳" className="md:col-span-1">
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); onAdd(form); setForm({...form, amount: 0}); }}>
            <div className="grid grid-cols-2 gap-2">
              <select className="p-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={form.type} onChange={e => setForm({...form, type: e.target.value as CategoryType})}>
                <option value="支出">💸 支出</option>
                <option value="收入">💰 收入</option>
              </select>
              <input type="number" className="p-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="金額" value={form.amount || ''} onChange={e => setForm({...form, amount: Number(e.target.value)})} required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="p-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={form.accountId} onChange={e => setForm({...form, accountId: e.target.value})} required>
                <option value="">選擇帳戶</option>
                {state.accounts.map((a:any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select className="p-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} required>
                <option value="">選擇分類</option>
                {state.categories.filter((c:any) => c.type === form.type).map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Button type="submit" className="w-full">儲存交易</Button>
          </form>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="資產變化趨勢">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={state.transactions.slice().reverse().map(t => ({ date: t.date, amount: t.type === '收入' ? t.amount : -t.amount }))}>
                <defs>
                  <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" hide />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip />
                <Area type="monotone" dataKey="amount" stroke="#3B82F6" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Fix: Used onNavigate prop instead of setActiveTab directly */}
        <Card title="最近交易活動" headerAction={<button className="text-xs font-bold text-blue-600 hover:underline" onClick={() => onNavigate('transactions')}>查看全部</button>}>
          <div className="space-y-1">
            {state.transactions.slice(0, 6).map((tx: any) => {
              const cat = state.categories.find((c:any) => c.id === tx.categoryId);
              return (
                <div key={tx.id} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${tx.type === '收入' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                      <CategoryIcon name={cat?.icon || 'HelpCircle'} size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{cat?.name || '未分類'}</p>
                      <p className="text-[10px] text-slate-500 font-medium uppercase">{tx.date} · {state.accounts.find((a:any) => a.id === tx.accountId)?.name}</p>
                    </div>
                  </div>
                  <p className={`font-black text-sm ${tx.type === '收入' ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {tx.type === '收入' ? '+' : '-'} {tx.amount.toLocaleString()}
                  </p>
                </div>
              );
            })}
            {state.transactions.length === 0 && (
              <div className="text-center py-10">
                <div className="inline-block p-4 bg-slate-50 rounded-full mb-3 text-slate-300"><Plus size={32}/></div>
                <p className="text-slate-400 font-medium">還沒有任何交易明細</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

const AccountsView = ({ state, onAdd }: any) => {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState(0);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-800">資產帳戶管理</h2>
          <p className="text-slate-500 font-medium">管理您的銀行、信用卡與現金資產</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} variant={showAdd ? 'outline' : 'primary'}>
          {showAdd ? <X size={18}/> : <Plus size={18}/>} {showAdd ? '取消' : '新增帳戶'}
        </Button>
      </div>

      {showAdd && (
        <Card className="bg-slate-50 border-2 border-dashed border-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input className="p-3 rounded-xl border border-slate-200 font-bold" placeholder="帳戶名稱 (例如：國泰世華)" value={name} onChange={e => setName(e.target.value)} />
            <input type="number" className="p-3 rounded-xl border border-slate-200 font-bold" placeholder="目前的餘額" value={balance || ''} onChange={e => setBalance(Number(e.target.value))} />
            <Button onClick={() => { if(name){ onAdd(name, balance); setName(''); setBalance(0); setShowAdd(false); } }}>確認新增</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {state.accounts.map((acc: any) => (
          <Card key={acc.id} className="relative overflow-hidden group border-none shadow-md">
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: acc.color }} />
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{acc.id.startsWith('acc') ? '系統預設' : '自定義帳戶'}</p>
                <h3 className="text-xl font-black text-slate-800 mt-1">{acc.name}</h3>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-blue-600 transition-colors">
                 <Wallet size={20} />
              </div>
            </div>
            <div className="mt-8">
              <p className="text-xs font-bold text-slate-400">目前餘額</p>
              <p className="text-3xl font-black text-slate-900">NT$ {acc.balance.toLocaleString()}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
               <button className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase">交易記錄</button>
               <span className="text-slate-200">|</span>
               <button className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase">帳戶設定</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const TransactionsView = ({ state, onDelete }: any) => {
  const [filter, setFilter] = useState('');
  const filtered = state.transactions.filter((tx: any) => {
    const cat = state.categories.find((c:any) => c.id === tx.categoryId)?.name || '';
    return cat.includes(filter) || tx.note.includes(filter);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800">收支明細</h2>
          <p className="text-slate-500 font-medium">查看並搜尋所有的歷史交易資料</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-full md:w-64">
           <div className="p-2 text-slate-400"><Search size={18}/></div>
           <input 
             className="bg-transparent border-none outline-none text-sm font-medium w-full pr-4" 
             placeholder="搜尋分類或備註..." 
             value={filter} 
             onChange={e => setFilter(e.target.value)}
           />
        </div>
      </div>

      <Card className="p-0 border-none shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">日期</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">分類</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">帳戶</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">金額</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((tx: any) => {
                const cat = state.categories.find((c:any) => c.id === tx.categoryId);
                return (
                  <tr key={tx.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-500">{tx.date}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${tx.type === '收入' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          <CategoryIcon name={cat?.icon || 'HelpCircle'} size={14} />
                        </div>
                        <span className="font-bold text-slate-800">{cat?.name || '未分類'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-400 uppercase">{state.accounts.find((a:any) => a.id === tx.accountId)?.name}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className={`font-black ${tx.type === '收入' ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {tx.type === '收入' ? '+' : '-'} {tx.amount.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <button 
                         onClick={() => onDelete(tx.id)}
                         className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16}/>
                        </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                     <p className="text-slate-400 font-bold">找不到相符的交易資料</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const AIView = ({ result, loading, onRun }: any) => (
  <div className="max-w-4xl mx-auto py-10">
    <div className="text-center space-y-4 mb-12">
      <div className="inline-block p-6 bg-purple-100 text-purple-600 rounded-[2.5rem] mb-4 shadow-xl shadow-purple-100 animate-bounce-slow">
        <BrainCircuit size={48} />
      </div>
      <h2 className="text-4xl font-black text-slate-900">AI 財務管家</h2>
      <p className="text-slate-500 font-medium max-w-lg mx-auto">
        整合 Google Gemini 3 Pro，深度分析您的資產配置與消費習慣，提供量身打造的理財計畫。
      </p>
      <div className="pt-4">
        <Button onClick={onRun} loading={loading} className="bg-purple-600 hover:bg-purple-700 shadow-xl shadow-purple-200 mx-auto px-12 py-4 text-lg">
          開始智慧分析
        </Button>
      </div>
    </div>

    {result ? (
      <Card className="border-2 border-purple-100 bg-white shadow-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 text-purple-600"><BrainCircuit size={120}/></div>
        <div className="prose prose-purple max-w-none text-slate-700 leading-relaxed font-medium">
          {result.split('\n').map((l: string, i: number) => {
            if (l.startsWith('#')) return <h3 key={i} className="text-xl font-black text-purple-600 mt-6 mb-2">{l.replace(/#/g, '')}</h3>;
            if (l.startsWith('-')) return <li key={i} className="ml-4 mb-1 text-slate-600">{l.substring(1)}</li>;
            return <p key={i} className="mb-4">{l}</p>;
          })}
        </div>
      </Card>
    ) : !loading && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AICapabilityCard icon={<TrendingUp className="text-emerald-500"/>} title="支出趨勢預測" desc="精確計算您的收支走向，提早發現財務缺口。" />
        <AICapabilityCard icon={<Target className="text-blue-500"/>} title="預算優化建議" desc="分析非必要支出，給予最實質的省錢方案。" />
        <AICapabilityCard icon={<ShieldCheck className="text-purple-500"/>} title="資產健康檢查" desc="評估儲蓄率與投資配比，確保財富穩健增長。" />
      </div>
    )}
  </div>
);

const AICapabilityCard = ({ icon, title, desc }: any) => (
  <Card className="text-center p-8 bg-slate-50/50 hover:bg-white transition-all border-none">
     <div className="mb-4 flex justify-center">{icon}</div>
     <h4 className="font-black text-slate-800 mb-2">{title}</h4>
     <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
  </Card>
);

const ProfileView = ({ userProfile, onUpdateBudget, onUpdateName, onClearData, onExport }: any) => {
  const [name, setName] = useState(userProfile?.displayName || '');
  const [budget, setBudget] = useState(userProfile?.monthlyBudget || 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <h2 className="text-3xl font-black text-slate-800">個人設定</h2>
      
      <Card title="個人資料" subtitle="管理您的顯示名稱與帳號資訊">
        <div className="space-y-4">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-blue-100">
              {name[0] || 'U'}
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase">帳號 UID</p>
              <p className="text-[10px] font-mono text-slate-500 bg-slate-100 p-1 px-2 rounded mt-1 overflow-hidden truncate max-w-[200px]">{userProfile?.uid}</p>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400">顯示名稱</label>
            <div className="flex gap-2">
              <input className="flex-1 p-3 bg-slate-50 rounded-xl border-none font-bold" value={name} onChange={e => setName(e.target.value)} />
              <Button variant="secondary" onClick={() => onUpdateName(name)}>更新</Button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400">註冊信箱</label>
            <input className="w-full p-3 bg-slate-100 rounded-xl border-none font-bold text-slate-400" value={userProfile?.email || ''} disabled />
          </div>
        </div>
      </Card>

      <Card title="財務偏好" subtitle="設定您的每月預算與目標">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400">每月總支出預算</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">NT$</span>
                <input type="number" className="w-full pl-12 p-3 bg-slate-50 rounded-xl border-none font-black" value={budget} onChange={e => setBudget(Number(e.target.value))} />
              </div>
              <Button variant="success" onClick={() => onUpdateBudget(budget)}>儲存預算</Button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">💡 我們會根據此預算為您在儀表板中顯示進度條。</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-col md:flex-row gap-4">
        <Button variant="danger" className="flex-1 py-4" onClick={onClearData}>清除所有資料</Button>
        <Button variant="outline" className="flex-1 py-4" onClick={onExport}>匯出 CSV 報表</Button>
      </div>
    </div>
  );
};

export default App;
