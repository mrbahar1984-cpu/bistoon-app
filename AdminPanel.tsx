
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './calculations';
import { RefreshCcw, ShieldAlert, Check, X, Trash2, Settings, FileText, UserCheck, Download, Calendar, Clock, Edit2, Printer, Plus } from 'lucide-react';
import { CalculationResult, EmployeeData, AttendanceLog, LogType, LeaveRequest, MonthlyDuty } from './types';
import { getShamsiDate, getShamsiTime } from './jalali';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // مدیریت موظفی
  const [dutyList, setDutyList] = useState<MonthlyDuty[]>([]);
  const [newDuty, setNewDuty] = useState({ year: 1403, month: '01', hours: 192 });

  // فیلترها
  const [dateRange, setDateRange] = useState({ from: getShamsiDate(), to: getShamsiDate() });
  const [reportLogs, setReportLogs] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('all');

  // فرم تردد دستی / ویرایش
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualLog, setManualLog] = useState({ empId: '', type: LogType.CLOCK_IN, date: getShamsiDate(), time: getShamsiTime() });

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: empData } = await supabase.from('employees').select('*');
      const { data: duties } = await supabase.from('monthly_duties').select('*');
      if (duties) setDutyList(duties);

      if (!empData) return;
      const formatted: EmployeeData[] = empData.map(e => ({ id: e.id, name: e.name, nationalId: e.national_id, password: e.password, logs: [] }));
      setEmployees(formatted);
      
      const { data: reqData } = await supabase.from('leave_requests').select('*, employees(name)').order('timestamp', { ascending: false });
      if (reqData) setRequests(reqData.map((r: any) => ({ ...r, employee_name: r.employees?.name })));

      const newResults: Record<string, CalculationResult> = {};
      // دریافت تمام لاگ‌ها برای محاسبه دقیق تجمیعی
      for (const emp of formatted) {
        const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', emp.id);
        if (logs) {
          const attendanceLogs: AttendanceLog[] = logs.map(l => ({ 
            id: l.id, 
            timestamp: l.timestamp, 
            type: l.type as LogType, 
            shamsiDate: l.shamsi_date, 
            time: l.time,
            is_manual: l.is_manual,
            is_edited: l.is_edited
          }));
          // پیدا کردن موظفی مربوطه (ساده‌سازی: فعلاً اولین مقدار لیست یا پیش‌فرض)
          const currentDuty = dutyList[0]?.hours || 192;
          newResults[emp.id!] = calculateWorkDetails(attendanceLogs, currentDuty);
        }
      }
      setResults(newResults);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const submitManualLog = async () => {
    if (!manualLog.empId) return alert('لطفاً کارمند را انتخاب کنید');
    setLoading(true);
    try {
      if (editMode && editingId) {
        await supabase.from('attendance_logs').update({
          type: manualLog.type,
          shamsi_date: manualLog.date,
          time: manualLog.time,
          is_edited: true
        }).eq('id', editingId);
        alert('✅ تردد ویرایش شد');
      } else {
        await supabase.from('attendance_logs').insert([{
          employee_id: manualLog.empId,
          type: manualLog.type,
          shamsi_date: manualLog.date,
          time: manualLog.time,
          timestamp: Date.now(),
          is_manual: true
        }]);
        alert('✅ تردد دستی ثبت شد');
      }
      setEditMode(false);
      setEditingId(null);
      fetchAllData();
      getCustomReport();
    } catch (e) { alert('خطا در ثبت'); }
    setLoading(false);
  };

  const deleteLog = async (id: string) => {
    if (!window.confirm('آیا از حذف این تردد اطمینان دارید؟')) return;
    await supabase.from('attendance_logs').delete().eq('id', id);
    getCustomReport();
    fetchAllData();
  };

  const saveDuty = async () => {
    try {
      await supabase.from('monthly_duties').insert([newDuty]);
      fetchAllData();
      alert('موظفی ثبت شد');
    } catch (e) { alert('خطا در ثبت موظفی'); }
  };

  const getCustomReport = async () => {
    setLoading(true);
    try {
      let query = supabase.from('attendance_logs')
        .select('*, employees(name)')
        .gte('shamsi_date', dateRange.from)
        .lte('shamsi_date', dateRange.to)
        .order('shamsi_date', { ascending: true })
        .order('time', { ascending: true });
      
      if (selectedEmpId !== 'all') query = query.eq('employee_id', selectedEmpId);
      const { data } = await query;
      if (data) setReportLogs(data);
    } catch (e) { alert('خطا در دریافت گزارش'); }
    setLoading(false);
  };

  const handlePrint = () => window.print();

  useEffect(() => { if (adminAuth) fetchAllData(); }, [adminAuth]);

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
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4">
      {/* هدر مخصوص چاپ نیست */}
      <header className="no-print flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h2 className="text-xl font-black text-emerald-600">پنل مدیریت BaharTime</h2>
        <div className="flex gap-2">
           <button onClick={handlePrint} className="bg-slate-100 text-slate-600 p-4 rounded-2xl flex items-center gap-2 font-black text-xs hover:bg-slate-200 transition-all"><Printer size={16}/> چاپ گزارش</button>
           <button onClick={fetchAllData} className="bg-emerald-600 text-white p-4 rounded-2xl flex items-center gap-2 font-black text-xs hover:bg-emerald-700 transition-all">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> بروزرسانی
           </button>
        </div>
      </header>

      <div className="grid md:grid-cols-12 gap-8">
        {/* ستون کناری (تنظیمات) - در چاپ مخفی */}
        <div className="md:col-span-4 space-y-6 no-print">
           {/* موظفی ماهانه */}
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-4 pb-2 border-b"><Plus size={18}/> تعریف موظفی ماه</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                 <input type="number" className="p-3 bg-slate-50 rounded-xl text-xs font-mono" placeholder="سال" value={newDuty.year} onChange={e => setNewDuty({...newDuty, year: Number(e.target.value)})} />
                 <select className="p-3 bg-slate-50 rounded-xl text-xs font-bold" value={newDuty.month} onChange={e => setNewDuty({...newDuty, month: e.target.value})}>
                    {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
              </div>
              <input type="number" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-mono mb-3" placeholder="ساعات موظفی (مثلاً ۱۹۲)" value={newDuty.hours} onChange={e => setNewDuty({...newDuty, hours: Number(e.target.value)})} />
              <button onClick={saveDuty} className="w-full bg-emerald-500 text-white p-3 rounded-xl font-black text-xs">ذخیره موظفی</button>
           </div>

           {/* تردد دستی / ویرایش */}
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-4 pb-2 border-b">
                {editMode ? <Edit2 size={18}/> : <Clock size={18}/>} 
                {editMode ? 'ویرایش تردد' : 'ثبت تردد دستی'}
              </div>
              <div className="space-y-3">
                 <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={manualLog.empId} onChange={e => setManualLog({...manualLog, empId: e.target.value})} disabled={editMode}>
                    <option value="">انتخاب کارمند...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                 </select>
                 <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold" value={manualLog.type} onChange={e => setManualLog({...manualLog, type: e.target.value as LogType})}>
                    <option value={LogType.CLOCK_IN}>ورود</option>
                    <option value={LogType.CLOCK_OUT}>خروج</option>
                    <option value={LogType.HOURLY_LEAVE_START}>شروع پاس</option>
                    <option value={LogType.HOURLY_LEAVE_END}>پایان پاس</option>
                 </select>
                 <div className="grid grid-cols-2 gap-2">
                    <input className="p-3 bg-slate-50 rounded-xl text-xs font-mono text-center" value={manualLog.date} onChange={e => setManualLog({...manualLog, date: e.target.value})} placeholder="۱۴۰۳/۰۱/۰۱" />
                    <input className="p-3 bg-slate-50 rounded-xl text-xs font-mono text-center" value={manualLog.time} onChange={e => setManualLog({...manualLog, time: e.target.value})} placeholder="۰۸:۳۰" />
                 </div>
                 <div className="flex gap-2">
                    <button onClick={submitManualLog} className="flex-1 bg-indigo-600 text-white p-3 rounded-xl font-black text-xs">{editMode ? 'ثبت تغییرات' : 'ثبت دستی'}</button>
                    {editMode && <button onClick={() => {setEditMode(false); setEditingId(null);}} className="bg-slate-100 text-slate-400 p-3 rounded-xl"><X size={16}/></button>}
                 </div>
              </div>
           </div>
        </div>

        {/* محتوای اصلی گزارشات */}
        <div className="md:col-span-8 space-y-6">
           {/* فیلتر گزارش ریز تردد - در چاپ مخفی */}
           <section className="no-print bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-6"><Calendar size={18}/> فیلتر گزارش هوشمند</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                 <input className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-center text-xs" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} placeholder="از تاریخ" />
                 <input className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-center text-xs" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} placeholder="تا تاریخ" />
                 <select className="p-3 bg-slate-50 rounded-xl text-xs font-bold border border-slate-100" value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
                    <option value="all">همه پرسنل</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                 </select>
              </div>
              <button onClick={getCustomReport} className="w-full bg-indigo-600 text-white p-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-50"><FileText size={16}/> دریافت گزارش ریز تردد</button>
           </section>

           {/* لیست ریز ترددها */}
           {reportLogs.length > 0 && (
             <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 printable-area">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                   <h3 className="font-black text-slate-700">گزارش ریز تردد (از {dateRange.from} تا {dateRange.to})</h3>
                </div>
                <table className="w-full text-right text-[10px]">
                   <thead className="bg-slate-50">
                      <tr>
                         <th className="p-3">نام</th>
                         <th className="p-3">تاریخ</th>
                         <th className="p-3">ساعت</th>
                         <th className="p-3">نوع</th>
                         <th className="p-3 no-print">عملیات</th>
                      </tr>
                   </thead>
                   <tbody>
                      {reportLogs.map((log, i) => (
                        <tr key={i} className="border-t border-slate-50">
                           <td className="p-3 font-black">{log.employees?.name}</td>
                           <td className="p-3 font-mono">{log.shamsi_date}</td>
                           <td className="p-3 font-mono text-emerald-600">{log.time}</td>
                           <td className="p-3 flex items-center gap-1">
                              {log.type}
                              {log.is_manual && <span className="text-[8px] bg-amber-100 text-amber-600 px-1 rounded">دستی</span>}
                              {log.is_edited && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1 rounded">اصلاح</span>}
                           </td>
                           <td className="p-3 no-print space-x-2 space-x-reverse">
                              <button onClick={() => {
                                setEditMode(true);
                                setEditingId(log.id);
                                setManualLog({empId: log.employee_id, type: log.type, date: log.shamsi_date, time: log.time});
                              }} className="text-indigo-400 hover:text-indigo-600"><Edit2 size={14}/></button>
                              <button onClick={() => deleteLog(log.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={14}/></button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           )}

           {/* گزارش تجمیعی */}
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 printable-area">
              <h3 className="font-black text-slate-700 mb-6 border-b pb-4">خلاصه کارکرد پرسنل</h3>
              <div className="overflow-x-auto">
                 <table className="w-full text-right text-[10px]">
                    <thead>
                       <tr className="text-slate-400 border-b">
                          <th className="p-4">نام</th>
                          <th className="p-4">کل کارکرد</th>
                          <th className="p-4">اضافه‌کار</th>
                          <th className="p-4">کسر کار</th>
                       </tr>
                    </thead>
                    <tbody>
                       {employees.map((emp, i) => {
                         const res = results[emp.id!];
                         return (
                           <tr key={i} className="border-b hover:bg-slate-50">
                              <td className="p-4 font-black">{emp.name}</td>
                              <td className="p-4 text-emerald-600 font-bold">{res?.formattedTotal || '۰'}</td>
                              <td className="p-4 text-indigo-600 font-bold">{res?.formattedOvertime || '۰'}</td>
                              <td className="p-4 text-rose-600 font-bold">{res?.formattedDeficit || '۰'}</td>
                           </tr>
                         );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .printable-area { border: none !important; shadow: none !important; margin: 0 !important; width: 100% !important; }
          table { font-size: 12px !important; }
        }
      `}</style>
    </div>
  );
};

export default AdminPanel;
