
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './calculations';
import { RefreshCcw, ShieldAlert, Check, X, Trash2, Settings, FileText, UserCheck, Download, Clock, Edit2, Printer, Plus, Calendar as CalendarIcon, ChevronRight, ChevronLeft } from 'lucide-react';
import { CalculationResult, EmployeeData, AttendanceLog, LogType, LeaveRequest, MonthlyDuty } from './types';
import { getShamsiDate, getShamsiTime, toEnglishDigits, shamsiMonthNames, getDaysInShamsiMonth } from './jalali';

// کامپوننت انتخاب تاریخ شمسی اصلاح شده
const ShamsiDatePicker = ({ value, onChange, label }: { value: string, onChange: (val: string) => void, label: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const cleanValue = toEnglishDigits(value);
  const parts = cleanValue.split('/');
  
  const [viewDate, setViewDate] = useState({
    year: parseInt(parts[0]) || 1403,
    month: parseInt(parts[1]) || 1
  });

  const handleSelectDay = (day: number) => {
    const formattedDate = `${viewDate.year}/${String(viewDate.month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
    onChange(formattedDate);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = getDaysInShamsiMonth(viewDate.year, viewDate.month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="space-y-1">
        <label className="text-[10px] font-black text-slate-400 mr-1">{label}</label>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-center text-xs cursor-pointer hover:border-emerald-300 transition-all flex items-center justify-center gap-2 text-slate-700 shadow-sm"
        >
          <CalendarIcon size={14} className="text-emerald-500"/>
          {value}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-[999] top-full mt-2 left-0 right-0 bg-white shadow-2xl rounded-3xl border border-slate-100 p-4 min-w-[260px]">
          <div className="flex justify-between items-center mb-4 bg-slate-50 p-2 rounded-2xl">
            <button onClick={() => setViewDate(prev => prev.month === 12 ? {year: prev.year+1, month: 1} : {...prev, month: prev.month+1})} className="p-1 hover:bg-white rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"><ChevronRight size={18}/></button>
            <div className="text-[11px] font-black text-slate-800">
              {shamsiMonthNames[viewDate.month - 1]} {viewDate.year}
            </div>
            <button onClick={() => setViewDate(prev => prev.month === 1 ? {year: prev.year-1, month: 12} : {...prev, month: prev.month-1})} className="p-1 hover:bg-white rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"><ChevronLeft size={18}/></button>
          </div>
          
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(wd => (
              <div key={wd} className="text-[9px] font-black text-slate-300 text-center py-1">{wd}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map(d => {
              const dateStr = `${viewDate.year}/${String(viewDate.month).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
              const isSelected = cleanValue === dateStr;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleSelectDay(d)}
                  className={`aspect-square flex items-center justify-center text-[10px] font-bold rounded-xl transition-all ${
                    isSelected
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100'
                    : 'hover:bg-emerald-50 text-slate-600'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [dutyQuery, setDutyQuery] = useState({ year: 1403, month: '01' });
  const [currentMonthlyDuty, setCurrentMonthlyDuty] = useState(192);

  const [dateRange, setDateRange] = useState({ from: getShamsiDate(), to: getShamsiDate() });
  const [reportLogs, setReportLogs] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('all');

  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualLog, setManualLog] = useState({ empId: '', type: LogType.CLOCK_IN, date: getShamsiDate(), time: getShamsiTime() });

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: empData } = await supabase.from('employees').select('*');
      const { data: duties } = await supabase.from('monthly_duties').select('*');

      if (!empData) return;
      const formatted: EmployeeData[] = empData.map(e => ({ id: e.id, name: e.name, nationalId: e.national_id, password: e.password, logs: [] }));
      setEmployees(formatted);
      
      const todayDate = getShamsiDate().split('/');
      const thisMonthDuty = duties?.find(d => d.year === parseInt(todayDate[0]) && d.month === todayDate[1])?.hours || 192;
      setCurrentMonthlyDuty(thisMonthDuty);

      const newResults: Record<string, CalculationResult> = {};
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
          newResults[emp.id!] = calculateWorkDetails(attendanceLogs, thisMonthDuty);
        }
      }
      setResults(newResults);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const submitManualLog = async () => {
    if (!manualLog.empId) return alert('لطفاً کارمند را انتخاب کنید');
    setLoading(true);
    const cleanDate = toEnglishDigits(manualLog.date);
    const cleanTime = toEnglishDigits(manualLog.time);
    
    try {
      if (editMode && editingId) {
        await supabase.from('attendance_logs').update({
          type: manualLog.type,
          shamsi_date: cleanDate,
          time: cleanTime,
          is_edited: true
        }).eq('id', editingId);
        alert('✅ تردد ویرایش شد');
      } else {
        await supabase.from('attendance_logs').insert([{
          employee_id: manualLog.empId,
          type: manualLog.type,
          shamsi_date: cleanDate,
          time: cleanTime,
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
      const { error } = await supabase.from('monthly_duties').upsert([{ 
        year: dutyQuery.year, 
        month: dutyQuery.month, 
        hours: currentMonthlyDuty 
      }]);
      if (error) throw error;
      alert('موظفی با موفقیت بروزرسانی شد');
      fetchAllData();
    } catch (e) { alert('خطا در ثبت موظفی'); }
  };

  const getCustomReport = async () => {
    setLoading(true);
    try {
      let query = supabase.from('attendance_logs')
        .select('*, employees(name)')
        .gte('shamsi_date', toEnglishDigits(dateRange.from))
        .lte('shamsi_date', toEnglishDigits(dateRange.to))
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
      <header className="no-print flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><Settings size={20}/></div>
          <h2 className="text-xl font-black text-slate-800">پیشخوان مدیریت</h2>
        </div>
        <div className="flex gap-2">
           <button onClick={handlePrint} className="bg-slate-800 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-black text-xs hover:bg-black transition-all shadow-lg shadow-slate-100"><Printer size={16}/> چاپ گزارش</button>
           <button onClick={fetchAllData} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-black text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /> بروزرسانی
           </button>
        </div>
      </header>

      <div className="grid md:grid-cols-12 gap-8">
        <div className="md:col-span-4 space-y-6 no-print">
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-4 pb-2 border-b"><Plus size={18}/> تنظیم موظفی ماهانه</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                 <div className="space-y-1">
                   <label className="text-[9px] font-bold text-slate-400 mr-1">سال</label>
                   <input type="number" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-mono text-center" value={dutyQuery.year} onChange={e => setDutyQuery({...dutyQuery, year: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[9px] font-bold text-slate-400 mr-1">ماه</label>
                   <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold" value={dutyQuery.month} onChange={e => setDutyQuery({...dutyQuery, month: e.target.value})}>
                      {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                 </div>
              </div>
              <div className="space-y-1 mb-4">
                 <label className="text-[9px] font-bold text-slate-400 mr-1">ساعت موظفی</label>
                 <input type="number" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-mono text-center text-emerald-600 font-black" value={currentMonthlyDuty} onChange={e => setCurrentMonthlyDuty(Number(e.target.value))} />
              </div>
              <button onClick={saveDuty} className="w-full bg-indigo-600 text-white p-3 rounded-xl font-black text-xs shadow-lg shadow-indigo-50">ذخیره تنظیمات موظفی</button>
           </div>

           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-4 pb-2 border-b">
                {editMode ? <Edit2 size={18}/> : <Clock size={18}/>} 
                {editMode ? 'ویرایش اطلاعات تردد' : 'ثبت تردد دستی / فراموشی'}
              </div>
              <div className="space-y-3">
                 <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-slate-100" value={manualLog.empId} onChange={e => setManualLog({...manualLog, empId: e.target.value})} disabled={editMode}>
                    <option value="">انتخاب کارمند...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                 </select>
                 <div className="grid grid-cols-2 gap-2">
                   <select className="p-3 bg-slate-50 rounded-xl text-[10px] font-bold" value={manualLog.type} onChange={e => setManualLog({...manualLog, type: e.target.value as LogType})}>
                      <option value={LogType.CLOCK_IN}>ورود</option>
                      <option value={LogType.CLOCK_OUT}>خروج</option>
                      <option value={LogType.HOURLY_LEAVE_START}>شروع پاس</option>
                      <option value={LogType.HOURLY_LEAVE_END}>پایان پاس</option>
                   </select>
                   <input className="p-3 bg-slate-50 rounded-xl text-[10px] font-mono text-center" value={manualLog.time} onChange={e => setManualLog({...manualLog, time: e.target.value})} placeholder="مثلاً ۰۸:۳۰" />
                 </div>
                 <ShamsiDatePicker label="تاریخ تردد" value={manualLog.date} onChange={val => setManualLog({...manualLog, date: val})} />
                 <div className="flex gap-2">
                    <button onClick={submitManualLog} className="flex-1 bg-emerald-600 text-white p-3 rounded-xl font-black text-xs shadow-lg shadow-emerald-50">{editMode ? 'اعمال تغییرات' : 'ثبت نهایی تردد'}</button>
                    {editMode && <button onClick={() => {setEditMode(false); setEditingId(null);}} className="bg-slate-100 text-slate-400 p-3 rounded-xl"><X size={16}/></button>}
                 </div>
              </div>
           </div>
        </div>

        <div className="md:col-span-8 space-y-6">
           <section className="no-print bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-6"><CalendarIcon size={18}/> فیلتر و جستجوی هوشمند</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                 <ShamsiDatePicker label="از تاریخ" value={dateRange.from} onChange={val => setDateRange({...dateRange, from: val})} />
                 <ShamsiDatePicker label="تا تاریخ" value={dateRange.to} onChange={val => setDateRange({...dateRange, to: val})} />
                 <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 mr-1">کارمند</label>
                   <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold border border-slate-100" value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
                      <option value="all">همه پرسنل</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                   </select>
                 </div>
              </div>
              <button onClick={getCustomReport} className="w-full bg-indigo-600 text-white p-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"><FileText size={16}/> مشاهده لیست دقیق ترددها</button>
           </section>

           {reportLogs.length > 0 && (
             <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 printable-area overflow-hidden">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                   <div>
                     <h3 className="font-black text-slate-700 text-sm">گزارش تفصیلی تردد پرسنل</h3>
                     <p className="text-[10px] text-slate-400 mt-1">بازه: {dateRange.from} تا {dateRange.to}</p>
                   </div>
                   <div className="text-left no-print">
                      <span className="text-[9px] font-bold text-slate-400">تعداد ردیف: {reportLogs.length}</span>
                   </div>
                </div>
                <table className="w-full text-right text-[10px]">
                   <thead className="bg-slate-50">
                      <tr>
                         <th className="p-4 rounded-r-xl">نام کارمند</th>
                         <th className="p-4">تاریخ</th>
                         <th className="p-4">ساعت</th>
                         <th className="p-4">نوع عملیات</th>
                         <th className="p-4 no-print rounded-l-xl">عملیات</th>
                      </tr>
                   </thead>
                   <tbody>
                      {reportLogs.map((log, i) => (
                        <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                           <td className="p-4 font-black text-slate-700">{log.employees?.name}</td>
                           <td className="p-4 font-mono text-slate-500">{log.shamsi_date}</td>
                           <td className="p-4 font-mono text-emerald-600 font-bold">{log.time}</td>
                           <td className="p-4">
                              <div className="flex items-center gap-1">
                                <span className={`px-2 py-1 rounded-lg font-black text-[8px] ${log.type === LogType.CLOCK_IN ? 'bg-emerald-50 text-emerald-600' : log.type === LogType.CLOCK_OUT ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{log.type}</span>
                                {log.is_manual && <span className="text-[7px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">دستی</span>}
                                {log.is_edited && <span className="text-[7px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full">اصلاح</span>}
                              </div>
                           </td>
                           <td className="p-4 no-print">
                              <div className="flex gap-2">
                                <button onClick={() => {
                                  setEditMode(true);
                                  setEditingId(log.id);
                                  setManualLog({empId: log.employee_id, type: log.type, date: log.shamsi_date, time: log.time});
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }} className="p-2 text-indigo-400 hover:bg-indigo-50 rounded-lg transition-all"><Edit2 size={14}/></button>
                                <button onClick={() => deleteLog(log.id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14}/></button>
                              </div>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           )}

           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 printable-area">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="font-black text-slate-700 text-sm">خلاصه وضعیت کارکرد کل پرسنل</h3>
                <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full">موظفی در نظر گرفته شده: {currentMonthlyDuty} ساعت</span>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-right text-[10px]">
                    <thead>
                       <tr className="text-slate-400 border-b">
                          <th className="p-4">نام و نام خانوادگی</th>
                          <th className="p-4">مجموع حضور</th>
                          <th className="p-4">اضافه‌کار</th>
                          <th className="p-4">کسر کار</th>
                          <th className="p-4">مرخصی ساعتی</th>
                       </tr>
                    </thead>
                    <tbody>
                       {employees.map((emp, i) => {
                         const res = results[emp.id!];
                         return (
                           <tr key={i} className="border-b hover:bg-slate-50 transition-colors">
                              <td className="p-4 font-black text-slate-700">{emp.name}</td>
                              <td className="p-4 text-emerald-600 font-bold">{res?.formattedTotal || '۰'}</td>
                              <td className="p-4 text-indigo-600 font-bold">{res?.formattedOvertime || '۰'}</td>
                              <td className="p-4 text-rose-600 font-bold">{res?.formattedDeficit || '۰'}</td>
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

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .printable-area { border: 1px solid #e2e8f0 !important; box-shadow: none !important; margin: 0 !important; width: 100% !important; border-radius: 0 !important; }
          table { font-size: 11px !important; }
          .max-w-7xl { max-width: 100% !important; width: 100% !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default AdminPanel;
