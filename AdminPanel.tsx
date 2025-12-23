
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './calculations';
import { RefreshCcw, ShieldAlert, Check, X, Trash2, Settings, FileText, UserCheck, Download, Clock, Edit2, Printer, Plus, Calendar as CalendarIcon, ChevronRight, ChevronLeft, Monitor, Users, Briefcase } from 'lucide-react';
import { CalculationResult, EmployeeData, AttendanceLog, LogType, LeaveRequest, MonthlyDuty } from './types';
import { getShamsiDate, getShamsiTime, toEnglishDigits, shamsiMonthNames, getDaysInShamsiMonth } from './jalali';

const ShamsiDatePicker = ({ value, onChange, label }: { value: string, onChange: (val: string) => void, label: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanValue = toEnglishDigits(value);
  const parts = cleanValue.split('/');
  const [viewDate, setViewDate] = useState({ year: parseInt(parts[0]) || 1403, month: parseInt(parts[1]) || 1 });
  const handleSelectDay = (day: number) => {
    onChange(`${viewDate.year}/${String(viewDate.month).padStart(2, '0')}/${String(day).padStart(2, '0')}`);
    setIsOpen(false);
  };
  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  const days = Array.from({ length: getDaysInShamsiMonth(viewDate.year, viewDate.month) }, (_, i) => i + 1);
  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="text-[10px] font-black text-slate-400 mr-1">{label}</label>
      <div onClick={() => setIsOpen(!isOpen)} className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-center text-xs cursor-pointer hover:border-emerald-300 flex items-center justify-center gap-2 shadow-sm">
        <CalendarIcon size={14} className="text-emerald-500"/> {value}
      </div>
      {isOpen && (
        <div className="absolute z-[999] top-full mt-2 left-0 right-0 bg-white shadow-2xl rounded-3xl border border-slate-100 p-4 min-w-[260px]">
          <div className="flex justify-between items-center mb-4 bg-slate-50 p-2 rounded-2xl">
            <button onClick={() => setViewDate(p => p.month === 12 ? {year:p.year+1, month:1} : {...p, month:p.month+1})}><ChevronRight size={18}/></button>
            <div className="text-[11px] font-black">{shamsiMonthNames[viewDate.month - 1]} {viewDate.year}</div>
            <button onClick={() => setViewDate(p => p.month === 1 ? {year:p.year-1, month:12} : {...p, month:p.month-1})}><ChevronLeft size={18}/></button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(d => (
              <button key={d} onClick={() => handleSelectDay(d)} className={`aspect-square flex items-center justify-center text-[10px] font-bold rounded-xl ${cleanValue === `${viewDate.year}/${String(viewDate.month).padStart(2, '0')}/${String(d).padStart(2, '0')}` ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-50'}`}>{d}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'USERS' | 'REQUESTS'>('REPORTS');
  
  const [dutyQuery, setDutyQuery] = useState({ year: 1403, month: '01' });
  const [currentMonthlyDuty, setCurrentMonthlyDuty] = useState(192);
  const [dateRange, setDateRange] = useState({ from: getShamsiDate(), to: getShamsiDate() });
  const [reportLogs, setReportLogs] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('all');
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualLog, setManualLog] = useState({ empId: '', type: LogType.CLOCK_IN, date: getShamsiDate(), time: getShamsiTime(), leaveType: 'HOURLY_PASS' as any });

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data: emps } = await supabase.from('employees').select('*');
      const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name)');
      const { data: duties } = await supabase.from('monthly_duties').select('*');

      if (emps) setEmployees(emps.map(e => ({ ...e, nationalId: e.national_id, logs: [] })));
      if (reqs) setRequests(reqs);

      const d = getShamsiDate().split('/');
      const thisDuty = duties?.find(dt => dt.year === parseInt(d[0]) && dt.month === d[1])?.hours || 192;
      setCurrentMonthlyDuty(thisDuty);

      const newRes: any = {};
      if (emps) {
        for (const e of emps) {
          const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', e.id);
          const empReqs = reqs?.filter(r => r.employee_id === e.id) || [];
          newRes[e.id] = calculateWorkDetails(logs?.map(l => ({ ...l, shamsiDate: l.shamsi_date })) || [], thisDuty, empReqs);
        }
      }
      setResults(newRes);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const deleteEmployee = async (id: string) => {
    if (!window.confirm('آیا از حذف این کاربر و تمامی اطلاعات او مطمئن هستید؟')) return;
    await supabase.from('employees').delete().eq('id', id);
    fetchAllData();
  };

  const updateRequestStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await supabase.from('leave_requests').update({ status }).eq('id', id);
    fetchAllData();
  };

  const saveDuty = async () => {
    try {
      // استفاده از upsert هوشمند بر اساس سال و ماه
      const { data: existing } = await supabase.from('monthly_duties').select('id').eq('year', dutyQuery.year).eq('month', dutyQuery.month).single();
      
      const payload = { year: dutyQuery.year, month: dutyQuery.month, hours: currentMonthlyDuty };
      if (existing) {
        await supabase.from('monthly_duties').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('monthly_duties').insert([payload]);
      }
      alert('✅ موظفی ماهانه با موفقیت ثبت شد.');
      fetchAllData();
    } catch (e) { alert('خطا در ثبت موظفی'); }
  };

  const submitManualLog = async () => {
    if (!manualLog.empId) return alert('کارمند انتخاب نشده');
    setLoading(true);
    try {
      if (manualLog.type === 'DAILY_LEAVE' as any) {
        await supabase.from('leave_requests').insert([{ employee_id: manualLog.empId, type: 'DAILY_LEAVE', amount: 1, shamsi_date: toEnglishDigits(manualLog.date), status: 'APPROVED', timestamp: Date.now() }]);
      } else {
        const logData = { employee_id: manualLog.empId, type: manualLog.type, shamsi_date: toEnglishDigits(manualLog.date), time: toEnglishDigits(manualLog.time), timestamp: Date.now(), is_manual: true };
        if (editMode) await supabase.from('attendance_logs').update(logData).eq('id', editingId);
        else await supabase.from('attendance_logs').insert([logData]);
      }
      setEditMode(false);
      fetchAllData();
    } catch (e) { alert('خطا'); }
    setLoading(false);
  };

  const getCustomReport = async () => {
    setLoading(true);
    let q = supabase.from('attendance_logs').select('*, employees(name)').gte('shamsi_date', toEnglishDigits(dateRange.from)).lte('shamsi_date', toEnglishDigits(dateRange.to));
    if (selectedEmpId !== 'all') q = q.eq('employee_id', selectedEmpId);
    const { data } = await q.order('shamsi_date', { ascending: true });
    if (data) setReportLogs(data);
    setLoading(false);
  };

  useEffect(() => { if (adminAuth) fetchAllData(); }, [adminAuth]);

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
        <ShieldAlert size={48} className="mx-auto text-emerald-500 mb-6" />
        <h2 className="text-2xl font-black mb-8">ورود به مدیریت</h2>
        <input type="password" placeholder="رمز عبور" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none text-center font-black mb-4" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('غلط')} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black">ورود</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <nav className="no-print flex gap-2 bg-white p-2 rounded-3xl shadow-sm border border-slate-100 w-fit mx-auto">
        <TabBtn active={activeTab === 'REPORTS'} label="گزارشات و محاسبات" icon={<FileText size={16}/>} onClick={() => setActiveTab('REPORTS')} />
        <TabBtn active={activeTab === 'REQUESTS'} label="درخواست‌های دورکاری" icon={<Monitor size={16}/>} onClick={() => setActiveTab('REQUESTS')} />
        <TabBtn active={activeTab === 'USERS'} label="مدیریت کارکنان" icon={<Users size={16}/>} onClick={() => setActiveTab('USERS')} />
      </nav>

      {activeTab === 'REPORTS' && (
        <div className="grid md:grid-cols-12 gap-6">
          <div className="md:col-span-4 space-y-6 no-print">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black mb-4 pb-2 border-b"><Settings size={18}/> تنظیم موظفی</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <input type="number" className="p-3 bg-slate-50 rounded-xl text-center" value={dutyQuery.year} onChange={e => setDutyQuery({...dutyQuery, year: Number(e.target.value)})} />
                <select className="p-3 bg-slate-50 rounded-xl" value={dutyQuery.month} onChange={e => setDutyQuery({...dutyQuery, month: e.target.value})}>
                  {shamsiMonthNames.map((m, i) => <option key={i} value={String(i+1).padStart(2, '0')}>{m}</option>)}
                </select>
              </div>
              <input type="number" className="w-full p-3 bg-slate-50 rounded-xl text-center font-black text-emerald-600 mb-4" value={currentMonthlyDuty} onChange={e => setCurrentMonthlyDuty(Number(e.target.value))} />
              <button onClick={saveDuty} className="w-full bg-indigo-600 text-white p-3 rounded-xl font-black text-xs">ثبت موظفی ماهانه</button>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black mb-4 pb-2 border-b"><Plus size={18}/> ثبت دستی تردد / مرخصی</div>
              <select className="w-full p-3 bg-slate-50 rounded-xl mb-3 text-xs font-bold" value={manualLog.empId} onChange={e => setManualLog({...manualLog, empId: e.target.value})}>
                <option value="">انتخاب کارمند</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <select className="p-3 bg-slate-50 rounded-xl text-[10px]" value={manualLog.type} onChange={e => setManualLog({...manualLog, type: e.target.value as any})}>
                  <option value={LogType.CLOCK_IN}>ورود</option>
                  <option value={LogType.CLOCK_OUT}>خروج</option>
                  <option value="DAILY_LEAVE">مرخصی روزانه</option>
                </select>
                <input className="p-3 bg-slate-50 rounded-xl text-center font-mono" placeholder="ساعت" value={manualLog.time} onChange={e => setManualLog({...manualLog, time: e.target.value})} />
              </div>
              <ShamsiDatePicker label="تاریخ" value={manualLog.date} onChange={v => setManualLog({...manualLog, date: v})} />
              <button onClick={submitManualLog} className="w-full bg-emerald-600 text-white p-3 rounded-xl font-black text-xs mt-4">ثبت نهایی</button>
            </div>
          </div>

          <div className="md:col-span-8 space-y-6">
            <section className="no-print bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <ShamsiDatePicker label="از" value={dateRange.from} onChange={v => setDateRange({...dateRange, from: v})} />
                <ShamsiDatePicker label="تا" value={dateRange.to} onChange={v => setDateRange({...dateRange, to: v})} />
                <select className="mt-5 p-3 bg-slate-50 rounded-xl" value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
                  <option value="all">همه</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <button onClick={getCustomReport} className="w-full bg-indigo-600 text-white p-4 rounded-xl font-black">مشاهده گزارش</button>
            </section>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 printable-area overflow-hidden">
              <h3 className="font-black mb-4">خلاصه وضعیت کارکرد کل (تعدیل شده)</h3>
              <table className="w-full text-right text-[10px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-4 rounded-r-2xl">نام</th>
                    <th className="p-4">حضور+دورکاری</th>
                    <th className="p-4">دورکاری</th>
                    <th className="p-4">مرخصی روزانه</th>
                    <th className="p-4">اضافه‌کار</th>
                    <th className="p-4 rounded-l-2xl">کسر کار</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, i) => {
                    const res = results[emp.id!];
                    return (
                      <tr key={i} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                        <td className="p-4 font-black">{emp.name}</td>
                        <td className="p-4 text-emerald-600 font-bold">{res?.formattedTotal || '0'}</td>
                        <td className="p-4 text-indigo-500 font-bold">{res?.formattedRemote || '0'}</td>
                        <td className="p-4 text-amber-600 font-bold">{res?.dailyLeaveDays || '0'} روز</td>
                        <td className="p-4 text-indigo-600 font-black">{res?.formattedOvertime || '0'}</td>
                        <td className={`p-4 font-black ${res?.deficitMinutes > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {res?.formattedDeficit || '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'REQUESTS' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
           <h3 className="text-lg font-black mb-6">درخواست‌های دورکاری و مرخصی</h3>
           <div className="space-y-4">
              {requests.filter(r => r.status === 'PENDING').length === 0 && <p className="text-center text-slate-400">درخواست جدیدی وجود ندارد.</p>}
              {requests.filter(r => r.status === 'PENDING').map((req, i) => (
                <div key={i} className="flex flex-col md:flex-row items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 gap-4">
                   <div className="flex items-center gap-4">
                      <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl"><Monitor size={20}/></div>
                      <div>
                        <p className="font-black text-slate-800">{req.employees?.name} <span className="text-[10px] text-slate-400">({req.type === 'REMOTE_WORK' ? 'دورکاری' : 'مرخصی'})</span></p>
                        <p className="text-xs text-slate-500">تاریخ: {req.shamsi_date} | مقدار: {req.amount} ساعت</p>
                        <p className="text-[10px] text-slate-400 mt-1 italic">"{req.description}"</p>
                      </div>
                   </div>
                   <div className="flex gap-2 w-full md:w-auto">
                      <button onClick={() => updateRequestStatus(req.id, 'APPROVED')} className="flex-1 md:flex-none bg-emerald-500 text-white px-6 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2"><Check size={16}/> تایید</button>
                      <button onClick={() => updateRequestStatus(req.id, 'REJECTED')} className="flex-1 md:flex-none bg-rose-500 text-white px-6 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2"><X size={16}/> رد درخواست</button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'USERS' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
           <h3 className="text-lg font-black mb-6">مدیریت کارکنان</h3>
           <div className="grid md:grid-cols-2 gap-4">
              {employees.map((emp, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-black">{emp.name[0]}</div>
                      <div><p className="font-black text-xs">{emp.name}</p><p className="text-[9px] text-slate-400 font-mono">{emp.nationalId}</p></div>
                   </div>
                   <button onClick={() => deleteEmployee(emp.id!)} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs transition-all ${active ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
    {icon} {label}
  </button>
);

export default AdminPanel;
