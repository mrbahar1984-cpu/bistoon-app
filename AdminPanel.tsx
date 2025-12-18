
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './calculations';
import { RefreshCcw, History, TrendingUp, Calculator, ShieldAlert } from 'lucide-react';
import { CalculationResult, EmployeeData, AttendanceLog, LogType } from './types';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: empData } = await supabase.from('employees').select('*');
      if (!empData) return;
      
      const formatted: EmployeeData[] = empData.map(e => ({ id: e.id, name: e.name, nationalId: e.national_id, password: e.password, logs: [] }));
      setEmployees(formatted);
      
      const newResults: Record<string, CalculationResult> = {};
      for (const emp of formatted) {
        const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).order('timestamp', { ascending: false });
        if (logs) {
          const attendanceLogs: AttendanceLog[] = logs.map(l => ({ 
            id: l.id, 
            timestamp: l.timestamp, 
            type: l.type as LogType, 
            shamsiDate: l.shamsi_date || l.shams_date, 
            time: l.time 
          }));
          newResults[emp.nationalId] = calculateWorkDetails(attendanceLogs);
        }
      }
      setResults(newResults);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { if (adminAuth) fetchAllData(); }, [adminAuth]);

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 px-4">
        <div className="bg-[#1e293b] p-10 rounded-[3rem] shadow-2xl border border-slate-700 text-center">
          <ShieldAlert size={48} className="mx-auto text-indigo-500 mb-8" />
          <h2 className="text-3xl font-black text-white mb-8">ورود ادمین</h2>
          <input type="password" placeholder="رمز" className="w-full p-6 rounded-3xl bg-slate-800 text-white text-center font-black mb-4 outline-none focus:border-indigo-500 border border-transparent" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('رمز اشتباه است')} className="w-full bg-indigo-600 text-white p-6 rounded-3xl font-black hover:bg-indigo-700 transition-all">ورود به پنل</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4">
      <header className="bg-[#1e293b] p-8 rounded-[3rem] border border-slate-700 flex justify-between items-center shadow-2xl">
        <h2 className="text-3xl font-black text-white">مدیریت ترددها</h2>
        <button onClick={fetchAllData} className="bg-indigo-600 text-white px-8 py-5 rounded-2xl flex items-center gap-3 font-black hover:bg-indigo-700 transition-all">
          <RefreshCcw className={loading ? 'animate-spin' : ''} /> بروزرسانی داده‌ها
        </button>
      </header>

      <div className="grid md:grid-cols-4 gap-8">
        <aside className="bg-[#1e293b] p-8 rounded-[3rem] border border-slate-700 h-fit">
           <h3 className="font-black text-white mb-6 text-xl">لیست پرسنل</h3>
           <div className="space-y-3">
              {employees.map((emp, i) => (
                <div key={i} className="p-4 bg-slate-800 rounded-2xl border border-slate-700">
                   <p className="text-white font-black">{emp.name}</p>
                   <p className="text-slate-500 text-[10px] mt-1 font-mono">{emp.nationalId}</p>
                </div>
              ))}
           </div>
        </aside>

        <main className="md:col-span-3 space-y-6">
           {employees.map((emp, idx) => {
             const res = results[emp.nationalId];
             return (
               <div key={idx} className="bg-[#1e293b] p-8 rounded-[3rem] border border-slate-700 shadow-xl">
                  <div className="flex items-center gap-6 mb-6">
                     <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-black">{idx + 1}</div>
                     <h4 className="text-xl font-black text-white">{emp.name}</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <StatCard label="کارکرد کل" value={res?.formattedTotal} icon={<History />} />
                     <StatCard label="اضافه‌کاری" value={res?.formattedOvertime} icon={<TrendingUp />} />
                     <StatCard label="تعطیل‌کاری" value={res?.formattedHoliday} icon={<Calculator />} />
                  </div>
               </div>
             );
           })}
        </main>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon }: any) => (
  <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
    <div className="flex items-center gap-3 mb-3 text-slate-500 text-[10px] font-black">{icon} {label}</div>
    <p className="text-xl font-black text-white">{value || '---'}</p>
  </div>
);

export default AdminPanel;
