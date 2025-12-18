
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './utils/calculations';
import { Users, RefreshCcw, Printer, Calculator, CheckCircle2, History, TrendingUp, AlertCircle, Database, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
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
      // تست خواندن تعداد کارمندان برای تایید اتصال
      const { data, error } = await supabase.from('employees').select('id', { count: 'exact', head: true });
      if (error) throw error;
      setDbStatus('success');
      alert('✅ اتصال با موفقیت تایید شد! حالا می‌توانید کارمندان را ثبت‌نام کنید.');
    } catch (err: any) {
      setDbStatus('error');
      alert('❌ اتصال برقرار نشد! \n۱. مطمئن شوید URL و Key را در فایل supabaseClient.ts درست وارد کرده‌اید.\n۲. اینترنت خود را چک کنید.');
      console.error(err);
    }
    setLoading(false);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: empData, error: empError } = await supabase.from('employees').select('*');
      
      if (empError) throw empError;

      if (empData) {
        const formattedEmployees: EmployeeData[] = empData.map(e => ({
          id: e.id,
          name: e.name,
          nationalId: e.national_id,
          password: e.password,
          logs: []
        }));
        setEmployees(formattedEmployees);
        
        const newResults: Record<string, CalculationResult> = {};
        
        for (const emp of formattedEmployees) {
          const { data: logs } = await supabase
            .from('attendance_logs')
            .select('*')
            .eq('employee_id', emp.id)
            .order('timestamp', { ascending: false });
          
          if (logs) {
            const attendanceLogs: AttendanceLog[] = logs.map(l => ({
              id: l.id,
              timestamp: l.timestamp,
              type: l.type as LogType,
              shamsiDate: l.shamsi_date,
              time: l.time
            }));
            newResults[emp.nationalId] = calculateWorkDetails(attendanceLogs);
          }
        }
        setResults(newResults);
      }
    } catch (e) {
      alert("خطا در دریافت اطلاعات. اتصال دیتابیس را چک کنید.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (adminAuth) fetchAllData();
  }, [adminAuth]);

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-50 text-center">
          <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-indigo-100">
            <Calculator size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">پنل مدیریت بیستون</h2>
          <p className="text-slate-400 text-sm mb-8">نظارت مرکزی از راه دور</p>
          <input 
            type="password" 
            placeholder="رمز عبور (admin123)" 
            className="w-full p-5 rounded-2xl bg-slate-50 mb-4 outline-none border-2 border-transparent focus:border-indigo-500 text-center font-bold"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (password === 'admin123' ? setAdminAuth(true) : alert('رمز اشتباه است'))}
          />
          <button 
            onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('رمز اشتباه است')}
            className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-bold shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
          >
            ورود به سیستم
          </button>
          
          <div className="mt-8 pt-6 border-t border-slate-50">
             <button 
               onClick={testConnection}
               disabled={loading}
               className="flex items-center gap-2 mx-auto text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors"
             >
               {dbStatus === 'success' ? <Wifi className="text-emerald-500" size={14} /> : (dbStatus === 'error' ? <WifiOff className="text-rose-500" size={14} /> : <Database size={14} />)}
               {loading ? 'در حال بررسی...' : 'تست آنلاین بودن دیتابیس'}
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">داشبورد نظارت مرکزی</h2>
          <div className="flex items-center gap-2 mt-1">
             <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
             <p className="text-xs text-slate-400 font-medium">اتصال به دیتابیس ابری برقرار است</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchAllData} className="bg-slate-50 text-slate-600 px-6 py-4 rounded-2xl hover:bg-slate-100 transition-all flex items-center gap-2 font-bold">
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
            بروزرسانی داده‌ها
          </button>
          <button onClick={() => window.print()} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl hover:bg-indigo-700 transition-all flex items-center gap-2 font-bold shadow-lg shadow-indigo-100">
            <Printer size={20} />
            خروجی PDF
          </button>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-8">
        <aside className="space-y-6">
           <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl">
              <h3 className="font-bold mb-6 flex items-center gap-3 text-lg">
                <Users size={24} className="text-indigo-400" /> لیست پرسنل
              </h3>
              <div className="space-y-3">
                {employees.map((emp, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="text-right">
                       <p className="text-sm font-bold">{emp.name}</p>
                       <p className="text-[10px] text-slate-500 mt-1">{emp.nationalId}</p>
                    </div>
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  </div>
                ))}
                {employees.length === 0 && <p className="text-center text-slate-500 py-10 italic text-sm">در انتظار ثبت‌نام اولین کارمند...</p>}
              </div>
           </div>
        </aside>

        <main className="md:col-span-3 space-y-6">
           {employees.map((emp, idx) => {
             const res = results[emp.nationalId];
             return (
               <div key={idx} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute top-0 right-0 w-2 h-full bg-indigo-600 transform scale-y-0 group-hover:scale-y-100 transition-transform origin-top"></div>
                  
                  <div className="flex justify-between items-start mb-10">
                     <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xl">
                           {emp.name.charAt(0)}
                        </div>
                        <div>
                           <h4 className="text-xl font-black text-slate-800">{emp.name}</h4>
                           <p className="text-xs text-slate-400 mt-1">کد ملی: {emp.nationalId}</p>
                        </div>
                     </div>
                     <div className="text-left">
                        <p className="text-[10px] text-slate-300 font-black uppercase tracking-wider">وضعیت</p>
                        <p className="text-xs font-bold text-emerald-500">فعال در ماه جاری</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <ResultCard label="کل کارکرد ماه" value={res?.formattedTotal} color="text-slate-800" subLabel="بدون کسر مرخصی" icon={<History className="text-indigo-500" size={16} />} />
                     <ResultCard label="اضافه‌کاری" value={res?.formattedOvertime} color="text-emerald-600" subLabel="مازاد بر ۱۹۲ ساعت" icon={<TrendingUp className="text-emerald-500" size={16} />} />
                     <ResultCard label="تعطیل‌کاری" value={res?.formattedHoliday} color="text-rose-500" subLabel="جمعه‌ها" icon={<ShieldAlert className="text-rose-500" size={16} />} />
                  </div>
               </div>
             );
           })}
           
           {employees.length === 0 && !loading && (
             <div className="h-[400px] bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
                <Users size={64} className="mb-6 opacity-20" />
                <p className="font-black text-lg">هنوز کارمندی ثبت نشده است</p>
             </div>
           )}
        </main>
      </div>
    </div>
  );
};

const ResultCard = ({ label, value, color, subLabel, icon }: any) => (
  <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-50 hover:bg-white transition-colors">
    <div className="flex items-center gap-2 mb-3">
       {icon}
       <p className="text-[10px] text-slate-400 font-black">{label}</p>
    </div>
    <p className={`text-lg font-black ${color} mb-1`}>{value || '۰ ساعت'}</p>
    <p className="text-[9px] text-slate-300 font-bold">{subLabel}</p>
  </div>
);

export default AdminPanel;
