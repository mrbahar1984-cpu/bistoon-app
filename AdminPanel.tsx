
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, AttendanceLog } from './types';
import { getShamsiDate, toEnglishDigits } from './jalali';
import { calculateWorkDetails } from './calculations';
import { 
  ShieldAlert, Users, Check, Trash2, 
  RefreshCcw, FileSpreadsheet, Download, Clock, Database, Wifi, WifiOff,
  Bell, BellOff, BellRing, Calendar, Search
} from 'lucide-react';

type AdminMenu = 'USERS' | 'REQUESTS' | 'ATTENDANCE_EDIT' | 'DYNAMO_REPORTS';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('USERS');
  const [loading, setLoading] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: emps } = await supabase.from('employees').select('*');
      if (emps) setEmployees(emps.map(e => ({ ...e, nationalId: e.national_id, logs: [] })));
      
      const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name, national_id)').order('timestamp', { ascending: false });
      if (reqs) setRequests(reqs);

      const { data: logs } = await supabase.from('attendance_logs').select('*, employees(name)').order('timestamp', { ascending: false }).limit(200);
      if (logs) setAttendanceLogs(logs as AttendanceLog[]);
    } catch (err) {
      console.error("Fetch Error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    // بررسی وضعیت اجازه اعلان در هنگام لود شدن پنل
    if ('Notification' in window && Notification.permission === 'granted') {
      setIsSubscribed(true);
    }

    if (!adminAuth) return;
    fetchData();

    const channel = supabase
      .channel('admin-global-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => fetchData())
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminAuth]);

  // تابع جدید برای فعال‌سازی اعلان
  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      alert('مرورگر شما از قابلیت اعلان پشتیبانی نمی‌کند.');
      return;
    }
    
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setIsSubscribed(true);
      alert('اعلان‌های سیستم روی این مرورگر فعال شد. در مراحل بعدی تنظیمات نهایی انجام خواهد شد.');
    } else {
      alert('اجازه دسترسی به اعلان داده نشد.');
    }
  };

  const updateRequestStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await supabase.from('leave_requests').update({ status }).eq('id', id);
    fetchData();
  };

  const deleteLog = async (id: string) => {
    if (confirm('آیا از حذف این تردد مطمئن هستید؟')) {
      await supabase.from('attendance_logs').delete().eq('id', id);
      fetchData();
    }
  };

  const handleDeleteEmployee = useCallback(async (id: string) => {
    if (confirm('کاربر حذف شود؟')) {
      await supabase.from('employees').delete().eq('id', id);
      fetchData();
    }
  }, []);

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
          <MenuBtn active={activeMenu === 'USERS'} label="کاربران" icon={<Users size={20}/>} onClick={() => setActiveMenu('USERS')} />
          <MenuBtn active={activeMenu === 'REQUESTS'} label="درخواست‌ها" icon={<Check size={20}/>} onClick={() => setActiveMenu('REQUESTS')} />
          <MenuBtn active={activeMenu === 'ATTENDANCE_EDIT'} label="اصلاح تردد" icon={<Clock size={20}/>} onClick={() => setActiveMenu('ATTENDANCE_EDIT')} />
          <MenuBtn active={activeMenu === 'DYNAMO_REPORTS'} label="گزارشات" icon={<FileSpreadsheet size={20}/>} onClick={() => setActiveMenu('DYNAMO_REPORTS')} />
        </nav>

        {/* بخش دکمه اعلان در انتهای سایدبار - بدون تغییر در سایر بخش‌ها */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <button 
            onClick={handleEnableNotifications}
            className={`w-full flex items-center gap-3 p-4 rounded-2xl text-[10px] font-black transition-all ${isSubscribed ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'}`}
          >
            {isSubscribed ? <BellRing size={16}/> : <BellOff size={16}/>}
            <span>{isSubscribed ? 'اعلان‌ها فعال است' : 'فعال‌سازی اعلان'}</span>
          </button>
        </div>

        <div className="mt-6 p-4 flex flex-col items-center gap-2">
            {isRealtimeActive ? <Wifi size={14} className="text-emerald-500"/> : <WifiOff size={14} className="text-rose-500"/>}
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{isRealtimeActive ? 'Live Mode' : 'Polling Mode'}</span>
        </div>
      </aside>

      <main className="flex-1 p-8 bg-slate-50/50 overflow-y-auto max-h-screen custom-scrollbar">
        {activeMenu === 'USERS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
            <h2 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-2"><Users className="text-emerald-600"/> مدیریت پرسنل</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map(e => (
                <EmployeeItem key={e.id} employee={e} onDelete={handleDeleteEmployee} />
              ))}
            </div>
          </div>
        )}

        {activeMenu === 'REQUESTS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
            <h2 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-2"><Check className="text-emerald-600"/> تایید درخواست‌ها</h2>
            <div className="grid gap-4">
              {requests.map(r => (
                <RequestItem key={r.id} request={r} onUpdate={updateRequestStatus} />
              ))}
            </div>
          </div>
        )}

        {activeMenu === 'ATTENDANCE_EDIT' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
             <h2 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-2"><Clock className="text-emerald-600"/> لیست ترددهای اخیر</h2>
             <div className="overflow-x-auto">
               <table className="w-full text-right">
                 <thead>
                   <tr className="text-[10px] text-slate-400 border-b">
                     <th className="p-4 font-black">نام کارمند</th>
                     <th className="p-4 font-black">تاریخ</th>
                     <th className="p-4 font-black">ساعت</th>
                     <th className="p-4 font-black">نوع</th>
                     <th className="p-4 font-black">عملیات</th>
                   </tr>
                 </thead>
                 <tbody className="text-xs">
                   {attendanceLogs.map(l => (
                     <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                       <td className="p-4 font-black">{l.employees?.name || 'نامعلوم'}</td>
                       <td className="p-4 font-mono">{l.shamsi_date}</td>
                       <td className="p-4 font-black text-emerald-600">{l.time}</td>
                       <td className="p-4 text-[10px] text-slate-400">{l.type}</td>
                       <td className="p-4">
                         <button onClick={() => deleteLog(l.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        )}

        {activeMenu === 'DYNAMO_REPORTS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
             <h2 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-2"><FileSpreadsheet className="text-emerald-600"/> گزارشات تجمیعی</h2>
             <div className="grid gap-4">
                {employees.map(emp => {
                  const empLogs = attendanceLogs.filter(l => l.employee_id === emp.id);
                  const empReqs = requests.filter(r => r.employee_id === emp.id);
                  const stats = calculateWorkDetails(empLogs, 192, empReqs);
                  return (
                    <div key={emp.id} className="p-6 bg-slate-50 rounded-3xl border flex flex-col md:flex-row justify-between items-center gap-4">
                      <span className="font-black text-slate-800">{emp.name}</span>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 text-center px-8">
                         <div><p className="text-[8px] text-slate-400 font-black">کارکرد کل</p><p className="text-sm font-black text-emerald-600">{stats.formattedTotalWork}</p></div>
                         <div><p className="text-[8px] text-slate-400 font-black">اضافه‌کار</p><p className="text-sm font-black text-indigo-600">{stats.formattedOvertime}</p></div>
                         <div><p className="text-[8px] text-slate-400 font-black">کسری</p><p className="text-sm font-black text-rose-500">{stats.formattedDeficit}</p></div>
                         <div><p className="text-[8px] text-slate-400 font-black">مرخصی (روز)</p><p className="text-sm font-black text-slate-700">{stats.totalDailyLeaveDays}</p></div>
                      </div>
                    </div>
                  );
                })}
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

const EmployeeItem = React.memo(({ employee, onDelete }: { employee: EmployeeData, onDelete: (id: string) => void }) => (
  <div className="p-5 bg-slate-50 rounded-[2rem] border flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
    <div>
      <p className="text-sm font-black text-slate-800">{employee.name}</p>
      <p className="text-[10px] text-slate-400 font-mono mt-1">{employee.nationalId}</p>
    </div>
    <button onClick={() => onDelete(employee.id)} className="text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={18}/></button>
  </div>
));

const RequestItem = React.memo(({ request, onUpdate }: { request: LeaveRequest, onUpdate: (id: string, status: 'APPROVED' | 'REJECTED') => void }) => (
  <div className={`p-6 rounded-[2rem] border-2 transition-all ${request.status === 'PENDING' ? 'border-amber-100 bg-amber-50/20' : 'border-slate-50 bg-white'}`}>
    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-black text-slate-800">{request.employees?.name}</span>
          <span className="text-[9px] font-black bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">{request.type}</span>
        </div>
        <p className="text-[10px] text-slate-400 font-mono">{request.shamsi_date} | مقدار: {request.amount}</p>
        <p className="text-xs text-slate-600 mt-2 italic">"{request.description || 'بدون توضیح'}"</p>
      </div>
      {request.status === 'PENDING' ? (
        <div className="flex gap-2">
          <button onClick={() => onUpdate(request.id, 'APPROVED')} className="bg-emerald-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100">تایید نهایی</button>
          <button onClick={() => onUpdate(request.id, 'REJECTED')} className="bg-rose-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black hover:bg-rose-600 transition-all shadow-lg shadow-rose-100">رد درخواست</button>
        </div>
      ) : (
        <span className={`text-[10px] font-black px-4 py-2 rounded-xl ${request.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {request.status === 'APPROVED' ? 'تایید شده' : 'رد شده'}
        </span>
      )}
    </div>
  </div>
));

const AttendanceLogItem = React.memo(({ log, onDelete }: { log: AttendanceLog, onDelete: (id: string) => void }) => (
  <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
    <td className="p-4 font-black">{log.employees?.name || 'نامعلوم'}</td>
    <td className="p-4 font-mono">{log.shamsi_date}</td>
    <td className="p-4 font-black text-emerald-600">{log.time}</td>
    <td className="p-4 text-[10px] text-slate-400">{log.type}</td>
    <td className="p-4">
      <button onClick={() => onDelete(log.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button>
    </td>
  </tr>
));

export default AdminPanel;
