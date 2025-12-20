
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './calculations';
import { RefreshCcw, ShieldAlert, Check, X, Trash2, Settings, FileText, UserCheck, Download, Calendar } from 'lucide-react';
import { CalculationResult, EmployeeData, AttendanceLog, LogType, LeaveRequest } from './types';
import { getShamsiDate } from './jalali';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [dutyHours, setDutyHours] = useState(192);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // فیلتر گزارش
  const [dateRange, setDateRange] = useState({ from: getShamsiDate(), to: getShamsiDate() });
  const [reportLogs, setReportLogs] = useState<any[]>([]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: empData } = await supabase.from('employees').select('*');
      if (!empData) return;
      const formatted: EmployeeData[] = empData.map(e => ({ id: e.id, name: e.name, nationalId: e.national_id, password: e.password, logs: [] }));
      setEmployees(formatted);
      
      const { data: reqData } = await supabase.from('leave_requests').select('*, employees(name)').order('timestamp', { ascending: false });
      if (reqData) setRequests(reqData.map((r: any) => ({ ...r, employee_name: r.employees?.name })));

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

  const getCustomReport = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('attendance_logs')
        .select('*, employees(name)')
        .gte('shamsi_date', dateRange.from)
        .lte('shamsi_date', dateRange.to)
        .order('timestamp', { ascending: true });
      if (data) setReportLogs(data);
    } catch (e) { alert('خطا در دریافت گزارش'); }
    setLoading(false);
  };

  const exportToExcel = () => {
    if (reportLogs.length === 0) return alert('ابتدا روی دکمه دریافت گزارش کلیک کنید');
    
    let csvContent = "\ufeff"; // BOM for UTF-8 Excel support
    csvContent += "نام کارمند,تاریخ,ساعت,نوع تردد\n";
    
    reportLogs.forEach(log => {
      const typeStr = log.type === 'CLOCK_IN' ? 'ورود' : log.type === 'CLOCK_OUT' ? 'خروج' : 'مرخصی/پاس';
      csvContent += `${log.employees?.name || 'نامعلوم'},${log.shamsi_date},${log.time},${typeStr}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `BaharTime_Report_${dateRange.from}_to_${dateRange.to}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRequest = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id);
      if (error) throw error;
      fetchAllData();
    } catch (e) { alert('خطا در تغییر وضعیت'); }
  };

  // Fix: Added missing deleteEmployee function to resolve reference error
  const deleteEmployee = async (id: string) => {
    if (!window.confirm('آیا از حذف این کارمند اطمینان دارید؟')) return;
    try {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      fetchAllData();
    } catch (e) { 
      console.error(e);
      alert('خطا در حذف کارمند'); 
    }
  };

  useEffect(() => { if (adminAuth) fetchAllData(); }, [adminAuth, dutyHours]);

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 px-4 text-center">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
          <ShieldAlert size={48} className="mx-auto text-emerald-500 mb-6" />
          <h2 className="text-2xl font-black text-slate-800 mb-8">مدیریت BaharTime</h2>
          <input type="password" placeholder="رمز عبور ادمین" className="w-full p-4 rounded-2xl bg-slate-50 text-center font-black mb-4 outline-none border border-slate-100 focus:border-emerald-500" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('رمز اشتباه است')} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black">ورود به پنل ادمین</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-emerald-600 flex items-center gap-2">BaharTime Admin</h2>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
              <span className="text-[10px] font-black text-slate-500">موظفی ماه:</span>
              <input type="number" className="w-12 bg-transparent font-black text-emerald-600 outline-none" value={dutyHours} onChange={e => setDutyHours(Number(e.target.value))} />
           </div>
           <button onClick={fetchAllData} className="bg-emerald-600 text-white p-4 rounded-2xl flex items-center gap-2 font-black text-xs">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> بروزرسانی
           </button>
        </div>
      </header>

      {/* بخش گزارش‌گیری بازه زمانی */}
      <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
         <div className="flex items-center gap-2 font-black text-slate-700 mb-6"><Calendar size={18}/> گزارش ترددهای ماهانه و بازه‌ای</div>
         <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 space-y-2">
               <label className="text-[10px] font-black text-slate-400">از تاریخ (مثلاً ۱۴۰۳/۰۱/۰۱):</label>
               <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-center" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} />
            </div>
            <div className="flex-1 space-y-2">
               <label className="text-[10px] font-black text-slate-400">تا تاریخ:</label>
               <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-center" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} />
            </div>
            <div className="flex items-end gap-2">
               <button onClick={getCustomReport} className="bg-indigo-600 text-white p-4 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-indigo-100"><FileText size={16}/> دریافت لیست</button>
               <button onClick={exportToExcel} className="bg-emerald-500 text-white p-4 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-100"><Download size={16}/> خروجی اکسل</button>
            </div>
         </div>
         {reportLogs.length > 0 && (
           <div className="max-h-[300px] overflow-y-auto custom-scrollbar border rounded-2xl">
              <table className="w-full text-right text-[10px]">
                 <thead className="bg-slate-50 sticky top-0">
                    <tr>
                       <th className="p-3">نام</th>
                       <th className="p-3">تاریخ</th>
                       <th className="p-3">ساعت</th>
                       <th className="p-3">نوع</th>
                    </tr>
                 </thead>
                 <tbody>
                    {reportLogs.map((log, i) => (
                      <tr key={i} className="border-t border-slate-50">
                         <td className="p-3 font-black">{log.employees?.name}</td>
                         <td className="p-3 font-mono">{log.shamsi_date}</td>
                         <td className="p-3 font-mono text-emerald-600">{log.time}</td>
                         <td className="p-3">{log.type}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
         )}
      </section>

      <div className="grid md:grid-cols-12 gap-8">
        <div className="md:col-span-4 space-y-6">
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><UserCheck size={18}/> لیست پرسنل</div>
              <div className="space-y-3">
                 {employees.map((emp, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group">
                      <div>
                        <p className="text-slate-800 font-black text-xs">{emp.name}</p>
                        <p className="text-slate-400 text-[9px] mt-0.5 font-mono">{emp.nationalId}</p>
                      </div>
                      <button onClick={() => deleteEmployee(emp.id!)} className="p-2 text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><Settings size={18}/> تایید درخواست‌ها</div>
              <div className="space-y-4">
                 {requests.filter(r => r.status === 'PENDING').length === 0 ? <p className="text-center text-slate-400 py-4 text-[10px]">درخواستی نیست</p> : 
                   requests.filter(r => r.status === 'PENDING').map((r, i) => (
                     <div key={i} className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-3">
                        <div className="flex justify-between items-start">
                           <span className="text-[10px] font-black text-indigo-700">{r.employee_name} ({r.type === 'DAILY_LEAVE' ? `${r.amount} روز` : `${r.amount} ساعت`})</span>
                        </div>
                        <p className="text-[10px] text-slate-600">{r.description}</p>
                        <div className="flex gap-2">
                           <button onClick={() => handleRequest(r.id, 'APPROVED')} className="flex-1 bg-emerald-500 text-white p-2 rounded-lg"><Check size={14} className="mx-auto"/></button>
                           <button onClick={() => handleRequest(r.id, 'REJECTED')} className="flex-1 bg-rose-500 text-white p-2 rounded-lg"><X size={14} className="mx-auto"/></button>
                        </div>
                     </div>
                   ))
                 }
              </div>
           </div>
        </div>

        <div className="md:col-span-8 space-y-6">
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><FileText size={18}/> خلاصه کارکرد پرسنل</div>
              <div className="space-y-4 overflow-x-auto">
                 <table className="w-full text-right text-[10px]">
                    <thead>
                       <tr className="text-slate-400 border-b">
                          <th className="p-4">نام</th>
                          <th className="p-4">کارکرد کل</th>
                          <th className="p-4">اضافه‌کاری</th>
                          <th className="p-4">تعطیل‌کاری</th>
                       </tr>
                    </thead>
                    <tbody>
                       {employees.map((emp, i) => {
                         const res = results[emp.nationalId];
                         return (
                           <tr key={i} className="border-b hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-black">{emp.name}</td>
                              <td className="p-4 text-emerald-600 font-bold">{res?.formattedTotal || '---'}</td>
                              <td className="p-4 text-indigo-600 font-bold">{res?.formattedOvertime || '---'}</td>
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
