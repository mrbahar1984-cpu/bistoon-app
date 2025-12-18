
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './utils/calculations';
import { Users, RefreshCcw, Printer, Calculator, CheckCircle2, History, TrendingUp, AlertCircle, Database, ShieldAlert } from 'lucide-react';
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
      // تست خواندن از جدول کارمندان
      const { error } = await supabase.from('employees').select('count', { count: 'exact', head: true });
      if (error) throw error;
      setDbStatus('success');
      alert('✅ تبریک! اتصال به سرور ابری با موفقیت برقرار شد.');
    } catch (err: any) {
      setDbStatus('error');
      alert('❌ خطا در اتصال: احتمالا URL یا Key را اشتباه وارد کرده‌اید یا جداول را در SQL Editor نساخته‌اید.');
      console.error(err);
    }
    setLoading(false);
  };

  const fetchAllData = async () => {
    setLoading(true);
    const { data: empData, error: empError } = await supabase.from('employees').select('*');
    
    if (empError) {
      alert("خطا در دریافت لیست کارمندان. وضعیت اتصال را بررسی کنید.");
      setLoading(false);
      return;
    }

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
          .eq('employee_id', emp.id);
        
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
    setLoading(false);
  };

  useEffect(() => {
    if (adminAuth) fetchAllData();
  }, [adminAuth]);

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-indigo-50 text-center">
          <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-indigo-100">
            <Calculator size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">پنل مدیریت بیستون</h2>
          <p className="text-slate-400 text-sm mb-8">برای دسترسی به گزارشات ابری وارد شوید</p>
          <input 
            type="password" 
            placeholder="رمز عبور مدیریت" 
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
               className="flex items-center gap-2 mx-auto text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors"
             >
               <Database size={12} />
               تست اتصال به دیتابیس
             </button>
             {dbStatus === 'success' && <p className="text-[10px] text-emerald-500 mt-2 font-bold">اتصال دیتابیس تایید شد ✅</p>}
             {dbStatus === 'error' && <p className="text-[10px] text-rose-500 mt-2 font-bold">خطا در تنظیمات دیتابیس ❌</p>}
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
             <p className="text-xs text-slate-400 font-medium">اتصال ابری (Supabase) فعال است</p>
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
                {employees.length === 0 && <p className="text-center text-slate-500 py-10 italic text-sm">در حال انتظار برای ثبت‌نام اولین کارمند...</p>}
              </div>
           </div>

           <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
              <div className="flex items-center gap-2 text-indigo-700 font-bold mb-3">
                 <AlertCircle size={20} />
                 <span className="text-sm">اطلاعات سیستمی</span>
              </div>
              <p className="text-[11px] text-indigo-600 leading-loose">
                 داده‌ها به صورت رمزنگاری شده در سرور ابری ذخیره می‌شوند. شما از هر جای دنیا به این گزارشات دسترسی دارید.
              </p>
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
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 font-black text-xl">
                           {emp.name.charAt(0)}
                        </div>
                        <div>
                           <h4 className="text-xl font-black text-slate-800">{emp.name}</h4>
                           <p className="text-xs text-slate-400 mt-1">کد ملی: {emp.nationalId}</p>
                        </div>
                     </div>
                     <div className="text-left">
                        <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">Status</p>
                        <p className="text-xs font-bold text-emerald-500">فعال</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <ResultCard 
                        label="کل کارکرد (خالص)" 
                        value={res?.formattedTotal} 
                        color="text-slate-800" 
                        subLabel="بدون احتساب مرخصی"
                        icon={<History className="text-indigo-500" size={16} />}
                     />
                     <ResultCard 
                        label="اضافه‌کاری ماه" 
                        value={res?.formattedOvertime} 
                        color="text-emerald-600" 
                        subLabel="مازاد بر موظفی"
                        icon={<TrendingUp className="text-emerald-500" size={16} />}
                     />
                     <ResultCard 
                        label="تعطیل‌کاری (جمعه)" 
                        value={res?.formattedHoliday} 
                        color="text-rose-500" 
                        subLabel="روزهای تعطیل"
                        icon={<ShieldAlert className="text-rose-500" size={16} />}
                     />
                  </div>
               </div>
             );
           })}
           
           {employees.length === 0 && !loading && (
             <div className="h-[400px] bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
                <Users size={64} className="mb-6 opacity-20" />
                <p className="font-black text-lg">هنوز کارمندی ثبت نشده است</p>
                <p className="text-sm mt-2 text-center px-10">کارمندان شما باید ابتدا در صفحه اصلی برنامه ثبت‌نام کنند تا نامشان در اینجا ظاهر شود.</p>
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
