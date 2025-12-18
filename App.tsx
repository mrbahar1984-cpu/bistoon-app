
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import { EmployeeData } from './types';
import { Settings, User, BarChart3, Clock } from 'lucide-react';

const App: React.FC = () => {
  const [employee, setEmployee] = useState<EmployeeData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('employee_data');
    if (saved) {
      setEmployee(JSON.parse(saved));
    }
  }, []);

  const saveEmployee = (data: EmployeeData) => {
    setEmployee(data);
    localStorage.setItem('employee_data', JSON.stringify(data));
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-indigo-900 text-white p-6 shadow-xl">
          <div className="mb-10 text-center">
            <div className="bg-indigo-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock size={32} />
            </div>
            <h1 className="text-xl font-bold">سامانه بیستون</h1>
            <p className="text-xs text-indigo-300 mt-1">مدیریت هوشمند تردد</p>
          </div>

          <nav className="space-y-2">
            <Link to="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-indigo-800 transition-colors">
              <User size={20} />
              <span>پنل کارمند</span>
            </Link>
            <Link to="/admin" className="flex items-center gap-3 p-3 rounded-lg hover:bg-indigo-800 transition-colors">
              <BarChart3 size={20} />
              <span>پنل مدیریت (گزارشات)</span>
            </Link>
          </nav>

          <div className="mt-auto pt-10 text-xs text-indigo-400">
            {employee ? `ورود با: ${employee.name}` : 'کاربر ثبت نشده'}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Routes>
            <Route 
              path="/" 
              element={<Dashboard employee={employee} onSave={saveEmployee} />} 
            />
            <Route 
              path="/admin" 
              element={<AdminPanel />} 
            />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
