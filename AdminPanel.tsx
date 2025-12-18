
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './utils/calculations';
import { Users, RefreshCcw, Printer, Calculator, CheckCircle2, History } from 'lucide-react';
import { CalculationResult } from './types';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    // دریافت لیست کارمندان
    const { data: empData } = await supabase.from('employees').select('*');
    if (empData) {
      setEmployees(empData);
      
      // دریافت تمام لاگ‌ها و محاسبه
      for (const emp of empData) {
        const { data: logs } = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('employee_id', emp.id);
        
        if (logs) {
          // تبدیل نام فیلدها به فرمت اپلیکیشن
          const formattedLogs = logs.map(l => ({
            id: l.id,
            timestamp: l.timestamp,
            type: l.type,
            shamsiDate: l.shamsi_date,
            time: l.time
          }));
          const calc = calculateWorkDetails(formattedLogs);
          setResults(prev => ({ ...prev, [emp.national_id]: calc }));
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (adminAuth) fetchAllData();
  }, [adminAuth]);

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white p-10 rounded-[2.5rem] shadow-xl text-center">
        <div className="bg-slate-900 w-16 h-16 rounded-3xl flex items-center justify-center text-white mx-auto mb-6">
          <Calculator size={32} />
        </div>
        <h2 className="text-xl font-bold mb-6">ورود به پنل مدیریت ابری</h2>
        <input 
          type="password" 
          placeholder="رمز عبور مدیریت" 
          className="w-full p-4 rounded-2xl bg-slate-50 mb-4 outline-none border-2 border-transparent focus:border-indigo-500 text-center"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button 
          onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('غلط است')}
          className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold active:scale-95 transition-all"
        >
          تایید هویت و اتصال به دیتابیس
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800 text-right">مانیتورینگ زنده کارمندان</h2>
          <p className="text-sm text-slate-400 mt-1">دسترسی مستقیم به دیتابیس مرکزی (بدون واسطه)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAllData} className="bg-slate-100 text-slate-600 p-4 rounded-2xl hover:bg-slate-200 transition-all">
            <RefreshCcw size={24} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => window.print()} className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl hover:bg-indigo-100 transition-all">
            <Printer size={24} />
          </button>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-8">
        <div className="space-y-6">
           <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Users size={18} /> لیست پرسنل ({employees.length})
              </h3>
              <div className="space-y-3">
                {employees.map((emp, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/10 p-3 rounded-xl border border-white/5">
                    <div className="text-right">
                       <p className="text-xs font-bold">{emp.name}</p>
                       <p className="text-[9px] text-slate-400">{emp.national_id}</p>
                    </div>
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  </div>
                ))}
                {employees.length === 0 && <p className="text-center text-slate-500 py-6 italic text-xs">در حال بارگذاری...</p>}
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-700">
                <History size={18} /> وضعیت سیستم
              </h3>
              <div className="space-y-2">
                 <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">آخرین همگام‌سازی:</span>
                    <span className="text-slate-600 font-mono">الآن</span>
                 </div>
                 <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">دیتابیس ابری:</span>
                    <span className="text-emerald-500 font-bold">متصل</span>
                 </div>
              </div>
           </div>
        </div>

        <div className="md:col-span-3 space-y-6">
           {employees.map((emp, idx) => {
             const res = results[emp.national_id];
             return (
               <div key={idx} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                  <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500"></div>
                  <div className="flex justify-between items-start mb-8">
                     <div>
                        <h4 className="text-xl font-black text-slate-800">{emp.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">شناسه پرسنلی: {emp.national_id}</p>
                     </div>
                     <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold">
                        مشاهده جزئیات کارکرد
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <ResultCard label="مجموع کارکرد ماهانه" value={res?.formattedTotal} color="text-emerald-600" />
                     <ResultCard label="اضافه‌کاری" value={res?.formattedOvertime} color="text-indigo-600" />
                     <ResultCard label="تعطیل‌کاری" value={res?.formattedHoliday} color="text-rose-600" />
                  </div>
               </div>
             );
           })}
           {employees.length === 0 && !loading && (
             <div className="h-[400px] bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                <Users size={64} className="mb-4 opacity-20" />
                <p className="font-bold">هیچ کارمندی در دیتابیس یافت نشد.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

const ResultCard = ({ label, value, color }: any) => (
  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
    <p className="text-[10px] text-slate-400 mb-2 font-bold">{label}</p>
    <p className={`text-sm font-black ${color}`}>{value || '۰ ساعت'}</p>
  </div>
);

export default AdminPanel;
