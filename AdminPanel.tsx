
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, AttendanceLog } from './types';
import { getShamsiDate, toEnglishDigits } from './jalali';
import { 
  ShieldAlert, Users, Check, Trash2, 
  RefreshCcw, FileSpreadsheet, Download, Edit2, Plus, Clock, Database, Eraser, Wifi, WifiOff,
  Bell, BellOff, BellRing
} from 'lucide-react';

type AdminMenu = 'USERS' | 'REQUESTS' | 'ATTENDANCE_EDIT' | 'DYNAMO_REPORTS' | 'DATABASE_MAINTENANCE';

const AdminPanel: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [adminAuth, setAdminAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('USERS');
  const [loading, setLoading] = useState(false);
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);
  const [pushSupported, setPushSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: emps } = await supabase.from('employees').select('*');
    if (emps) setEmployees(emps.map(e => ({ ...e, nationalId: e.national_id, logs: [] })));
    const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name, national_id)').order('timestamp', { ascending: false });
    if (reqs) setRequests(reqs);
    setLoading(false);
  };

  useEffect(() => {
    // چک کردن پشتیبانی از اعلان در مرورگر
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setPushSupported(true);
      if (Notification.permission === 'granted') {
        setIsSubscribed(true);
      }
    }

    if (!adminAuth) return;
    fetchData();

    const channel = supabase
      .channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        fetchData();
      })
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    const interval = setInterval(() => {
        fetchDataSilent();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [adminAuth]);

  const fetchDataSilent = async () => {
    const { data: reqs } = await supabase.from('leave_requests').select('*, employees(name, national_id)').order('timestamp', { ascending: false });
    if (reqs) setRequests(reqs);
  };

  const handleEnableNotifications = async () => {
    if (!pushSupported) return;
    
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setIsSubscribed(true);
      // در مرحله ۴، توکن واقعی را به سرور می‌فرستیم
      console.log('اعلان‌ها فعال شدند. توکن در مرحله بعدی ذخیره خواهد شد.');
      alert('اعلان‌های سیستم با موفقیت روی این دستگاه فعال شد.');
    } else {
      alert('اجازه دسترسی به اعلان‌ها داده نشد. لطفاً تنظیمات مرورگر خود را چک کنید.');
    }
  };

  const updateRequestStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await supabase.from('leave_requests').update({ status }).eq('id', id);
    fetchData();
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
      <aside className="w-full lg:w-64 bg-white border-l p-6 flex flex-col no-print">
        <h1 className="font-black text-emerald-600 text-2xl mb-12 text-center tracking-tighter uppercase">Bahar Admin</h1>
        <nav className="space-y-3 flex-1">
          <MenuBtn active={activeMenu === 'USERS'} label="کاربران" icon={<Users size={20}/>} onClick={() => setActiveMenu('USERS')} />
          <MenuBtn active={activeMenu === 'REQUESTS'} label="درخواست‌ها" icon={<Check size={20}/>} onClick={() => setActiveMenu('REQUESTS')} />
          <MenuBtn active={activeMenu === 'ATTENDANCE_EDIT'} label="ترددها" icon={<Clock size={20}/>} onClick={() => setActiveMenu('ATTENDANCE_EDIT')} />
          <MenuBtn active={activeMenu === 'DYNAMO_REPORTS'} label="گزارشات" icon={<FileSpreadsheet size={20}/>} onClick={() => setActiveMenu('DYNAMO_REPORTS')} />
        </nav>

        {/* بخش جدید اعلان‌ها در سایدبار */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className={`p-4 rounded-2xl border transition-all ${isSubscribed ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center gap-3 mb-3">
              {isSubscribed ? <BellRing size={18} className="text-emerald-600"/> : <BellOff size={18} className="text-slate-400"/>}
              <span className="text-[10px] font-black text-slate-700">اعلان‌های سیستم</span>
            </div>
            {!isSubscribed ? (
              <button 
                onClick={handleEnableNotifications}
                className="w-full bg-white text-slate-800 py-2 rounded-xl text-[9px] font-black shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                فعال‌سازی روی این دستگاه
              </button>
            ) : (
              <div className="text-[9px] font-bold text-emerald-700 text-center">
                وضعیت: متصل و آماده
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 p-4 flex flex-col items-center gap-2">
            {isRealtimeActive ? <Wifi size={14} className="text-emerald-500"/> : <WifiOff size={14} className="text-rose-500"/>}
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{isRealtimeActive ? 'Realtime Connected' : 'Polling Active'}</span>
        </div>
      </aside>

      <main className="flex-1 p-8 bg-slate-50/50">
        {activeMenu === 'USERS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
            <h2 className="text-xl font-black mb-8 border-b pb-4">پرسنل سامانه</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {employees.map(e => (
                <div key={e.id} className="p-4 bg-slate-50 rounded-2xl border flex justify-between items-center">
                  <span className="text-sm font-black">{e.name}</span>
                  <button onClick={async () => { if(confirm('حذف شود؟')) { await supabase.from('employees').delete().eq('id', e.id); fetchData(); } }} className="text-rose-400 hover:text-rose-600 transition-colors"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeMenu === 'REQUESTS' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border animate-in fade-in">
            <h2 className="text-xl font-black mb-8 border-b pb-4">مدیریت درخواست‌ها</h2>
            <div className="grid gap-6">
              {requests.map(r => (
                <div key={r.id} className={`p-6 rounded-[2rem] border ${r.status === 'PENDING' ? 'bg-amber-50/30' : 'bg-white'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-black text-slate-800">{r.employees?.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{r.shamsi_date} | {r.type}</p>
                    </div>
                    {r.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button onClick={() => updateRequestStatus(r.id, 'APPROVED')} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-emerald-600 transition-all">تایید</button>
                        <button onClick={() => updateRequestStatus(r.id, 'REJECTED')} className="bg-rose-500 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-rose-600 transition-all">رد</button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 italic">"{r.description || 'بدون شرح'}"</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const MenuBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-4 rounded-2xl font-black text-xs transition-all ${active ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
    {icon} <span>{label}</span>
  </button>
);

export default AdminPanel;
