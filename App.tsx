
import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import AdminPanel from './AdminPanel';
import { EmployeeData } from './types';
import { User, ShieldCheck, LogOut, LayoutDashboard, RefreshCw, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<EmployeeData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('current_user_cloud_v3');
    if (saved) setCurrentUser(JSON.parse(saved));
  }, []);

  const handleLogin = (user: EmployeeData) => {
    localStorage.setItem('current_user_cloud_v3', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('current_user_cloud_v3');
    setCurrentUser(null);
    window.location.hash = '/';
  };

  const clearAndReload = () => {
    localStorage.clear();
    sessionStorage.clear();
    alert('در حال پاکسازی کش و بروزرسانی به نسخه ۳.۰...');
    window.location.reload();
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col md:flex-row bg-[#0f172a] text-slate-100 font-['Vazirmatn']">
        {currentUser && (
          <aside className="w-full md:w-72 bg-[#1e293b] border-l border-slate-700 p-6 flex flex-col shadow-2xl z-20">
            <div className="mb-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-indigo-500 rounded-[2rem] flex items-center justify-center text-white mb-4 shadow-xl shadow-indigo-500/20">
                <User size={40} />
              </div>
              <h1 className="text-lg font-black text-white">{currentUser.name}</h1>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-[10px] text-emerald-400 font-black uppercase">Cloud V3.0</span>
              </div>
            </div>
            
            <nav className="space-y-2 flex-1">
              <Link to="/" className="flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-700 text-slate-300 hover:text-white transition-all font-bold">
                <LayoutDashboard size={20} />
                <span>پنل ثبت تردد</span>
              </Link>
              
              <Link to="/admin" className="flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-700 text-slate-300 hover:text-white transition-all font-bold">
                <ShieldCheck size={20} />
                <span>مدیریت کل (ادمین)</span>
              </Link>
            </nav>
            
            <div className="mt-auto pt-6 border-t border-slate-700 space-y-2">
              <button onClick={clearAndReload} className="w-full flex items-center gap-3 p-4 rounded-2xl text-slate-400 hover:bg-slate-700 transition-all font-bold text-xs">
                <RefreshCw size={16} />
                <span>بروزرسانی اجباری نسخه</span>
              </button>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 rounded-2xl text-rose-400 hover:bg-rose-500/10 transition-all font-bold">
                <LogOut size={20} />
                <span>خروج از حساب</span>
              </button>
            </div>
          </aside>
        )}

        <main className="flex-1 p-4 md:p-10 overflow-y-auto bg-[#0f172a]">
          <Routes>
            <Route path="/" element={<Dashboard currentUser={currentUser} onLogin={handleLogin} />} />
            <Route path="/admin" element={currentUser ? <AdminPanel /> : <Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
