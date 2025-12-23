
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './calculations';
import { EmployeeData, AttendanceLog, LogType, LeaveRequest, CalculationResult, OfficialHoliday } from './types';
import { getShamsiDate, toEnglishDigits, shamsiMonthNames } from './jalali';
import { ShieldAlert, Users, FileText, Settings, Check, X, Trash2, Printer, Download, Plus, Calendar, Monitor, Menu, Briefcase, RefreshCcw, LayoutGrid, ClipboardCheck, Clock, Circle, Activity, Search } from 'lucide-react';

type AdminMenu = 'REPORTS' | 'REQUESTS' | 'USERS' | 'SETTINGS' | 'LIVE';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<OfficialHoliday[]>([]);
  const [results, setResults] = useState<Record<string, CalculationResult>>({});
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('LIVE');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Settings states
  const [dutyConfig, setDutyConfig] = useState({ year: 1403, month: '01', hours: 192 });
  const [newHoliday, setNewHoliday] = useState({ date: '', title: '' });

  // Report filters
  const [dateRange, setDateRange] = useState({ from: getShamsiDate(), to: getShamsiDate() });
  const [selectedEmp, setSelectedEmp] = useState('all');

  // Live status data
  const [liveStatus, setLiveStatus] = useState<any[]>([]);

  const fetchBaseData = async () => {
    setLoading(true);
    const today = getShamsiDate();
    const { data: emps } = await supabase.from('employees').select('*');
    const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name)');
    const { data: hols } = await supabase.from('official_holidays').select('*');
    const { data: duties } = await supabase.from('monthly_duties').select('*');
    const { data: allTodayLogs } = await supabase.from('attendance_logs').select('*').eq('shamsi_date', today);

    if (emps) {
      setEmployees(emps.map(e => ({ ...e, nationalId: e.national_id, logs: [] })));
      
      // Calculate Live Status for each employee
      const statusMap = emps.map(emp => {
        const empLogs = allTodayLogs?.filter(l => l.employee_id === emp.id).sort((a, b) => b.timestamp - a.timestamp) || [];
        const lastLog = empLogs[0];
        let status: 'PRESENT' | 'AWAY' | 'NOT_STARTED' = 'NOT_STARTED';
        let time = '--:--';
        let duration = '';

        if (lastLog) {
          time = lastLog.time;
          if (lastLog.type === LogType.CLOCK_IN || lastLog.type === LogType.HOURLY_LEAVE_END) {
            status = 'PRESENT';
            const diffMs = Date.now() - lastLog.timestamp;
            const hours = Math.floor(diffMs / 3600000);
            const mins = Math.floor((diffMs % 3600000) / 60000);
            duration = `${hours}h ${mins}m`;
          } else {
            status = 'AWAY';
          }
        }
        return { ...emp, status, lastTime: time, duration };
      });
      setLiveStatus(statusMap);
    }

    if (reqs) setRequests(reqs);
    if (hols) setHolidays(hols);

    const newResults: any = {};
    if (emps) {
      for (const emp of emps) {
        let q = supabase.from('attendance_logs').select('*').eq('employee_id', emp.id);
        if (activeMenu === 'REPORTS') {
          q = q.gte('shamsi_date', toEnglishDigits(dateRange.from)).lte('shamsi_date', toEnglishDigits(dateRange.to));
        }
        const { data: logs } = await q;
        const empReqs = reqs?.filter(r => r.employee_id === emp.id) || [];
        const mDuty = duties?.find(d => d.month === dutyConfig.month)?.hours || dutyConfig.hours;
        newResults[emp.id] = calculateWorkDetails(logs?.map(l => ({ ...l, shamsiDate: l.shamsi_date })) || [], mDuty, empReqs);
      }
    }
    setResults(newResults);
    setLoading(false);
  };

  useEffect(() => { if (adminAuth) fetchBaseData(); }, [adminAuth, dutyConfig.month, dateRange.from, dateRange.to, activeMenu]);

  const updateRequest = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await supabase.from('leave_requests').update({ status }).eq('id', id);
    fetchBaseData();
  };

  const handleHolidayAdd = async () => {
    if (!newHoliday.date) return;
    await supabase.from('official_holidays').insert([{ shamsi_date: toEnglishDigits(newHoliday.date), title: newHoliday.title }]);
    fetchBaseData();
    setNewHoliday({ date: '', title: '' });
  };

  const deleteHoliday = async (id: string) => {
    if (confirm('حذف تعطیلی؟')) {
      await supabase.from('official_holidays').delete().eq('id', id);
      fetchBaseData();
    }
  };

  const exportToExcel = () => {
    let csv = "\ufeffنام کارمند,کارکرد خالص,پاس ساعتی,مرخصی روزانه,اضافه کار,کسر کار\n";
    employees.forEach(e => {
      const r = results[e.id!];
      csv += `${e.name},${r.formattedTotalWork},${Math.floor(r.totalPassMinutes)}m,${r.totalDailyLeaveDays},${r.formattedOvertime},${r.formattedDeficit}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BaharTime_Report_${getShamsiDate()}.csv`;
    link.click();
  };

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 p-12 bg-white rounded-[3rem] shadow-2xl border border-slate-100 text-center">
        <div className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <ShieldAlert size={40} className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-black mb-8 text-slate-800">احراز هویت مدیر</h2>
        <input type="password" placeholder="گذرواژه امنیتی" className="w-full p-5 rounded-2xl bg-slate-50 border outline-none text-center font-black mb-6 focus:ring-2 focus:ring-emerald-500 transition-all" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && password === 'admin123' && setAdminAuth(true)} />
        <button onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('رمز عبور نادرست است')} className="w-full bg-emerald-600 text-white p-5 rounded-2xl font-black hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-100">ورود به مدیریت</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen -m-8">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-full lg:w-72' : 'w-20'} bg-white border-l border-slate-100 p-6 transition-all duration-300 flex flex-col no-print`}>
        <div className="flex items-center justify-between mb-10 px-2">
          {sidebarOpen && <div className="font-black text-emerald-600 text-xl tracking-tighter">Bahar Management</div>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-emerald-600 transition-colors">
            <Menu size={20}/>
          </button>
        </div>

        <nav className="space-y-2 flex-1">
          <MenuBtn active={activeMenu === 'LIVE'} label="وضعیت آنی (Live)" icon={<Activity size={20}/>} collapsed={!sidebarOpen} onClick={() => setActiveMenu('LIVE')} />
          <MenuBtn active={activeMenu === 'REPORTS'} label="گزارشات کارکرد" icon={<FileText size={20}/>} collapsed={!sidebarOpen} onClick={() => setActiveMenu('REPORTS')} />
          <MenuBtn active={activeMenu === 'REQUESTS'} label="تایید درخواست‌ها" icon={<ClipboardCheck size={20}/>} collapsed={!sidebarOpen} onClick={() => setActiveMenu('REQUESTS')} />
          <MenuBtn active={activeMenu === 'SETTINGS'} label="تنظیمات سیستم" icon={<Settings size={20}/>} collapsed={!sidebarOpen} onClick={() => setActiveMenu('SETTINGS')} />
          <MenuBtn active={activeMenu === 'USERS'} label="مدیریت پرسنل" icon={<Users size={20}/>} collapsed={!sidebarOpen} onClick={() => setActiveMenu('USERS')} />
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-10 overflow-y-auto">
        <header className="no-print flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
           <div>
              <h2 className="text-2xl font-black text-slate-800">
                {activeMenu === 'LIVE' ? 'وضعیت لحظه‌ای پرسنل' : 
                 activeMenu === 'REPORTS' ? 'گزارش‌گیری و محاسبات' : 
                 activeMenu === 'REQUESTS' ? 'مدیریت درخواست‌ها' : 
                 activeMenu === 'SETTINGS' ? 'پیکربندی سامانه' : 'پرسنل'}
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-1">امروز {getShamsiDate()} - مدیریت هوشمند BaharTime</p>
           </div>
           <div className="flex gap-2">
              <button onClick={fetchBaseData} className="p-3 bg-white text-slate-400 rounded-2xl border border-slate-100 hover:text-emerald-600 transition-all"><RefreshCcw size={20} className={loading ? 'animate-spin' : ''}/></button>
              {activeMenu === 'REPORTS' && <button onClick={exportToExcel} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-emerald-700 transition-all"><Download size={16}/> خروجی اکسل</button>}
           </div>
        </header>

        {activeMenu === 'LIVE' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <LiveCard label="حاضر در شرکت" count={liveStatus.filter(s => s.status === 'PRESENT').length} color="text-emerald-600" bgColor="bg-emerald-50" />
              <LiveCard label="در حال استراحت/پاس" count={liveStatus.filter(s => s.status === 'AWAY').length} color="text-amber-600" bgColor="bg-amber-50" />
              <LiveCard label="هنوز وارد نشده" count={liveStatus.filter(s => s.status === 'NOT_STARTED').length} color="text-slate-400" bgColor="bg-slate-50" />
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-3"><Users size={24} className="text-emerald-600"/> لیست حضور و غیاب لحظه‌ای</h3>
                <div className="relative w-full md:w-64">
                   <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" />
                   <input className="w-full p-3 pr-12 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500" placeholder="جستجوی همکار..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-5 rounded-r-3xl text-[10px] font-black uppercase text-slate-400">نام همکار</th>
                      <th className="p-5 text-[10px] font-black uppercase text-slate-400">وضعیت فعلی</th>
                      <th className="p-5 text-[10px] font-black uppercase text-slate-400">آخرین ثبت</th>
                      <th className="p-5 text-[10px] font-black uppercase text-slate-400">مدت حضور فعلی</th>
                      <th className="p-5 rounded-l-3xl text-[10px] font-black uppercase text-slate-400">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {liveStatus
                      .filter(s => s.name.includes(searchTerm))
                      .map((emp, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-all">
                        <td className="p-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-black">{emp.name[0]}</div>
                            <span className="font-black text-slate-700">{emp.name}</span>
                          </div>
                        </td>
                        <td className="p-5">
                          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black w-fit ${
                            emp.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' : 
                            emp.status === 'AWAY' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <Circle size={8} fill="currentColor" className={emp.status === 'PRESENT' ? 'animate-pulse' : ''} />
                            {emp.status === 'PRESENT' ? 'حاضر در شرکت' : emp.status === 'AWAY' ? 'پاس / خارج شده' : 'هنوز وارد نشده'}
                          </span>
                        </td>
                        <td className="p-5 font-mono font-black text-slate-600">{emp.lastTime}</td>
                        <td className="p-5 font-mono font-black text-emerald-600">{emp.duration || '--'}</td>
                        <td className="p-5">
                          <button className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all">مشاهده جزئیات</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeMenu === 'REPORTS' && (
          <div className="space-y-6">
            <div className="no-print bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">از تاریخ</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">تا تاریخ</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">فیلتر پرسنل</label>
                  <select className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none border border-slate-50 focus:ring-2 focus:ring-emerald-500" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
                     <option value="all">تمامی کارکنان</option>
                     {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 printable-area overflow-hidden">
               <table className="w-full text-right text-[11px] printable-table">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-5 rounded-r-[1.5rem] font-black">نام کارمند</th>
                      <th className="p-5 font-black">کارکرد خالص</th>
                      <th className="p-5 font-black">پاس ساعتی</th>
                      <th className="p-5 font-black">مرخصی (روز)</th>
                      <th className="p-5 font-black">اضافه کار</th>
                      <th className="p-5 rounded-l-[1.5rem] font-black">کسر کار</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employees.filter(e => selectedEmp === 'all' || e.id === selectedEmp).map((emp, i) => {
                      const res = results[emp.id!];
                      return (
                        <tr key={i} className="hover:bg-slate-50/50 transition-all">
                          <td className="p-5 font-black text-slate-700">{emp.name}</td>
                          <td className="p-5 text-emerald-600 font-black text-sm">{res?.formattedTotalWork}</td>
                          <td className="p-5 text-amber-600 font-bold">{Math.floor(res?.totalPassMinutes || 0)}m</td>
                          <td className="p-5 text-indigo-500 font-black">{res?.totalDailyLeaveDays}</td>
                          <td className="p-5 text-indigo-800 font-black text-sm">{res?.formattedOvertime}</td>
                          <td className={`p-5 font-black text-sm ${res?.deficitMinutes > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                            {res?.formattedDeficit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeMenu === 'REQUESTS' && (
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <h3 className="text-xl font-black mb-10 flex items-center gap-3 text-slate-800"><ClipboardCheck size={26} className="text-emerald-600"/> لیست درخواست‌های در انتظار</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {requests.filter(r => r.status === 'PENDING').map((r, i) => (
                 <div key={i} className="flex flex-col p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 hover:border-emerald-200 transition-all shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                       <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-indigo-600"><Clock size={24}/></div>
                          <div>
                             <p className="font-black text-slate-800 text-lg">{r.employees?.name}</p>
                             <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{r.type.replace(/_/g, ' ')}</p>
                          </div>
                       </div>
                       <span className="text-[10px] font-mono font-black text-slate-400">{r.shamsi_date}</span>
                    </div>
                    <div className="bg-white p-4 rounded-2xl text-xs text-slate-500 font-bold mb-6 italic min-h-[60px]">"{r.description || 'بدون توضیح'}"</div>
                    <div className="flex gap-3">
                       <button onClick={() => updateRequest(r.id, 'APPROVED')} className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-black text-xs hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"><Check size={16}/> تایید</button>
                       <button onClick={() => updateRequest(r.id, 'REJECTED')} className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-black text-xs hover:bg-rose-600 transition-all flex items-center justify-center gap-2"><X size={16}/> رد</button>
                    </div>
                 </div>
               ))}
               {requests.filter(r => r.status === 'PENDING').length === 0 && (
                 <div className="col-span-full py-20 text-center text-slate-300 font-bold italic text-lg">درخواستی برای بررسی وجود ندارد.</div>
               )}
            </div>
          </div>
        )}

        {activeMenu === 'SETTINGS' && (
          <div className="grid md:grid-cols-2 gap-8">
             <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                <h3 className="font-black mb-8 flex items-center gap-3 text-lg text-slate-800"><Briefcase size={22} className="text-indigo-600"/> تنظیمات موظفی ماهانه</h3>
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">انتخاب ماه</label>
                      <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-50" value={dutyConfig.month} onChange={e => setDutyConfig({...dutyConfig, month: e.target.value})}>
                        {shamsiMonthNames.map((m, i) => <option key={i} value={String(i+1).padStart(2, '0')}>{m}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">ساعات موظفی</label>
                      <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl text-center font-black text-2xl text-indigo-600 outline-none border border-slate-50" value={dutyConfig.hours} onChange={e => setDutyConfig({...dutyConfig, hours: Number(e.target.value)})} />
                   </div>
                   <button onClick={async () => {
                     await supabase.from('monthly_duties').upsert([{ year: 1403, month: dutyConfig.month, hours: dutyConfig.hours }]);
                     alert('تنظیمات موظفی ذخیره شد.');
                   }} className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">بروزرسانی موظفی</button>
                </div>
             </div>

             <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                <h3 className="font-black mb-8 flex items-center gap-3 text-lg text-slate-800"><Calendar size={22} className="text-rose-600"/> تقویم تعطیلات رسمی</h3>
                <div className="flex gap-3 mb-8">
                   <input className="flex-[2] p-4 bg-slate-50 rounded-2xl text-xs font-mono font-bold outline-none border border-slate-50" placeholder="۱۴۰۳/۰۱/۰۱" value={newHoliday.date} onChange={e => setNewHoliday({...newHoliday, date: e.target.value})} />
                   <input className="flex-[3] p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none border border-slate-50" placeholder="مناسبت..." value={newHoliday.title} onChange={e => setNewHoliday({...newHoliday, title: e.target.value})} />
                   <button onClick={handleHolidayAdd} className="bg-rose-500 text-white p-4 rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-100"><Plus size={24}/></button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                   {holidays.length === 0 ? (
                     <div className="text-center py-10 text-slate-300 italic text-xs">تعطیلی ثبت نشده است.</div>
                   ) : (
                     holidays.sort((a,b) => a.shamsi_date.localeCompare(b.shamsi_date)).map((h, i) => (
                       <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl text-xs font-bold hover:bg-rose-50 transition-colors">
                          <div className="flex items-center gap-3">
                             <span className="text-rose-500 font-mono tracking-tighter">{h.shamsi_date}</span>
                             <span className="text-slate-600 border-r border-slate-200 pr-3">{h.title}</span>
                          </div>
                          <button onClick={() => deleteHoliday(h.id!)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                       </div>
                     ))
                   )}
                </div>
             </div>
          </div>
        )}

        {activeMenu === 'USERS' && (
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black flex items-center gap-3 text-slate-800"><Users size={26} className="text-emerald-600"/> مدیریت بانک اطلاعات کارکنان</h3>
                <span className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full font-black text-xs">تعداد کل: {employees.length} نفر</span>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {employees.map((e, i) => (
                  <div key={i} className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex justify-between items-center hover:shadow-md transition-all group">
                     <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform">{e.name[0]}</div>
                        <div>
                           <p className="font-black text-sm text-slate-800">{e.name}</p>
                           <p className="text-[10px] text-slate-400 font-mono mt-1">{e.nationalId}</p>
                        </div>
                     </div>
                     <button onClick={async () => { if(confirm(`آیا از حذف ${e.name} اطمینان دارید؟`)) { await supabase.from('employees').delete().eq('id', e.id); fetchBaseData(); } }} className="text-slate-300 hover:text-rose-500 p-3 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .printable-table { border: 1px solid #f1f5f9 !important; font-size: 10px !important; }
          .printable-area { border: none !important; box-shadow: none !important; padding: 0 !important; }
          main { padding: 0 !important; }
          -m-8 { margin: 0 !important; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const MenuBtn = ({ active, label, icon, onClick, collapsed }: any) => (
  <button onClick={onClick} className={`flex items-center gap-4 p-4 rounded-2xl font-black text-sm transition-all group ${
    active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 scale-[1.02]' : 'text-slate-400 hover:bg-slate-50'
  } ${collapsed ? 'justify-center' : 'w-full'}`}>
    <div className={`${active ? 'text-white' : 'text-slate-300 group-hover:text-emerald-500'} transition-colors`}>{icon}</div>
    {!collapsed && <span>{label}</span>}
  </button>
);

const LiveCard = ({ label, count, color, bgColor }: any) => (
  <div className={`${bgColor} p-8 rounded-[2.5rem] border border-slate-100 flex flex-col items-center text-center shadow-sm`}>
    <span className={`text-4xl font-black ${color} mb-2`}>{count}</span>
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
  </div>
);

export default AdminPanel;
