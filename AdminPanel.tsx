
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './utils/calculations';
import { Users, RefreshCcw, Printer, Calculator, CheckCircle2, History, TrendingUp, AlertCircle, Database, ShieldAlert, Wifi, WifiOff, Loader2 } from 'lucide-react';
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
      alert('✅ اتصال با موفقیت تایید شد! دیتابیس آنلاین و آماده به کار است.');
    } catch (err: any) {
      setDbStatus('error');
      alert('❌ خطا در اتصال! لطفاً اینترنت خود را بررسی کنید یا مطمئن شوید جداول SQL را در پنل Supabase ساخته‌اید.');
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
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (adminAuth) fetchAllData();
  }, [adminAuth]);

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 px-4">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
          <div className="bg-indigo-600 w-24 h-24 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-indigo-200">
            <Calculator size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-2">پنل مدیریت بیستون</h2>
          <p className="text-slate-400 text-sm mb-10">نظارت مرکزی و محاسبه کارکرد</p>
          
          <div className="space-y-4">
            <input 
              type="password" 
              placeholder="رمز عبور (پیش‌فرض: admin123)" 
              className="w-full p-6 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none text-center font-black transition-all"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (password === 'admin123' ? setAdminAuth(true) : alert('رمز اشتباه است'))}
            />
            <button 
              onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('رمز اشتباه است')}
              className="w-full bg-slate-900 text-white p-6 rounded-3xl font-black shadow-xl hover:bg-slate-800 active:scale-95 transition-all text-lg"
            >
              ورود به پنل
            </button>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-50 flex flex-col items-center gap-4">
             <button 
               onClick={testConnection}
               disabled={loading}
               className="flex items-center gap-3 px-6 py-3 bg-indigo-50 rounded-2xl text-indigo-600 text-sm font-black hover:bg-indigo-100 transition-all"
             >
               {loading ? <Loader2 className="animate-spin" size={18} /> : (dbStatus === 'success' ? <Wifi size={18} /> : <Database size={18} />)}
               تست اتصال به دیتابیس ابری
             </button>
             {dbStatus === 'success' && <span className="text-xs font-bold text-emerald-500 flex items-center gap-1"><CheckCircle2 size={14}/> وضعیت: آنلاین و متصل</span>}
             {dbStatus === 'error' && <span className="text-xs font-bold text-rose-500 flex items-center gap-1"><WifiOff size={14}/> وضعیت: عدم اتصال</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 md:p-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800">داشبورد نظارت مرکزی</h2>
          <div className="flex items-center gap-2 mt-2">
             <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
             <p className="text-sm text-slate-400 font-bold">تمام داده‌ها از سرور ابری دریافت شدند</p>
          </div>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button onClick={fetchAllData} className="flex-1 md:flex-none bg-slate-50 text-slate-600 px-8 py-5 rounded-[1.5rem] hover:bg-slate-100 transition-all flex items-center justify-center gap-3 font-black">
            <RefreshCcw size={24} className={loading ? 'animate-spin' : ''} />
            بروزرسانی
          </button>
          <button onClick={() => window.print()} className="flex-1 md:flex-none bg-indigo-600 text-white px-8 py-5 rounded-[1.5rem] hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 font-black shadow-xl shadow-indigo-100">
            <Printer size={24} />
            خروجی PDF
          </button>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-8">
        <aside className="space-y-6">
           <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl">
              <h3 className="font-black mb-8 flex items-center gap-3 text-xl">
                <Users size={28} className="text-indigo-400" /> لیست پرسنل
              </h3>
              <div className="space-y-4">
                {employees.map((emp, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/5 p-5 rounded-3xl border border-white/5 hover:bg-white/10 transition-all cursor-default group">
                    <div className="text-right">
                       <p className="text-base font-black group-hover:text-indigo-300 transition-colors">{emp.name}</p>
                       <p className="text-xs text-slate-500 mt-1 font-mono">{emp.nationalId}</p>
                    </div>
                    <CheckCircle2 size={20} className="text-emerald-400 opacity-50" />
                  </div>
                ))}
                {employees.length === 0 && <p className="text-center text-slate-500 py-12 italic text-sm font-bold">در انتظار ثبت‌نام...</p>}
              </div>
           </div>
        </aside>

        <main className="md:col-span-3 space-y-8">
           {employees.map((emp, idx) => {
             const res = results[emp.nationalId];
             return (
               <div key={idx} className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all duration-500">
                  <div className="absolute top-0 right-0 w-3 h-full bg-indigo-600 transform scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-500"></div>
                  
                  <div className="flex justify-between items-start mb-12">
                     <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center text-indigo-600 font-black text-3xl shadow-inner">
                           {emp.name.charAt(0)}
                        </div>
                        <div>
                           <h4 className="text-2xl font-black text-slate-800">{emp.name}</h4>
                           <p className="text-sm text-slate-400 mt-1 font-bold">کد ملی: {emp.nationalId}</p>
                        </div>
                     </div>
                     <div className="text-left bg-emerald-50 px-4 py-2 rounded-xl">
                        <p className="text-[11px] text-emerald-600 font-black uppercase tracking-widest">وضعیت ماهانه</p>
                        <p className="text-sm font-black text-emerald-700">فعال</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <ResultCard 
                        label="مجموع کارکرد خالص" 
                        value={res?.formattedTotal} 
                        color="text-slate-800" 
                        subLabel="بدون کسر مرخصی ساعتی" 
                        icon={<History className="text-indigo-500" size={20} />} 
                     />
                     <ResultCard 
                        label="اضافه‌کاری" 
                        value={res?.formattedOvertime} 
                        color="text-emerald-600" 
                        subLabel="مازاد بر ۱۹۲ ساعت ماهانه" 
                        icon={<TrendingUp className="text-emerald-500" size={20} />} 
                     />
                     <ResultCard 
                        label="تعطیل‌کاری (جمعه)" 
                        value={res?.formattedHoliday} 
                        color="text-rose-500" 
                        subLabel="محاسبه جداگانه جمعه‌ها" 
                        icon={<ShieldAlert className="text-rose-500" size={20} />} 
                     />
                  </div>
               </div>
             );
           })}
           
           {employees.length === 0 && !loading && (
             <div className="h-[500px] bg-white rounded-[3rem] border-4 border-dashed border-slate-50 flex flex-col items-center justify-center text-slate-300">
                <Users size={80} className="mb-8 opacity-10" />
                <p className="font-black text-2xl">دیتابیس هنوز خالی است</p>
                <p className="text-sm mt-4 text-center px-12 leading-relaxed font-bold">کارمندان باید در صفحه اصلی ثبت‌نام کنند تا نام آن‌ها اینجا ظاهر شود.</p>
             </div>
           )}
        </main>
      </div>
    </div>
  );
};

const ResultCard = ({ label, value, color, subLabel, icon }: any) => (
  <div className="bg-slate-50/50 p-8 rounded-[2rem] border border-slate-50 hover:bg-white hover:shadow-inner transition-all duration-300">
    <div className="flex items-center gap-3 mb-4">
       <div className="bg-white p-2 rounded-lg shadow-sm">{icon}</div>
       <p className="text-xs text-slate-400 font-black tracking-tight">{label}</p>
    </div>
    <p className={`text-2xl font-black ${color} mb-2`}>{value || '۰ ساعت'}</p>
    <p className="text-[10px] text-slate-300 font-black uppercase tracking-wider">{subLabel}</p>
  </div>
);

export default AdminPanel;
