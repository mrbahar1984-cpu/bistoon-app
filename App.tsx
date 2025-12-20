
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import AdminPanel from './AdminPanel';
import { EmployeeData } from './types';
import { ShieldCheck, LogOut, LayoutDashboard, Flower2 } from 'lucide-react';

const APP_VERSION = "7.0.0-BaharTime";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<EmployeeData | null>(null);

  useEffect(() => {
    const lastVersion = localStorage.getItem('app_version');
    if (lastVersion !== APP_VERSION) {
      localStorage.clear();
      localStorage.setItem('app_version', APP_VERSION);
      window.location.reload();
      return;
    }
    const saved = localStorage.getItem('current_user_v7');
    if (saved) setCurrentUser(JSON.parse(saved));
  }, []);

  const handleLogin = (user: EmployeeData) => {
    localStorage.setItem('current_user_v7', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('current_user_v7');
    setCurrentUser(null);
    window.location.hash = '/';
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-800 font-['Vazirmatn']">
        {currentUser && (
          <aside className="w-full md:w-64 bg-white border-l border-slate-200 p-6 flex flex-col shadow-sm z-20">
            <div className="mb-10 flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-600 rounded-3xl flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-200">
                <Flower2 size={32} />
              </div>
              <h1 className="text-lg font-black text-slate-800">BaharTime</h1>
              <span className="text-[8px] text-emerald-600 font-black mt-1 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest">{currentUser.name}</span>
            </div>
            
            <nav className="space-y-1 flex-1">
              <Link to="/" className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-100 text-slate-600 hover:text-emerald-600 transition-all font-bold text-sm">
                <LayoutDashboard size={18} />
                <span>میز کار من</span>
              </Link>
              
              <Link to="/admin" className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-100 text-slate-600 hover:text-emerald-600 transition-all font-bold text-sm">
                <ShieldCheck size={18} />
                <span>مدیریت سیستم</span>
              </Link>
            </nav>
            
            <div className="mt-auto pt-6 border-t border-slate-100 space-y-2">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all font-bold text-sm">
                <LogOut size={18} />
                <span>خروج از حساب</span>
              </button>
            </div>
          </aside>
        )}

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
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
