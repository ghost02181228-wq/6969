
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, PieChart, LogOut, TrendingUp, TrendingDown, 
  Trash2, BrainCircuit, Loader2, Menu, Plus, ShieldCheck, PlayCircle, Info, Database, FlaskConical
} from 'lucide-react';
import { auth, db, isConfigured } from './firebase';
// Fix: Consolidate all Firebase Auth functional and type imports to resolve resolution ambiguity
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  type User
} from 'firebase/auth';
import { 
  collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc 
} from 'firebase/firestore';
import { 
  DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS, ACCOUNT_COLORS 
} from './constants';
import { 
  AppState, BankAccount, Transaction, CategoryType 
} from './types';
import { analyzeFinances } from './geminiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell
} from 'recharts';

// --- 通用 UI 元件 ---
const Button = ({ children, variant = 'primary', className = '', ...props }: any) => {
  const variants: any = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md',
    secondary: 'bg-slate-800 text-white hover:bg-slate-900',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-100',
    ghost: 'text-slate-500 hover:bg-slate-100'
  };
  return (
    <button className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Card = ({ children, title, className = '', headerAction }: any) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    {title && (
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-lg text-slate-800">{title}</h3>
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
    isDemo: true
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'transactions' | 'ai'>('overview');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setAppMode('production');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (appMode !== 'production' || !user || !db) return;
    const unsubAccs = onSnapshot(collection(db, `users/${user.uid}/accounts`), (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() })) as BankAccount[];
      setState(p => ({ ...p, accounts: data.length > 0 ? data : DEFAULT_ACCOUNTS, isDemo: false }));
    });
    const unsubTxs = onSnapshot(collection(db, `users/${user.uid}/transactions`), (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() })) as Transaction[];
      setState(p => ({ ...p, transactions: data.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) }));
    });
    return () => { unsubAccs(); unsubTxs(); };
  }, [appMode, user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setAuthError('');
    try {
      if (isRegistering) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) { setAuthError("登入失敗，請檢查信箱與密碼。"); }
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
      console.error("AI Analysis Error:", error);
      setAiResult("分析失敗，請檢查網路連線或稍後再試。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLogout = () => {
    if (auth) signOut(auth);
    setAppMode('selection');
    setUser(null);
    setState({ accounts: DEFAULT_ACCOUNTS, categories: DEFAULT_CATEGORIES, transactions: [], isDemo: true });
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  if (appMode === 'selection' || (appMode === 'production' && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
        <Card className="w-full max-w-lg shadow-2xl border-none">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-blue-600 rounded-2xl mb-4"><Wallet className="text-white" size={32} /></div>
            <h1 className="text-3xl font-bold text-slate-900">金流大師 <span className="text-blue-600">AI</span></h1>
            <p className="text-slate-500 mt-2">請選擇系統模式開始使用</p>
          </div>

          {appMode === 'selection' ? (
            <div className="space-y-4">
              <button onClick={() => isConfigured ? setAppMode('production') : alert('請先在 firebase.ts 中填寫您的設定！')} className="w-full flex items-center justify-between p-5 bg-white border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><Database /></div>
                  <div className="text-left">
                    <p className="font-bold text-slate-800">正式模式</p>
                    <p className="text-xs text-slate-500">雲端同步，永久保存資料</p>
                  </div>
                </div>
                <ShieldCheck className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              
              <button onClick={() => setAppMode('test')} className="w-full flex items-center justify-between p-5 bg-white border-2 border-slate-100 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition-colors"><FlaskConical /></div>
                  <div className="text-left">
                    <p className="font-bold text-slate-800">測試模式</p>
                    <p className="text-xs text-slate-500">快速體驗，不需登入</p>
                  </div>
                </div>
                <PlayCircle className="text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-xl font-bold">{isRegistering ? '註冊帳號' : '登入系統'}</h2>
                <button type="button" onClick={() => setAppMode('selection')} className="text-sm text-blue-600 hover:underline">返回模式選擇</button>
              </div>
              <input type="email" placeholder="電子郵件" className="w-full p-3 border rounded-lg" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="密碼" className="w-full p-3 border rounded-lg" value={password} onChange={e => setPassword(e.target.value)} required />
              {authError && <p className="text-red-500 text-sm">{authError}</p>}
              <Button type="submit" className="w-full py-3 text-lg">{isRegistering ? '立即註冊' : '確認登入'}</Button>
              <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-slate-500 text-sm">
                {isRegistering ? '已有帳號？點此登入' : '還沒有帳號？點此註冊'}
              </button>
            </form>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-slate-900 text-white hidden md:flex flex-col p-6 space-y-2">
        <div className="flex items-center gap-2 font-bold text-2xl text-blue-400 mb-10"><Wallet /> 金流大師</div>
        <NavButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={<PieChart size={20}/>} label="總覽" />
        <NavButton active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} icon={<Wallet size={20}/>} label="帳戶" />
        <NavButton active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<TrendingUp size={20}/>} label="明細" />
        <NavButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} icon={<BrainCircuit size={20}/>} label="AI 建議" />
        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className={`px-3 py-2 rounded-lg mb-4 text-xs font-bold ${appMode === 'production' ? 'bg-green-900/30 text-green-400' : 'bg-amber-900/30 text-amber-400'}`}>
             {appMode === 'production' ? '● 正式連線中' : '○ 測試模式體驗中'}
          </div>
          <p className="text-[10px] text-slate-500 truncate mb-4">{user?.email || "Local Guest"}</p>
          <button onClick={handleLogout} className="flex items-center gap-3 text-red-400 text-sm hover:text-red-300"><LogOut size={16}/> 登出/返回</button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'overview' && <OverviewView state={state} onAdd={addTransaction} />}
        {activeTab === 'accounts' && <AccountsView state={state} onAdd={addAccount} />}
        {activeTab === 'transactions' && <TransactionsView state={state} />}
        {activeTab === 'ai' && <AIView result={aiResult} loading={isAnalyzing} onRun={handleRunAI} />}
      </main>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
    {icon} <span>{label}</span>
  </button>
);

const OverviewView = ({ state, onAdd }: any) => {
  const [form, setForm] = useState({ accountId: '', categoryId: '', amount: 0, type: '支出' as CategoryType, date: new Date().toISOString().split('T')[0], note: '' });
  const total = useMemo(() => state.accounts.reduce((s: number, a: any) => s + a.balance, 0), [state.accounts]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-blue-600 text-white border-none shadow-blue-200">
          <p className="text-blue-100 text-sm uppercase font-bold tracking-wider">資產淨額</p>
          <h2 className="text-3xl font-black mt-1">NT$ {total.toLocaleString()}</h2>
        </Card>
        <Card title="快速記帳" className="md:col-span-2">
          <form className="grid grid-cols-2 md:grid-cols-5 gap-3" onSubmit={e => { e.preventDefault(); onAdd(form); setForm({...form, amount: 0}); }}>
            <select className="p-2 border rounded-lg bg-slate-50 text-sm" value={form.type} onChange={e => setForm({...form, type: e.target.value as CategoryType})}>
              <option value="支出">支出</option>
              <option value="收入">收入</option>
            </select>
            <select className="p-2 border rounded-lg bg-slate-50 text-sm" value={form.accountId} onChange={e => setForm({...form, accountId: e.target.value})} required>
              <option value="">帳戶</option>
              {state.accounts.map((a:any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select className="p-2 border rounded-lg bg-slate-50 text-sm" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})} required>
              <option value="">分類</option>
              {state.categories.filter((c:any) => c.type === form.type).map((c:any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" className="p-2 border rounded-lg bg-slate-50 text-sm" placeholder="金額" value={form.amount || ''} onChange={e => setForm({...form, amount: Number(e.target.value)})} required />
            <Button type="submit">儲存</Button>
          </form>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="資金分佈">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={state.accounts}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="balance" radius={[4, 4, 0, 0]} barSize={40}>
                  {state.accounts.map((entry: any, index: number) => <Cell key={`c-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="最近交易">
          <div className="space-y-4">
            {state.transactions.slice(0, 5).map((tx: any) => (
              <div key={tx.id} className="flex justify-between items-center border-b pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-bold text-slate-800">{state.categories.find((c:any) => c.id === tx.categoryId)?.name}</p>
                  <p className="text-xs text-slate-500">{tx.date} · {state.accounts.find((a:any) => a.id === tx.accountId)?.name}</p>
                </div>
                <p className={`font-bold ${tx.type === '收入' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === '收入' ? '+' : '-'} {tx.amount.toLocaleString()}
                </p>
              </div>
            ))}
            {state.transactions.length === 0 && <p className="text-center text-slate-400 py-10">尚無交易明細</p>}
          </div>
        </Card>
      </div>
    </div>
  );
};

const AccountsView = ({ state, onAdd }: any) => {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState(0);
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {state.accounts.map((acc: any) => (
        <Card key={acc.id} className="border-t-4" style={{ borderTopColor: acc.color }}>
          <p className="text-xs font-bold text-slate-400 uppercase">{acc.name}</p>
          <p className="text-2xl font-black mt-2">NT$ {acc.balance.toLocaleString()}</p>
        </Card>
      ))}
      <Card className="border-dashed bg-slate-50/50 flex flex-col items-center justify-center min-h-[140px]">
        <input className="w-full mb-2 p-1 border rounded text-sm" placeholder="帳戶名稱" value={name} onChange={e => setName(e.target.value)} />
        <input type="number" className="w-full mb-2 p-1 border rounded text-sm" placeholder="初始餘額" value={balance || ''} onChange={e => setBalance(Number(e.target.value))} />
        <Button className="w-full" variant="secondary" onClick={() => { if(name){ onAdd(name, balance); setName(''); setBalance(0); } }}>
          新增
        </Button>
      </Card>
    </div>
  );
};

const TransactionsView = ({ state }: any) => (
  <Card title="交易明細表" className="p-0">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-slate-500">
        <tr>
          <th className="p-4 text-left">日期</th>
          <th className="p-4 text-left">類型</th>
          <th className="p-4 text-left">分類</th>
          <th className="p-4 text-right">金額</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {state.transactions.map((tx: any) => (
          <tr key={tx.id} className="hover:bg-slate-50">
            <td className="p-4 text-slate-500">{tx.date}</td>
            <td className="p-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tx.type === '收入' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{tx.type}</span></td>
            <td className="p-4 font-bold">{state.categories.find((c:any) => c.id === tx.categoryId)?.name}</td>
            <td className={`p-4 text-right font-bold ${tx.type === '收入' ? 'text-green-600' : 'text-red-500'}`}>{tx.type === '收入' ? '+' : '-'} {tx.amount.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
);

const AIView = ({ result, loading, onRun }: any) => (
  <div className="max-w-3xl mx-auto text-center space-y-6">
    <div className="p-8 bg-purple-50 rounded-3xl inline-block mb-4"><BrainCircuit className="text-purple-600" size={48} /></div>
    <h2 className="text-2xl font-bold text-slate-800">AI 財務分析</h2>
    <p className="text-slate-500">讓 Gemini 3 Pro 為您的收支習慣把脈，給予專業的理財建議。</p>
    <Button onClick={onRun} disabled={loading} className="bg-purple-600 hover:bg-purple-700 mx-auto px-10 py-3 text-lg">
      {loading ? <Loader2 className="animate-spin" /> : "開始分析我的帳單"}
    </Button>
    {result && (
      <Card className="text-left border-purple-100 bg-white shadow-xl p-8 mt-10">
        <div className="prose prose-purple max-w-none text-slate-700 leading-relaxed">
          {result.split('\n').map((l, i) => <p key={i} className="mb-2">{l}</p>)}
        </div>
      </Card>
    )}
  </div>
);

export default App;
