
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, AttendanceLog } from './types';
import { getShamsiDate, toEnglishDigits } from './jalali';
import { 
  ShieldAlert, Users, Check, Trash2, Edit2, Plus,
  FileSpreadsheet, Download, Clock, Database, Wifi, WifiOff,
  Bell, BellOff, BellRing, Calendar, Search, Save, X
} from 'lucide-react';

type AdminMenu = 'USERS' | 'REQUESTS' | 'ATTENDANCE' | 'REPORTS' | 'MAINTENANCE';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('USERS');
  const [loading, setLoading] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('ALL');
  
  // Manual Entry State
  const [manualEntry, setManualEntry] = useState({ employee_id: '', type: 'ورود' as LogType, date: getShamsiDate(), time: '08:00' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: emps } = await supabase.from('employees').select('*').order('name');
      if (emps) setEmployees(emps.map(e => ({ ...e, nationalId: e.national_id, logs: [] })));
      
      const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name)').order('timestamp', { ascending: false });
      if (reqs) setRequests(reqs);

      const { data: logs } = await supabase.from('attendance_logs').select('*, employees(name)').order('timestamp', { ascending: false }).limit(500);
      if (logs) setAttendanceLogs(logs as AttendanceLog[]);
    } catch (err) {
      console.error("Fetch Error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!adminAuth) return;
    fetchData();
    const channel = supabase.channel('admin-sync').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminAuth]);

  // Actions
  const handlePurge = async (date: string) => {
    if (confirm(`آیا از حذف تمام ترددها تا تاریخ ${date} مطمئن هستید؟ این عمل غیرقابل بازگشت است.`)) {
      const { error } = await supabase.from('attendance_logs').delete().lte('shamsi_date', date);
      if (!error) { alert('پاکسازی با موفقیت انجام شد.'); fetchData(); }
    }
  };

  const handleManualSubmit = async () => {
    if (!manualEntry.employee_id) return alert('لطفاً کارمند را انتخاب کنید');
    const { error } = await supabase.from('attendance_logs').insert([{
      employee_id: manualEntry.employee_id,
      type: manualEntry.type,
      shamsi_date: manualEntry.date,
      time: manualEntry.time,
      timestamp: new Date().toISOString()
    }]);
    if (!error) { alert('تردد ثبت شد'); fetchData(); }
  };

  const deleteItem = async (table: string, id: string) => {
    if (confirm('آیا از حذف این مورد مطمئن هستید؟')) {
      await supabase.from(table).delete().eq('id', id);
      fetchData();
    }
  };

  const exportToExcel = () => {
    let csv = "\ufeffنام,تاریخ,ساعت,نوع\n";
    const filtered = selectedEmpId === 'ALL' ? attendanceLogs : attendanceLogs.filter(l => l.employee_id === selectedEmpId);
    filtered.forEach(l => {
      csv += `${l.employees?.name},${l.shamsi_date},${l.time},${l.type}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `report_${getShamsiDate()}.csv`;
    link.click();
  };

  if (!adminAuth) {
    return (
      <div className="max-w-md mx-auto mt-20 p-12 bg-white rounded-[3rem] shadow-2xl text-center border">
        <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"><ShieldAlert size={40} /></div>
        <h2 className="text-2xl font-black mb-8 text-slate-800 tracking-tight">پنل مدیریت BaharTime</h2>
        <input type="password" placeholder="گذرواژه امنیتی" className="w-full p-5 rounded-2xl bg-slate-50 mb-6 text-center font-black outline-none border focus:ring-2 focus:ring-emerald-500 transition-all" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && password === 'admin123' && setAdminAuth(true)} />
        <button onClick={() => password === 'admin123' ? setAdminAuth(true) : alert('گذرواژه اشتباه است')} className="w-full bg-slate-800 text-white p-5 rounded-2xl font-black hover:bg-slate-900 transition-all shadow-lg">ورود به مدیریت</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen -m-8">
      <aside className="w-full lg:w-64 bg-white border-l p-6 flex flex-col no-print shadow-sm">
        <h1 className="font-black text-emerald-600 text-2xl mb-12 text-center tracking-tighter uppercase">Bahar Admin</h1>
        <nav className="space-y-3 flex-1">
          <MenuBtn active={activeMenu === 'USERS'} label="مدیریت پرسنل" icon={<Users size={20}/>} onClick={() => setActiveMenu('USERS')} />
          <MenuBtn active={activeMenu === 'REQUESTS'} label="مدیریت درخواست‌ها" icon={<Check size={20}/>} onClick={() => setActiveMenu('REQUESTS')} />
          <MenuBtn active={activeMenu === 'ATTENDANCE'} label="مدیریت ترددها" icon={<Clock size={20}/>} onClick={() => setActiveMenu('ATTENDANCE')} />
          <MenuBtn active={activeMenu === 'REPORTS'} label="گزارش پیشرفته" icon={<FileSpreadsheet size={20}/>} onClick={() => setActiveMenu('REPORTS')} />
          <MenuBtn active={activeMenu === 'MAINTENANCE'} label="نگهداری سیستم" icon={<Database size={20}/>} onClick={() => setActiveMenu('MAINTENANCE')} />
        </nav>
      </aside>

      <main className="flex-1 p-8 bg-slate-50/50 overflow-y-auto max-h-screen custom-scrollbar">
        {/* USERS SECTION */}
        {activeMenu === 'USERS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
            <h2 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-2"><Users className="text-emerald-600"/> لیست پرسنل</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map(e => (
                <div key={e.id} className="p-5 bg-slate-50 rounded-3xl border flex justify-between items-center">
                  <span className="font-black text-slate-800">{e.name}</span>
                  <button onClick={() => deleteItem('employees', e.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REQUESTS SECTION */}
        {activeMenu === 'REQUESTS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
            <h2 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-2"><Check className="text-emerald-600"/> مدیریت درخواست‌ها</h2>
            <div className="space-y-4">
              {requests.map(r => (
                <div key={r.id} className="p-6 bg-slate-50 rounded-3xl border flex justify-between items-center">
                  <div>
                    <p className="font-black text-slate-800">{r.employees?.name} - {r.type}</p>
                    <p className="text-[10px] text-slate-400">{r.shamsi_date} | {r.amount} | {r.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => supabase.from('leave_requests').update({status: 'APPROVED'}).eq('id', r.id).then(fetchData)} className="text-emerald-500 hover:bg-emerald-50 p-2 rounded-xl"><Check size={18}/></button>
                    <button onClick={() => deleteItem('leave_requests', r.id)} className="text-rose-400 hover:bg-rose-50 p-2 rounded-xl"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ATTENDANCE SECTION */}
        {activeMenu === 'ATTENDANCE' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Plus className="text-emerald-600"/> ثبت دستی تردد</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <select className="p-4 rounded-2xl bg-slate-50 border text-xs font-black" value={manualEntry.employee_id} onChange={e => setManualEntry({...manualEntry, employee_id: e.target.value})}>
                  <option value="">انتخاب کارمند</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select className="p-4 rounded-2xl bg-slate-50 border text-xs font-black" value={manualEntry.type} onChange={e => setManualEntry({...manualEntry, type: e.target.value as LogType})}>
                  <option value="ورود">ورود</option>
                  <option value="خروج">خروج</option>
                  <option value="پاس">پاس</option>
                  <option value="دورکاری">دورکاری</option>
                  <option value="مرخصی">مرخصی</option>
                </select>
                <input type="text" className="p-4 rounded-2xl bg-slate-50 border text-xs font-black text-center" value={manualEntry.date} onChange={e => setManualEntry({...manualEntry, date: e.target.value})} />
                <input type="time" className="p-4 rounded-2xl bg-slate-50 border text-xs font-black text-center" value={manualEntry.time} onChange={e => setManualEntry({...manualEntry, time: e.target.value})} />
                <button onClick={handleManualSubmit} className="bg-emerald-600 text-white rounded-2xl font-black text-xs hover:bg-emerald-700 transition-all">ثبت تردد</button>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Clock className="text-emerald-600"/> لیست ترددها</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="text-[10px] text-slate-400 border-b">
                      <th className="p-4">نام</th>
                      <th className="p-4">تاریخ</th>
                      <th className="p-4">ساعت</th>
                      <th className="p-4">نوع</th>
                      <th className="p-4">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {attendanceLogs.slice(0, 100).map(l => (
                      <tr key={l.id} className="border-b hover:bg-slate-50">
                        <td className="p-4 font-black">{l.employees?.name}</td>
                        <td className="p-4 font-mono">{l.shamsi_date}</td>
                        <td className="p-4 font-black text-emerald-600">{l.time}</td>
                        <td className="p-4 text-slate-400">{l.type}</td>
                        <td className="p-4">
                          <button onClick={() => deleteItem('attendance_logs', l.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* REPORTS SECTION */}
        {activeMenu === 'REPORTS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
            <div className="flex justify-between items-center mb-8 border-b pb-4">
              <h2 className="text-xl font-black flex items-center gap-2"><FileSpreadsheet className="text-emerald-600"/> گزارش پیشرفته</h2>
              <div className="flex gap-4">
                <select className="p-3 rounded-xl bg-slate-50 border text-xs font-black" value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
                  <option value="ALL">همه پرسنل</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <button onClick={exportToExcel} className="flex items-center gap-2 bg-slate-800 text-white px-5 py-3 rounded-xl text-xs font-black hover:bg-slate-900"><Download size={16}/> خروجی اکسل</button>
              </div>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-right text-xs">
                 <thead>
                   <tr className="bg-slate-50 text-slate-500">
                     <th className="p-4">نام</th>
                     <th className="p-4">تاریخ</th>
                     <th className="p-4">ساعت</th>
                     <th className="p-4">نوع</th>
                   </tr>
                 </thead>
                 <tbody>
                   {(selectedEmpId === 'ALL' ? attendanceLogs : attendanceLogs.filter(l => l.employee_id === selectedEmpId)).map(l => (
                     <tr key={l.id} className="border-b">
                       <td className="p-4 font-black">{l.employees?.name}</td>
                       <td className="p-4 font-mono">{l.shamsi_date}</td>
                       <td className="p-4 font-black">{l.time}</td>
                       <td className="p-4">{l.type}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {/* MAINTENANCE SECTION */}
        {activeMenu === 'MAINTENANCE' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
            <h2 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-2"><Database className="text-emerald-600"/> نگهداری سیستم</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="p-8 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                <h3 className="font-black text-emerald-800 mb-4 flex items-center gap-2"><Download size={20}/> پشتیبان‌گیری کامل</h3>
                <p className="text-xs text-emerald-600 mb-6 leading-relaxed">دریافت فایل CSV از تمامی ترددهای ثبت شده در سیستم برای بایگانی آفلاین.</p>
                <button onClick={exportToExcel} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">دریافت فایل پشتیبان</button>
              </div>
              
              <div className="p-8 bg-rose-50 rounded-[2rem] border border-rose-100">
                <h3 className="font-black text-rose-800 mb-4 flex items-center gap-2"><Trash2 size={20}/> پاکسازی دیتابیس</h3>
                <p className="text-xs text-rose-600 mb-6 leading-relaxed">حذف ترددهای قدیمی برای افزایش سرعت برنامه. لطفاً تاریخ مورد نظر را وارد کنید.</p>
                <div className="flex gap-2">
                  <input type="text" id="purgeDate" placeholder="1402/12/29" className="flex-1 p-4 rounded-2xl bg-white border font-mono text-center text-xs outline-none focus:ring-2 focus:ring-rose-500" />
                  <button onClick={() => handlePurge((document.getElementById('purgeDate') as HTMLInputElement).value)} className="bg-rose-600 text-white px-6 rounded-2xl font-black text-xs hover:bg-rose-700 transition-all shadow-lg shadow-rose-200">پاکسازی</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const MenuBtn = React.memo(({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-black text-xs transition-all ${active ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
    {icon} <span>{label}</span>
  </button>
));

export default AdminPanel;
