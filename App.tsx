
import React, { useState, useEffect } from 'react';
// Fixed: Changed import style to resolve module resolution issues for react-router-dom members
import * as ReactRouterDOM from 'react-router-dom';
import Dashboard from './Dashboard';
import AdminPanel from './AdminPanel';
import { EmployeeData } from './types';
import { User, BarChart3, Clock } from 'lucide-react';

// Extracting members from the namespace to handle environments where named exports are not detected correctly
const { HashRouter, Routes, Route, Link } = ReactRouterDOM;

const App: React.FC = () => {
  const [employee, setEmployee] = useState<EmployeeData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('employee_data');
    if (saved) {
      try { 
        setEmployee(JSON.parse(saved)); 
      } catch (e) { 
        console.error("Error loading data:", e); 
      }
    }
  }, []);

  const saveEmployee = (data: EmployeeData) => {
    setEmployee(data);
    localStorage.setItem('employee_data', JSON.stringify(data));
  };

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
        <aside className="w-full md:w-64 bg-indigo-900 text-white p-6 shadow-xl flex flex-col shrink-0">
          <div className="mb-10 text-center">
            <div className="bg-indigo-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Clock size={32} />
            </div>
            <h1 className="text-xl font-bold">سامانه بیستون</h1>
            <p className="text-[10px] text-indigo-300 mt-1 uppercase tracking-widest">Attendance System</p>
          </div>
          
          <nav className="space-y-2 flex-1">
            <Link to="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-indigo-800 transition-colors">
              <User size={20} />
              <span>پنل کارمند</span>
            </Link>
            <Link to="/admin" className="flex items-center gap-3 p-3 rounded-lg hover:bg-indigo-800 transition-colors">
              <BarChart3 size={20} />
              <span>پنل مدیریت</span>
            </Link>
          </nav>
          
          <div className="mt-auto pt-6 border-t border-indigo-800 text-[10px] text-indigo-400 text-center italic">
            طراحی شده برای مدیریت هوشمند
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard employee={employee} onSave={saveEmployee} />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
