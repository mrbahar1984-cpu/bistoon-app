
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './calculations';
import { RefreshCcw, ShieldAlert, Check, X, Trash2, Settings, FileText, UserCheck } from 'lucide-react';
import { CalculationResult, EmployeeData, AttendanceLog, LogType, LeaveRequest } from './types';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [dutyHours, setDutyHours] = useState(192);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // دریافت پرسنل
      const { data: empData } = await supabase.from('employees').select('*');
      if (!empData) return;
      const formatted: EmployeeData[] = empData.map(e => ({ id: e.id, name: e.name, nationalId: e.national_id, password: e.password, logs: [] }));
      setEmployees(formatted);
      
      // دریافت درخواست‌های مرخصی
      const { data: reqData } = await supabase.from('leave_requests').select('*, employees(name)').order('timestamp', { ascending: false });
      if (reqData) setRequests(reqData.map((r: any) => ({ ...r, employee_name: r.employees.name })));

      // محاسبه کارکرد
      const newResults: Record<string, CalculationResult> = {};
      for (const emp of formatted) {
        const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id);
        if (logs) {
          const attendanceLogs: AttendanceLog[] = logs.map(l => ({ id: l.id, timestamp: l.timestamp, type: l.type as LogType, shamsiDate: l.shamsi_date, time: l.time }));
          newResults[emp.nationalId] = calculateWorkDetails(attendanceLogs, dutyHours);
        }
      }
      setResults(newResults);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleRequest = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id);
      if (error) throw error;
      fetchAllData();
    } catch (e) { alert('خطا در تغییر وضعیت'); }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('آیا از حذف این کارمند و تمام سوابق او مطمئن هستید؟')) return;
    try {
      await supabase.from('attendance_logs').delete().eq('employee_id', id);
      await supabase.from('leave_requests').delete().eq('employee_id', id);
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      fetchAllData();
    } catch (e) { alert('خطا در حذف کارمند'); }
  };

  useEffect(() => { if (adminAuth) fetchAllData(); }, [adminAuth, dutyHours]);

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 px-4 text-center">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
          <ShieldAlert size={48} className="mx-auto text-indigo-500 mb-6" />
          <h2 className="text-2xl font-black text-slate-800 mb-8">ورود به بخش مدیریت</h2>
          <input type="password" placeholder="رمز عبور ادمین" className="w-full p-4 rounded-2xl bg-slate-50 text-center font-black mb-4 outline-none border border-slate-100 focus:border-indigo-500" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('رمز اشتباه است')} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100">ورود به پنل</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-slate-800">سامانه نظارت بیستون</h2>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
              <span className="text-[10px] font-black text-slate-500">ساعت موظفی:</span>
              <input type="number" className="w-12 bg-transparent font-black text-indigo-600 outline-none" value={dutyHours} onChange={e => setDutyHours(Number(e.target.value))} />
           </div>
           <button onClick={fetchAllData} className="bg-indigo-600 text-white p-4 rounded-2xl flex items-center gap-2 font-black text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> بروزرسانی داده‌ها
           </button>
        </div>
      </header>

      <div className="grid md:grid-cols-12 gap-8">
        <div className="md:col-span-4 space-y-6">
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><UserCheck size={18}/> لیست پرسنل</div>
              <div className="space-y-3">
                 {employees.map((emp, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <div>
                        <p className="text-slate-800 font-black text-xs">{emp.name}</p>
                        <p className="text-slate-400 text-[9px] mt-0.5 font-mono">{emp.nationalId}</p>
                      </div>
                      <button onClick={() => deleteEmployee(emp.id!)} className="p-2 text-rose-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><Settings size={18}/> تایید درخواست‌ها</div>
              <div className="space-y-4">
                 {requests.filter(r => r.status === 'PENDING').length === 0 ? <p className="text-center text-slate-400 py-4 text-[10px]">درخواستی وجود ندارد</p> : 
                   requests.filter(r => r.status === 'PENDING').map((r, i) => (
                     <div key={i} className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3">
                        <div className="flex justify-between items-start">
                           <span className="text-[10px] font-black text-indigo-700">{r.employee_name}</span>
                           <span className="text-[8px] bg-white px-2 py-0.5 rounded-full text-indigo-400">{r.type === 'DAILY_LEAVE' ? 'روزانه' : 'ساعتی'}</span>
                        </div>
                        <p className="text-[10px] text-slate-600 font-bold">{r.description}</p>
                        <div className="flex gap-2">
                           <button onClick={() => handleRequest(r.id, 'APPROVED')} className="flex-1 bg-emerald-500 text-white p-2 rounded-lg flex justify-center"><Check size={14}/></button>
                           <button onClick={() => handleRequest(r.id, 'REJECTED')} className="flex-1 bg-rose-500 text-white p-2 rounded-lg flex justify-center"><X size={14}/></button>
                        </div>
                     </div>
                   ))
                 }
              </div>
           </div>
        </div>

        <div className="md:col-span-8 space-y-6">
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><FileText size={18}/> گزارش ماهانه کارکرد</div>
              <div className="space-y-4 overflow-x-auto">
                 <table className="w-full text-right text-xs">
                    <thead>
                       <tr className="text-slate-400 border-b border-slate-50">
                          <th className="p-4">نام کارمند</th>
                          <th className="p-4">کارکرد کل</th>
                          <th className="p-4">اضافه‌کاری</th>
                          <th className="p-4">تعطیل‌کاری</th>
                       </tr>
                    </thead>
                    <tbody>
                       {employees.map((emp, i) => {
                         const res = results[emp.nationalId];
                         return (
                           <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-black">{emp.name}</td>
                              <td className="p-4 text-indigo-600 font-bold">{res?.formattedTotal || '---'}</td>
                              <td className="p-4 text-emerald-600 font-bold">{res?.formattedOvertime || '---'}</td>
                              <td className="p-4 text-amber-600 font-bold">{res?.formattedHoliday || '---'}</td>
                           </tr>
                         );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
