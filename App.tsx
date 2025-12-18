
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import AdminPanel from './AdminPanel';
import { EmployeeData } from './types';
import { User, ShieldCheck, LogOut, LayoutDashboard } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<EmployeeData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('current_user');
    if (saved) setCurrentUser(JSON.parse(saved));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('current_user');
    setCurrentUser(null);
    window.location.hash = '/';
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col md:flex-row bg-[#f0f2f5] text-slate-900 font-['Vazirmatn']">
        {currentUser && (
          <aside className="w-full md:w-72 bg-white border-l border-slate-200 p-6 flex flex-col shadow-sm">
            <div className="mb-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
                <User size={40} />
              </div>
              <h1 className="text-lg font-bold text-slate-800">{currentUser.name}</h1>
              <span className="text-xs text-slate-400 mt-1">کد ملی: {currentUser.nationalId}</span>
            </div>
            
            <nav className="space-y-2 flex-1">
              <Link to="/" className="flex items-center gap-3 p-4 rounded-2xl hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-all font-medium">
                <LayoutDashboard size={20} />
                <span>پنل کاربری</span>
              </Link>
              
              {/* دکمه مدیریت فقط برای نمایش است، در واقعیت با رمز عبور جداگانه کنترل می‌شود */}
              <Link to="/admin" className="flex items-center gap-3 p-4 rounded-2xl hover:bg-slate-100 text-slate-500 transition-all font-medium">
                <ShieldCheck size={20} />
                <span>ورود به مدیریت</span>
              </Link>
            </nav>
            
            <button 
              onClick={handleLogout}
              className="mt-auto flex items-center gap-3 p-4 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all font-medium"
            >
              <LogOut size={20} />
              <span>خروج از حساب</span>
            </button>
          </aside>
        )}

        <main className="flex-1 p-4 md:p-10">
          <Routes>
            <Route path="/" element={<Dashboard currentUser={currentUser} onLogin={setCurrentUser} />} />
            <Route path="/admin" element={currentUser ? <AdminPanel /> : <Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
