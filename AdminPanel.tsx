
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { calculateWorkDetails } from './calculations';
import { EmployeeData, LogType, LeaveRequest } from './types';
import { getShamsiDate, toEnglishDigits, shamsiMonthNames, getDaysInShamsiMonth } from './jalali';
import { ShieldAlert, Users, FileText, Check, Trash2, Printer, Download, Calendar, Menu, RefreshCcw, Activity, Search, FileSpreadsheet, Eye, X, ChevronRight, ChevronLeft } from 'lucide-react';

type AdminMenu = 'LIVE' | 'DETAILED_REPORT' | 'MONTHLY_REPORT' | 'REQUESTS' | 'USERS';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('LIVE');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState({ from: getShamsiDate(), to: getShamsiDate() });
  const [selectedMonth, setSelectedMonth] = useState(getShamsiDate().split('/')[1]);
  const [selectedYear, setSelectedYear] = useState(getShamsiDate().split('/')[0]);

  // Data
  const [liveStatus, setLiveStatus] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);

  const fetchInitialData = async () => {
    const { data: emps } = await supabase.from('employees').select('*');
    if (emps) setEmployees(emps.map(e => ({ ...e, nationalId: e.national_id, logs: [] })));
    const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name)');
    if (reqs) setRequests(reqs);
    if (activeMenu === 'LIVE') fetchLiveStatus();
  };

  const fetchLiveStatus = async () => {
    setLoading(true);
    const today = getShamsiDate();
    const { data: allTodayLogs } = await supabase.from('attendance_logs').select('*').eq('shamsi_date', today);
    const statusMap = employees.map(emp => {
      const empLogs = allTodayLogs?.filter(l => l.employee_id === emp.id).sort((a, b) => b.timestamp - a.timestamp) || [];
      const lastLog = empLogs[0];
      let status: 'PRESENT' | 'AWAY' | 'NOT_STARTED' = 'NOT_STARTED';
      let time = '--:--';
      if (lastLog) {
        time = lastLog.time;
        status = (lastLog.type === LogType.CLOCK_IN || lastLog.type === LogType.HOURLY_LEAVE_END) ? 'PRESENT' : 'AWAY';
      }
      return { ...emp, status, lastTime: time };
    });
    setLiveStatus(statusMap);
    setLoading(false);
  };

  const generateDetailedReport = async () => {
    setLoading(true);
    const { data: rangeLogs } = await supabase.from('attendance_logs')
      .select('*')
      .gte('shamsi_date', toEnglishDigits(dateRange.from))
      .lte('shamsi_date', toEnglishDigits(dateRange.to))
      .order('timestamp', { ascending: true });
    setReportData(rangeLogs || []);
    setLoading(false);
  };

  const generateMonthlyReport = async () => {
    setLoading(true);
    const m = toEnglishDigits(selectedMonth).padStart(2, '0');
    const y = toEnglishDigits(selectedYear);
    const monthPattern = `${y}/${m}/%`;

    // Fetch logs and requests ONLY for the selected month/year
    const { data: monthLogs } = await supabase.from('attendance_logs').select('*').like('shamsi_date', monthPattern);
    const { data: monthReqs } = await supabase.from('leave_requests').select('*').eq('status', 'APPROVED').like('shamsi_date', monthPattern);

    const monthlySummary = employees.map(emp => {
      const empLogs = monthLogs?.filter(l => l.employee_id === emp.id) || [];
      const empReqs = monthReqs?.filter(r => r.employee_id === emp.id) || [];
      // Map shamsi_date to shamsiDate for calculation logic
      const mappedLogs = empLogs.map(l => ({ ...l, shamsiDate: l.shamsi_date }));
      // Set dutyHours to 0 since we only care about net work
      const calc = calculateWorkDetails(mappedLogs, 0, empReqs);
      return { ...emp, totalWork: calc.formattedTotalWork };
    });
    setReportData(monthlySummary);
    setLoading(false);
  };

  useEffect(() => { if (adminAuth) fetchInitialData(); }, [adminAuth, employees.length]);

  const updateRequest = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await supabase.from('leave_requests').update({ status }).eq('id', id);
    fetchInitialData();
  };

  const exportCSV = () => {
    let csv = "\ufeff";
    if (activeMenu === 'DETAILED_REPORT') {
      csv += "نام کارمند,تاریخ,ساعت,نوع تردد\n";
      reportData.forEach(row => {
        const empName = employees.find(e => e.id === row.employee_id)?.name || 'نامشخص';
        csv += `${empName},${row.shamsi_date},${row.time},${row.type}\n`;
      });
    } else {
      csv += "نام کارمند,کد ملی,مجموع کارکرد خالص\n";
      reportData.forEach(row => {
        csv += `${row.name},${row.nationalId},${row.totalWork}\n`;
      });
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Report_${activeMenu}_${getShamsiDate()}.csv`;
    link.click();
  };

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 p-12 bg-white rounded-[3rem] shadow-2xl border border-slate-100 text-center">
        <div className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
          <ShieldAlert size={40} className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-black mb-8 text-slate-800">ورود به مدیریت بهار</h2>
        <input type="password" placeholder="گذرواژه امنیتی" className="w-full p-5 rounded-2xl bg-slate-50 border outline-none text-center font-black mb-6 focus:ring-2 focus:ring-emerald-500 transition-all" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && password === 'admin123' && setAdminAuth(true)} />
        <button onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('رمز عبور نادرست است')} className="w-full bg-emerald-600 text-white p-5 rounded-2xl font-black hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-100">احراز هویت</button>
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
          <MenuBtn active={activeMenu === 'LIVE'} label="وضعیت لحظه‌ای" icon={<Activity size={20}/>} collapsed={!sidebarOpen} onClick={() => setActiveMenu('LIVE')} />
          <MenuBtn active={activeMenu === 'DETAILED_REPORT'} label="گزارش ریز کارکرد" icon={<FileText size={20}/>} collapsed={!sidebarOpen} onClick={() => { setActiveMenu('DETAILED_REPORT'); setReportData([]); }} />
          <MenuBtn active={activeMenu === 'MONTHLY_REPORT'} label="گزارش ماهانه" icon={<FileSpreadsheet size={20}/>} collapsed={!sidebarOpen} onClick={() => { setActiveMenu('MONTHLY_REPORT'); setReportData([]); }} />
          <MenuBtn active={activeMenu === 'REQUESTS'} label="تایید درخواست‌ها" icon={<Check size={20}/>} collapsed={!sidebarOpen} onClick={() => setActiveMenu('REQUESTS')} />
          <MenuBtn active={activeMenu === 'USERS'} label="مدیریت پرسنل" icon={<Users size={20}/>} collapsed={!sidebarOpen} onClick={() => setActiveMenu('USERS')} />
        </nav>
      </aside>

      <main className="flex-1 p-4 lg:p-10 overflow-y-auto">
        <header className="no-print flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
           <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                {activeMenu === 'LIVE' ? 'مشاهده حاضرین' : activeMenu === 'DETAILED_REPORT' ? 'ریز کارکرد پرسنل' : activeMenu === 'MONTHLY_REPORT' ? 'سرجمع کارکرد ماهانه' : activeMenu === 'REQUESTS' ? 'بررسی درخواست‌ها' : 'بانک پرسنل'}
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-1">مدیریت هوشمند بهار | {getShamsiDate()}</p>
           </div>
           {(activeMenu === 'DETAILED_REPORT' || activeMenu === 'MONTHLY_REPORT') && reportData.length > 0 && (
             <div className="flex gap-2">
                <button onClick={exportCSV} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-emerald-700 transition-all"><Download size={16}/> خروجی اکسل</button>
                {activeMenu === 'MONTHLY_REPORT' && <button onClick={() => window.print()} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all"><Printer size={16}/> چاپ لیست</button>}
             </div>
           )}
        </header>

        {activeMenu === 'LIVE' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="حاضر" count={liveStatus.filter(s => s.status === 'PRESENT').length} color="text-emerald-600" bgColor="bg-emerald-50" />
              <StatCard label="خارج شده" count={liveStatus.filter(s => s.status === 'AWAY').length} color="text-rose-600" bgColor="bg-rose-50" />
              <StatCard label="نیامده" count={liveStatus.filter(s => s.status === 'NOT_STARTED').length} color="text-slate-400" bgColor="bg-slate-50" />
            </div>
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveStatus.map((emp, i) => (
                    <div key={i} className={`p-5 rounded-[2rem] border flex items-center justify-between ${emp.status === 'PRESENT' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white ${emp.status === 'PRESENT' ? 'bg-emerald-500' : 'bg-slate-300'}`}>{emp.name[0]}</div>
                        <div className="font-black text-sm text-slate-800">{emp.name}</div>
                      </div>
                      <div className="text-left font-mono font-black text-slate-700">{emp.lastTime}</div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {activeMenu === 'DETAILED_REPORT' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 no-print">
               <div className="flex flex-col md:flex-row gap-6 items-end">
                  <div className="flex-1 space-y-2 relative">
                     <label className="text-[10px] font-black text-slate-400 uppercase mr-2">از تاریخ</label>
                     <ShamsiDatePicker value={dateRange.from} onChange={(v) => setDateRange({...dateRange, from: v})} />
                  </div>
                  <div className="flex-1 space-y-2 relative">
                     <label className="text-[10px] font-black text-slate-400 uppercase mr-2">تا تاریخ</label>
                     <ShamsiDatePicker value={dateRange.to} onChange={(v) => setDateRange({...dateRange, to: v})} />
                  </div>
                  <button onClick={generateDetailedReport} className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2">
                    {loading ? <RefreshCcw className="animate-spin" size={18}/> : <Eye size={18}/>} مشاهده گزارش
                  </button>
               </div>
            </div>
            {reportData.length > 0 && (
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-5 rounded-r-[1.5rem] font-black">نام کارمند</th>
                      <th className="p-5 font-black">تاریخ</th>
                      <th className="p-5 font-black">ساعت ثبت</th>
                      <th className="p-5 rounded-l-[1.5rem] font-black">نوع تردد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="p-5 font-black text-slate-700">{employees.find(e => e.id === row.employee_id)?.name}</td>
                        <td className="p-5 font-mono text-slate-500">{row.shamsi_date}</td>
                        <td className="p-5 font-mono font-black text-emerald-600 text-lg">{row.time}</td>
                        <td className="p-5"><span className="px-3 py-1 rounded-full bg-slate-100 text-[9px] font-black">{row.type.replace(/_/g, ' ')}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {reportData.length === 0 && !loading && <div className="text-center py-20 text-slate-300 italic">برای مشاهده لیست، تاریخ‌ها را تنظیم و روی دکمه مشاهده گزارش کلیک کنید.</div>}
          </div>
        )}

        {activeMenu === 'MONTHLY_REPORT' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 items-end no-print">
               <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mr-2">انتخاب ماه</label>
                  <select className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none border border-slate-100 focus:ring-2 focus:ring-indigo-500" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                    {shamsiMonthNames.map((m, i) => <option key={i} value={String(i+1).padStart(2, '0')}>{m}</option>)}
                  </select>
               </div>
               <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mr-2">سال</label>
                  <input className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-mono font-bold outline-none border border-slate-100 focus:ring-2 focus:ring-indigo-500" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} />
               </div>
               <button onClick={generateMonthlyReport} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2">
                  {loading ? <RefreshCcw className="animate-spin" size={18}/> : <Eye size={18}/>} نمایش کارکرد خالص
               </button>
            </div>
            {reportData.length > 0 && (
              <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 printable-area">
                <div className="hidden print:block text-center mb-10 border-b pb-6">
                   <h1 className="text-2xl font-black">گزارش سرجمع کارکرد ماهانه پرسنل</h1>
                   <p className="text-sm font-bold mt-2">ماه {shamsiMonthNames[parseInt(selectedMonth)-1]} سال {selectedYear}</p>
                </div>
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-5 rounded-r-[1.5rem] font-black">نام و نام خانوادگی</th>
                      <th className="p-5 font-black">کد ملی</th>
                      <th className="p-5 rounded-l-[1.5rem] font-black text-left">مجموع کارکرد خالص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.map((row, i) => (
                      <tr key={i}>
                        <td className="p-5 font-black text-slate-800">{row.name}</td>
                        <td className="p-5 font-mono text-slate-500">{row.nationalId}</td>
                        <td className="p-5 font-mono font-black text-emerald-600 text-lg text-left">{row.totalWork}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {reportData.length === 0 && !loading && <div className="text-center py-20 text-slate-300 italic">ماه مورد نظر را انتخاب و دکمه نمایش را فشار دهید.</div>}
          </div>
        )}

        {activeMenu === 'REQUESTS' && (
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {requests.filter(r => r.status === 'PENDING').map((r, i) => (
                 <div key={i} className="p-6 bg-slate-50 rounded-[2.5rem] border hover:border-emerald-200 transition-all">
                    <div className="flex justify-between mb-4">
                       <p className="font-black text-slate-800">{r.employees?.name}</p>
                       <span className="text-[10px] font-mono text-slate-400">{r.shamsi_date}</span>
                    </div>
                    <p className="text-[10px] font-black text-indigo-600 mb-2 uppercase">{r.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-500 italic mb-6">"{r.description || 'درخواست تردد'}"</p>
                    <div className="flex gap-2">
                       <button onClick={() => updateRequest(r.id, 'APPROVED')} className="flex-1 bg-emerald-500 text-white py-2 rounded-xl text-xs font-black shadow-lg shadow-emerald-100">تایید</button>
                       <button onClick={() => updateRequest(r.id, 'REJECTED')} className="flex-1 bg-rose-500 text-white py-2 rounded-xl text-xs font-black shadow-lg shadow-rose-100">رد</button>
                    </div>
                 </div>
               ))}
            </div>
            {requests.filter(r => r.status === 'PENDING').length === 0 && <div className="text-center py-20 text-slate-300 italic font-bold">هیچ درخواستی در صف انتظار نیست.</div>}
          </div>
        )}

        {activeMenu === 'USERS' && (
          <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {employees.map((e, i) => (
                  <div key={i} className="p-5 bg-slate-50 rounded-[2rem] border flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-black">{e.name[0]}</div>
                      <div>
                        <p className="text-sm font-black text-slate-800">{e.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{e.nationalId}</p>
                      </div>
                    </div>
                    <button onClick={async () => { if(confirm(`حذف ${e.name} از سامانه؟`)) { await supabase.from('employees').delete().eq('id', e.id); fetchInitialData(); } }} className="text-slate-300 hover:text-rose-500 transition-colors p-2"><Trash2 size={16}/></button>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>

      <style>{`
        @media print { .no-print { display: none !important; } body { background: white; margin: 0; padding: 0; } .printable-area { border: none; box-shadow: none; width: 100%; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const MenuBtn = ({ active, label, icon, onClick, collapsed }: any) => (
  <button onClick={onClick} className={`flex items-center gap-4 p-4 rounded-2xl font-black text-sm transition-all ${active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-400 hover:bg-slate-50'} ${collapsed ? 'justify-center' : 'w-full'}`}>
    {icon} {!collapsed && <span>{label}</span>}
  </button>
);

const StatCard = ({ label, count, color, bgColor }: any) => (
  <div className={`${bgColor} p-6 rounded-[2.5rem] border border-slate-100 flex flex-col items-center shadow-sm`}>
    <span className={`text-3xl font-black ${color} mb-1`}>{count}</span>
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);

const ShamsiDatePicker = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const parts = value.split('/');
  const [viewYear, setViewYear] = useState(parseInt(parts[0]));
  const [viewMonth, setViewMonth] = useState(parseInt(parts[1]));
  const selectedDay = parseInt(parts[2]);

  const daysInMonth = getDaysInShamsiMonth(viewYear, viewMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const navigateMonth = (step: number) => {
    let newMonth = viewMonth + step;
    let newYear = viewYear;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    else if (newMonth < 1) { newMonth = 12; newYear--; }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div onClick={() => setOpen(!open)} className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-mono font-bold outline-none border border-slate-100 cursor-pointer flex items-center justify-between hover:bg-white hover:border-emerald-200 transition-all">
        {value} <Calendar size={16} className="text-slate-400"/>
      </div>
      {open && (
        <div className="absolute top-full right-0 mt-2 bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 z-[100] w-72 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
             <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><ChevronRight size={18}/></button>
             <div className="text-center">
                <p className="font-black text-sm text-slate-800">{shamsiMonthNames[viewMonth-1]}</p>
                <p className="text-[10px] font-bold text-slate-400">{viewYear}</p>
             </div>
             <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"><ChevronLeft size={18}/></button>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {['ش','ی','د','س','چ','پ','ج'].map(w => <div key={w} className="text-center text-[9px] font-black text-slate-300 pb-2">{w}</div>)}
            {days.map(d => {
              const isSelected = d === selectedDay && viewMonth === parseInt(parts[1]) && viewYear === parseInt(parts[0]);
              return (
                <button key={d} onClick={() => { 
                  onChange(`${viewYear}/${String(viewMonth).padStart(2, '0')}/${String(d).padStart(2, '0')}`); 
                  setOpen(false); 
                }} className={`p-2 text-[10px] font-bold rounded-xl transition-all ${isSelected ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'hover:bg-emerald-50 text-slate-600'}`}>
                  {d}
                </button>
              );
            })}
          </div>
          <button onClick={() => setOpen(false)} className="w-full mt-6 py-2 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black hover:bg-rose-50 hover:text-rose-500 transition-all">بستن تقویم</button>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
