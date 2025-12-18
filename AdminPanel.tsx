
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './utils/calculations';
import { Users, RefreshCcw, Printer, Calculator, CheckCircle2, History, TrendingUp, Database, Wifi, Loader2, ShieldAlert } from 'lucide-react';
import { CalculationResult, EmployeeData, AttendanceLog, LogType } from './types';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'none' | 'success' | 'error'>('none');

  const testConnection = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('employees').select('id', { count: 'exact', head: true });
      if (error) throw error;
      setDbStatus('success');
      alert('🚀 اتصال با موفقیت تایید شد! داده‌ها همگام هستند.');
    } catch (err) {
      setDbStatus('error');
      alert('❌ خطا در اتصال! لطفاً اینترنت را چک کنید.');
    }
    setLoading(false);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: empData, error: empError } = await supabase.from('employees').select('*');
      if (empError) throw empError;
      const formatted: EmployeeData[] = empData.map(e => ({ id: e.id, name: e.name, nationalId: e.national_id, password: e.password, logs: [] }));
      setEmployees(formatted);
      
      const newResults: Record<string, CalculationResult> = {};
      for (const emp of formatted) {
        const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id).order('timestamp', { ascending: false });
        if (logs) {
          const attendanceLogs: AttendanceLog[] = logs.map(l => ({ id: l.id, timestamp: l.timestamp, type: l.type as LogType, shamsiDate: l.shamsi_date, time: l.time }));
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
          <div className="bg-indigo-600 w-24 h-24 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-8 shadow-2xl">
            <ShieldAlert size={48} />
          </div>
          <h2 className="text-3xl font-black text-white mb-8">ورود به مدیریت کل</h2>
          <input type="password" placeholder="گذرواژه ادمین" className="w-full p-6 rounded-3xl bg-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none text-center font-black text-white transition-all mb-4" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && (password === 'admin123' ? setAdminAuth(true) : alert('رمز اشتباه'))} />
          <button onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('رمز اشتباه')} className="w-full bg-indigo-600 text-white p-6 rounded-3xl font-black shadow-xl hover:bg-indigo-700 transition-all text-lg mb-10">تایید ورود</button>
          
          <div className="pt-8 border-t border-slate-700 flex flex-col items-center gap-4">
             <button onClick={testConnection} disabled={loading} className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-emerald-600 rounded-3xl text-white font-black hover:bg-emerald-700 transition-all animate-bounce shadow-xl shadow-emerald-900/20">
               {loading ? <Loader2 className="animate-spin" /> : <Database />}
               تست آنلاین بودن دیتابیس
             </button>
             {dbStatus === 'success' && <span className="text-xs font-bold text-emerald-400">✅ سیستم کاملاً آنلاین است</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="bg-[#1e293b] p-8 rounded-[3rem] border border-slate-700 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl">
        <div>
          <h2 className="text-3xl font-black text-white">نظارت مرکزی بیستون</h2>
          <p className="text-emerald-400 text-xs font-bold mt-2 flex items-center gap-2">
            <Wifi size={14} /> همگام‌سازی ابری فعال است
          </p>
        </div>
        <div className="flex gap-4">
          <button onClick={fetchAllData} className="bg-slate-700 text-white px-8 py-5 rounded-2xl hover:bg-slate-600 flex items-center gap-3 font-black">
            <RefreshCcw className={loading ? 'animate-spin' : ''} /> بروزرسانی
          </button>
          <button onClick={() => window.print()} className="bg-indigo-600 text-white px-8 py-5 rounded-2xl hover:bg-indigo-700 flex items-center gap-3 font-black shadow-xl">
            <Printer /> چاپ گزارش
          </button>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-8">
        <aside className="bg-[#1e293b] p-8 rounded-[3rem] border border-slate-700 h-fit shadow-xl">
           <h3 className="font-black text-white mb-6 flex items-center gap-2 text-xl">
              <Users className="text-indigo-400" /> پرسنل فعال
           </h3>
           <div className="space-y-3">
              {employees.map((emp, i) => (
                <div key={i} className="p-4 bg-slate-800 rounded-2xl border border-slate-700">
                   <p className="text-white font-black text-sm">{emp.name}</p>
                   <p className="text-slate-500 text-[10px] mt-1 font-mono">{emp.nationalId}</p>
                </div>
              ))}
              {employees.length === 0 && <p className="text-slate-600 text-center py-10 italic">در انتظار ثبت‌نام...</p>}
           </div>
        </aside>

        <main className="md:col-span-3 space-y-6">
           {employees.map((emp, idx) => {
             const res = results[emp.nationalId];
             return (
               <div key={idx} className="bg-[#1e293b] p-8 rounded-[3rem] border border-slate-700 shadow-xl group hover:border-indigo-500/50 transition-all">
                  <div className="flex items-center gap-6 mb-10 border-b border-slate-700 pb-6">
                     <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 text-2xl font-black">{emp.name.charAt(0)}</div>
                     <div>
                        <h4 className="text-xl font-black text-white">{emp.name}</h4>
                        <p className="text-xs text-slate-500 mt-1 font-bold tracking-widest uppercase">Employee Code: {emp.nationalId}</p>
                     </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <StatCard label="کارکرد خالص" value={res?.formattedTotal} icon={<History />} />
                     <StatCard label="اضافه‌کاری" value={res?.formattedOvertime} icon={<TrendingUp />} />
                     <StatCard label="جمعه‌کاری" value={res?.formattedHoliday} icon={<Calculator />} />
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
    <div className="flex items-center gap-3 mb-3 text-slate-500">
       {icon} <span className="text-[10px] font-black uppercase">{label}</span>
    </div>
    <p className="text-xl font-black text-white">{value || '۰ ساعت'}</p>
  </div>
);

export default AdminPanel;
