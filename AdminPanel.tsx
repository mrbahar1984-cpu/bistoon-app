
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './calculations';
import { RefreshCcw, ShieldAlert, Check, X, Trash2, Settings, FileText, UserCheck, Download, Calendar, UserPlus, Clock } from 'lucide-react';
import { CalculationResult, EmployeeData, AttendanceLog, LogType, LeaveRequest } from './types';
import { getShamsiDate, getShamsiTime } from './jalali';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [dutyHours, setDutyHours] = useState(192);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // فیلترها و گزارشات
  const [dateRange, setDateRange] = useState({ from: getShamsiDate(), to: getShamsiDate() });
  const [reportLogs, setReportLogs] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('all');

  // فرم تردد دستی
  const [manualLog, setManualLog] = useState({ empId: '', type: LogType.CLOCK_IN, date: getShamsiDate(), time: getShamsiTime() });

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
          newResults[emp.id!] = calculateWorkDetails(attendanceLogs, dutyHours);
        }
      }
      setResults(newResults);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const getCustomReport = async () => {
    setLoading(true);
    try {
      let query = supabase.from('attendance_logs')
        .select('*, employees(name)')
        .gte('shamsi_date', dateRange.from)
        .lte('shamsi_date', dateRange.to)
        .order('timestamp', { ascending: true });
      
      if (selectedEmpId !== 'all') {
        query = query.eq('employee_id', selectedEmpId);
      }

      const { data } = await query;
      if (data) setReportLogs(data);
    } catch (e) { alert('خطا در دریافت گزارش'); }
    setLoading(false);
  };

  const submitManualLog = async () => {
    if (!manualLog.empId) return alert('لطفاً کارمند را انتخاب کنید');
    setLoading(true);
    try {
      const { error } = await supabase.from('attendance_logs').insert([{
        employee_id: manualLog.empId,
        type: manualLog.type,
        shamsi_date: manualLog.date,
        time: manualLog.time,
        timestamp: Date.now() // تقریب زمانی برای لاگ دستی
      }]);
      if (error) throw error;
      alert('✅ تردد دستی ثبت شد');
      fetchAllData();
    } catch (e) { alert('خطا در ثبت'); }
    setLoading(false);
  };

  const deleteEmployee = async (id: string) => {
    if (!window.confirm('هشدار: با حذف کارمند تمام سوابق، ترددها و مرخصی‌های او نیز حذف خواهد شد. ادامه می‌دهید؟')) return;
    setLoading(true);
    try {
      // حذف دستی وابستگی‌ها برای اطمینان از رفع باگ Foreign Key
      await supabase.from('attendance_logs').delete().eq('employee_id', id);
      await supabase.from('leave_requests').delete().eq('employee_id', id);
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
      alert('کارمند و سوابق با موفقیت حذف شدند');
      fetchAllData();
    } catch (e) { alert('خطا در حذف کارمند'); }
    setLoading(false);
  };

  const handleRequest = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id);
      if (error) throw error;
      fetchAllData();
    } catch (e) { alert('خطا در تغییر وضعیت'); }
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
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-emerald-600 flex items-center gap-2">BaharTime Admin</h2>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
              <span className="text-[10px] font-black text-slate-500">موظفی ماه:</span>
              <input type="number" className="w-12 bg-transparent font-black text-emerald-600 outline-none" value={dutyHours} onChange={e => setDutyHours(Number(e.target.value))} />
           </div>
           <button onClick={fetchAllData} className="bg-emerald-600 text-white p-4 rounded-2xl flex items-center gap-2 font-black text-xs">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> بروزرسانی داده‌ها
           </button>
        </div>
      </header>

      <div className="grid md:grid-cols-12 gap-8">
        <div className="md:col-span-4 space-y-6">
           {/* ثبت تردد دستی */}
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-4 pb-2 border-b"><Clock size={18}/> ثبت تردد دستی (اصلاحیه)</div>
              <div className="space-y-3">
                 <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={manualLog.empId} onChange={e => setManualLog({...manualLog, empId: e.target.value})}>
                    <option value="">انتخاب کارمند...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                 </select>
                 <div className="flex gap-2">
                    <select className="flex-1 p-3 bg-slate-50 rounded-xl text-[10px] font-bold outline-none" value={manualLog.type} onChange={e => setManualLog({...manualLog, type: e.target.value as LogType})}>
                       <option value={LogType.CLOCK_IN}>ورود</option>
                       <option value={LogType.CLOCK_OUT}>خروج</option>
                    </select>
                    <input className="flex-1 p-3 bg-slate-50 rounded-xl text-[10px] font-mono text-center" value={manualLog.time} onChange={e => setManualLog({...manualLog, time: e.target.value})} placeholder="۱۲:۳۰" />
                 </div>
                 <input className="w-full p-3 bg-slate-50 rounded-xl text-[10px] font-mono text-center" value={manualLog.date} onChange={e => setManualLog({...manualLog, date: e.target.value})} placeholder="۱۴۰۳/۰۱/۰۱" />
                 <button onClick={submitManualLog} className="w-full bg-indigo-600 text-white p-3 rounded-xl font-black text-xs">ثبت تردد توسط مدیر</button>
              </div>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><UserCheck size={18}/> لیست پرسنل</div>
              <div className="space-y-3">
                 {employees.map((emp, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group">
                      <div>
                        <p className="text-slate-800 font-black text-xs">{emp.name}</p>
                        <p className="text-slate-400 text-[9px] mt-0.5 font-mono">{emp.nationalId}</p>
                      </div>
                      <button onClick={() => deleteEmployee(emp.id!)} className="p-2 text-rose-300 hover:text-rose-600 transition-colors"><Trash2 size={16}/></button>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="md:col-span-8 space-y-6">
           {/* گزارش‌گیری پیشرفته */}
           <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 font-black text-slate-700"><Calendar size={18}/> فیلتر گزارشات هوشمند</div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 mr-2">از تاریخ:</label>
                    <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-center text-xs" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 mr-2">تا تاریخ:</label>
                    <input className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-center text-xs" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 mr-2">انتخاب کارمند:</label>
                    <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-slate-100" value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
                       <option value="all">همه پرسنل</option>
                       {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                 </div>
              </div>
              
              <div className="flex gap-2">
                 <button onClick={getCustomReport} className="flex-1 bg-indigo-600 text-white p-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-50"><FileText size={16}/> دریافت گزارش ریز تردد</button>
                 <button onClick={() => {}} className="bg-emerald-500 text-white p-4 rounded-xl font-black text-xs flex items-center gap-2"><Download size={16}/> خروجی Excel</button>
              </div>

              {reportLogs.length > 0 && (
                <div className="mt-6 max-h-[300px] overflow-y-auto custom-scrollbar border border-slate-100 rounded-2xl">
                   <table className="w-full text-right text-[10px]">
                      <thead className="bg-slate-50 sticky top-0">
                         <tr>
                            <th className="p-3">نام</th>
                            <th className="p-3">تاریخ</th>
                            <th className="p-3">ساعت</th>
                            <th className="p-3">نوع تردد</th>
                         </tr>
                      </thead>
                      <tbody>
                         {reportLogs.map((log, i) => (
                           <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                              <td className="p-3 font-black">{log.employees?.name}</td>
                              <td className="p-3 font-mono">{log.shamsi_date}</td>
                              <td className="p-3 font-mono text-emerald-600">{log.time}</td>
                              <td className="p-3 text-[9px]">{log.type === 'CLOCK_IN' ? 'ورود' : log.type === 'CLOCK_OUT' ? 'خروج' : 'پاس ساعتی'}</td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
              )}
           </section>

           {/* گزارش تجمیعی کل کارمندان */}
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><Settings size={18}/> گزارش تجمیعی کارکرد (ماه جاری)</div>
              <div className="overflow-x-auto">
                 <table className="w-full text-right text-[10px]">
                    <thead>
                       <tr className="text-slate-400 border-b">
                          <th className="p-4">نام</th>
                          <th className="p-4">کل کارکرد</th>
                          <th className="p-4">اضافه‌کار</th>
                          <th className="p-4">مرخصی ساعتی</th>
                       </tr>
                    </thead>
                    <tbody>
                       {employees.map((emp, i) => {
                         const res = results[emp.id!];
                         return (
                           <tr key={i} className="border-b hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-black">{emp.name}</td>
                              <td className="p-4 text-emerald-600 font-bold">{res?.formattedTotal || '۰'}</td>
                              <td className="p-4 text-indigo-600 font-bold">{res?.formattedOvertime || '۰'}</td>
                              <td className="p-4 text-amber-600 font-bold">{res?.leaveMinutes ? `${Math.floor(res.leaveMinutes / 60)} ساعت` : '۰'}</td>
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
