import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, LeaveType } from './types';
import { getShamsiDate, getShamsiTime, getDayName, toEnglishDigits } from './jalali';
import { 
  Play, Square, Coffee, Clock, Send, History, 
  LogIn, RefreshCcw, Flower2, CheckCircle, XCircle, 
  Users, Wifi, WifiOff, MessageCircle, Download
} from 'lucide-react';

interface Props {
  currentUser: EmployeeData | null;
  onLogin: (user: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ currentUser, onLogin }) => {
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'MAIN' | 'FULL_HISTORY' | 'REQUEST_STATUS'>('MAIN');
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', nationalId: '', password: '' });

  const [reqForm, setReqForm] = useState({ 
    type: 'REMOTE_WORK' as LeaveType, 
    date: getShamsiDate(), 
    h: 0, m: 0, 
    days: 1,
    desc: '' 
  });
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);

  // مدیریت رویداد نصب PWA با دقت بالاتر
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // اگر اپلیکیشن قبلاً نصب شده باشد
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('لطفاً از منوی مرورگر گزینه Add to Home Screen را انتخاب کنید.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => fetchColleagues())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests', filter: `employee_id=eq.${currentUser.id}` }, 
      (payload) => {
        if (payload.eventType === 'UPDATE') {
          setMyRequests(prev => prev.map(req => req.id === payload.new.id ? { ...req, status: payload.new.status } : req));
        }
      })
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    const interval = setInterval(() => {
        loadDataSilent();
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [currentUser?.id]);

  const loadDataSilent = async () => {
    if (!currentUser) return;
    const { data: reqs } = await supabase.from('leave_requests').select('*').eq('employee_id', currentUser.id).order('timestamp', { ascending: false });
    if (reqs) setMyRequests(reqs);
    fetchColleagues();
  };

  const loadData = async () => {
    if (!currentUser) return;
    setSyncing(true);
    const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', currentUser.id).order('timestamp', { ascending: false });
    const { data: reqs } = await supabase.from('leave_requests').select('*').eq('employee_id', currentUser.id).order('timestamp', { ascending: false });
    if (logs) onLogin({ ...currentUser, logs });
    if (reqs) setMyRequests(reqs);
    fetchColleagues();
    setSyncing(false);
  };

  const fetchColleagues = async () => {
    const today = toEnglishDigits(getShamsiDate());
    const { data: emps } = await supabase.from('employees').select('id, name');
    const { data: logs } = await supabase.from('attendance_logs').select('*').eq('shamsi_date', today);
    
    if (emps && logs) {
      const mapped = emps.map(e => {
        const eLogs = logs.filter(l => l.employee_id === e.id).sort((a,b) => b.timestamp - a.timestamp);
        const last = eLogs[0];
        
        const typeLabels: Record<string, string> = {
          [LogType.CLOCK_IN]: 'ورود',
          [LogType.CLOCK_OUT]: 'خروج',
          [LogType.HOURLY_LEAVE_START]: 'شروع پاس',
          [LogType.HOURLY_LEAVE_END]: 'پایان پاس'
        };

        const eventLabel = last ? typeLabels[last.type] : 'عدم ثبت';
        const isPresent = last ? (last.type === LogType.CLOCK_IN || last.type === LogType.HOURLY_LEAVE_END) : false;

        return {
          id: e.id,
          name: e.name,
          event: eventLabel,
          time: last ? last.time : '--:--',
          isPresent
        };
      });
      setColleagues(mapped);
    }
  };

  useEffect(() => { if (currentUser) loadData(); }, [currentUser?.id]);

  const addLog = async (type: LogType) => {
    if (syncing) return;
    setSyncing(true);
    const today = toEnglishDigits(getShamsiDate());
    const time = getShamsiTime();
    
    const { error } = await supabase.from('attendance_logs').insert([{
      employee_id: currentUser?.id,
      type,
      shamsi_date: today,
      time: time,
      timestamp: Date.now()
    }]);

    if (!error) loadData();
    setSyncing(false);
  };

  const submitReq = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    let amount = 0;
    if (reqForm.type === 'REMOTE_WORK') amount = Number((reqForm.h + (reqForm.m / 60)).toFixed(2));
    else if (reqForm.type === 'DAILY_LEAVE') amount = reqForm.days;
    else amount = 1;

    const { data, error } = await supabase.from('leave_requests').insert([{
      employee_id: currentUser?.id,
      type: reqForm.type,
      amount,
      shamsi_date: toEnglishDigits(reqForm.date),
      description: reqForm.desc,
      status: 'PENDING',
      timestamp: Date.now()
    }]).select();

    if (!error && data) {
      setLastRequestId(data[0].id);
      setSuccessMsg('درخواست شما با موفقیت ثبت شد.');
      setReqForm({ ...reqForm, desc: '', h: 0, m: 0, days: 1 });
      loadData();
    }
    setSyncing(false);
  };

  const handleWhatsAppNotify = () => {
    const managerPhone = '989334309660'; 
    const typeLabels: any = { 'REMOTE_WORK': 'دورکاری', 'HOURLY_PASS': 'پاس ساعتی', 'DAILY_LEAVE': 'مرخصی روزانه' };
    const text = `سلام، درخواست ${typeLabels[reqForm.type]} در BaharTime ثبت شد.%0A👤 کاربر: ${currentUser?.name}%0A📅 تاریخ: ${reqForm.date}`;
    window.open(`https://wa.me/${managerPhone}?text=${text}`, '_blank');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    const nid = toEnglishDigits(formData.nationalId);
    try {
      if (isRegister) {
        const { data } = await supabase.from('employees').insert([{ name: formData.name, national_id: nid, password: formData.password }]).select();
        if (data) onLogin({ ...data[0], nationalId: data[0].national_id, logs: [] });
      } else {
        const { data } = await supabase.from('employees').select('*').eq('national_id', nid).eq('password', formData.password).single();
        if (data) onLogin({ ...data, nationalId: data.national_id, logs: [] });
        else alert('اطلاعات اشتباه است');
      }
    } catch (err) { alert('خطا در ورود'); }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[3rem] shadow-2xl border border-slate-100">
        <div className="flex justify-center mb-8"><div className="bg-emerald-600 p-5 rounded-[2rem] text-white shadow-lg"><Flower2 size={40}/></div></div>
        <h2 className="text-3xl font-black text-center mb-8 text-slate-800">BaharTime</h2>
        <form onSubmit={handleAuth} className="space-y-4">
          {isRegister && <input required className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-bold" placeholder="نام و نام خانوادگی" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
          <input required className="w-full p-4 rounded-2xl bg-slate-50 border outline-none font-mono font-bold" placeholder="کد ملی" value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} />
          <input required type="password" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none" placeholder="رمز عبور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          <button disabled={syncing} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg">
            {syncing ? <RefreshCcw className="animate-spin" /> : <LogIn size={20}/>} {isRegister ? 'ایجاد حساب' : 'ورود'}
          </button>
        </form>
        <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-xs text-slate-400 font-bold hover:text-emerald-600 transition-colors">
          {isRegister ? 'حساب دارید؟ وارد شوید' : 'ثبت‌نام'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <nav className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-4 z-20">
        <div className="flex gap-2 bg-white p-2 rounded-3xl shadow-sm border border-slate-100 w-fit mx-auto md:mx-0">
          <TabBtn active={activeTab === 'MAIN'} label="میز کار" icon={<Play size={18}/>} onClick={() => setActiveTab('MAIN')} />
          <TabBtn active={activeTab === 'FULL_HISTORY'} label="تاریخچه" icon={<History size={18}/>} onClick={() => setActiveTab('FULL_HISTORY')} />
          <TabBtn active={activeTab === 'REQUEST_STATUS'} label="درخواست‌ها" icon={<Send size={18}/>} onClick={() => setActiveTab('REQUEST_STATUS')} />
        </div>
        
        {showInstallBtn && (
          <button 
            onClick={handleInstallClick}
            className="flex items-center gap-3 bg-slate-800 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl hover:scale-105 transition-all"
          >
            <Download size={20}/> نصب اپلیکیشن BaharTime
          </button>
        )}
      </nav>

      <div className="flex items-center justify-center gap-4 text-[10px] font-black uppercase text-slate-400">
        <div className="flex items-center gap-1">
            {isRealtimeActive ? <Wifi size={14} className="text-emerald-500"/> : <WifiOff size={14} className="text-rose-500"/>}
            {isRealtimeActive ? 'Live Sync Active' : 'Polling Sync Mode'}
        </div>
      </div>

      {activeTab === 'MAIN' && (
        <div className="grid md:grid-cols-12 gap-6 animate-in fade-in">
          <div className="md:col-span-8 space-y-6">
            {/* کارت زمان مرکزی */}
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5"><Flower2 size={200} /></div>
               <h2 className="text-5xl md:text-7xl font-black text-emerald-600 mb-2 font-mono tracking-tighter">{getShamsiTime()}</h2>
               <p className="text-slate-400 font-bold text-lg">{getDayName(new Date())} {getShamsiDate()}</p>
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
                  <ActionBtn icon={<Play />} label="ثبت ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
                  <ActionBtn icon={<Square />} label="ثبت خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
                  <ActionBtn icon={<Coffee />} label="شروع پاس" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
                  <ActionBtn icon={<Clock />} label="پایان پاس" color="bg-indigo-500" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
               </div>
            </div>

            <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-6">
              {/* تردد اخیر */}
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><History size={20} className="text-emerald-600"/> ترددهای اخیر شما</h3>
                <div className="space-y-2">
                  {currentUser.logs.slice(0, 10).map((l, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-sm font-black text-slate-700">{l.time}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase">{l.type.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* وضعیت همکاران - بازطراحی شده */}
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><Users size={20} className="text-indigo-600"/> وضعیت همکاران</h3>
                <div className="space-y-4 max-h-[450px] overflow-y-auto custom-scrollbar pr-1">
                  {colleagues.map((c, i) => (
                    <div key={c.id || i} className="flex items-center justify-between p-4 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-black text-slate-800">{c.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-400">{c.time}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${c.isPresent ? 'text-emerald-600 bg-emerald-100/50' : 'text-rose-600 bg-rose-100/50'}`}>
                            {c.event}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center px-2">
                        <div className={`w-3.5 h-3.5 rounded-full shadow-sm border-2 border-white ${c.isPresent ? 'bg-emerald-500 shadow-emerald-200 animate-pulse' : 'bg-rose-500 shadow-rose-200'}`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 space-y-6">
            {/* فرم درخواست */}
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 sticky top-24">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-indigo-600 border-b pb-4"><Send size={20}/> ثبت درخواست</h3>
              {successMsg && (
                <div className="mb-4 p-4 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100">
                  <div className="text-[11px] font-black flex items-center gap-2 mb-2">
                    <CheckCircle size={16}/> {successMsg}
                  </div>
                  <button onClick={handleWhatsAppNotify} className="w-full bg-emerald-600 text-white p-2.5 rounded-xl text-[10px] font-black flex items-center justify-center gap-2">
                    <MessageCircle size={14}/> اطلاع‌رسانی واتساپ
                  </button>
                </div>
              )}
              <form onSubmit={submitReq} className="space-y-4">
                <select className="w-full p-4 bg-slate-50 rounded-2xl border-none font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={reqForm.type} onChange={e => setReqForm({...reqForm, type: e.target.value as LeaveType})}>
                  <option value="REMOTE_WORK">دورکاری</option>
                  <option value="HOURLY_PASS">پاس ساعتی</option>
                  <option value="DAILY_LEAVE">مرخصی روزانه</option>
                </select>
                <input className="w-full p-4 bg-slate-50 rounded-2xl border-none font-mono font-bold text-center outline-none" value={reqForm.date} onChange={e => setReqForm({...reqForm, date: e.target.value})} />
                {reqForm.type === 'REMOTE_WORK' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="ساعت" className="w-full p-4 bg-slate-50 rounded-2xl text-center outline-none" value={reqForm.h} onChange={e => setReqForm({...reqForm, h: Number(e.target.value)})} />
                    <input type="number" placeholder="دقیقه" className="w-full p-4 bg-slate-50 rounded-2xl text-center outline-none" value={reqForm.m} onChange={e => setReqForm({...reqForm, m: Number(e.target.value)})} />
                  </div>
                )}
                <textarea className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-xs outline-none" rows={3} placeholder="توضیحات..." value={reqForm.desc} onChange={e => setReqForm({...reqForm, desc: e.target.value})} />
                <button disabled={syncing} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 active:scale-95 transition-all">
                  {syncing ? <RefreshCcw className="animate-spin" size={18} /> : 'ارسال درخواست'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* تب‌های دیگر (تاریخچه و درخواست‌ها) مشابه قبل با استایل جدید */}
      {activeTab === 'FULL_HISTORY' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4">
          <h3 className="text-xl font-black mb-8 border-b pb-4">تاریخچه کامل تردد</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50">
                <tr><th className="p-4 font-black">تاریخ</th><th className="p-4 font-black">ساعت</th><th className="p-4 font-black">نوع تردد</th></tr>
              </thead>
              <tbody>
                {currentUser.logs.map((l, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="p-4 font-mono">{l.shamsi_date}</td>
                    <td className="p-4 font-black text-emerald-600">{l.time}</td>
                    <td className="p-4 text-[10px] text-slate-400 font-bold uppercase">{l.type.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'REQUEST_STATUS' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4">
          <h3 className="text-xl font-black mb-8 border-b pb-4">وضعیت درخواست‌های من</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myRequests.map((r, i) => (
              <div key={i} className="p-6 bg-slate-50 rounded-[2.5rem] border relative group hover:bg-white hover:shadow-lg transition-all">
                <div className={`absolute top-0 right-0 w-1.5 h-full rounded-full ${r.status === 'APPROVED' ? 'bg-emerald-500' : r.status === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-400'}`}></div>
                <div className="flex justify-between items-center mb-4 pr-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{r.type}</span>
                  <span className={`text-[9px] font-black px-3 py-1.5 rounded-full ${r.status === 'APPROVED' ? 'bg-emerald-500 text-white' : r.status === 'REJECTED' ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {r.status === 'APPROVED' ? 'تایید شد' : r.status === 'REJECTED' ? 'رد شد' : 'در انتظار'}
                  </span>
                </div>
                <p className="text-sm font-black text-slate-800 pr-2">{r.shamsi_date}</p>
                <p className="text-xs text-slate-400 mt-2 truncate pr-2">"{r.description || '---'}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-6 md:px-8 py-3.5 md:py-4 rounded-2xl font-black text-xs transition-all duration-300 ${active ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-100' : 'text-slate-400 hover:bg-slate-50'}`}>
    {icon} <span className="hidden sm:inline">{label}</span>
  </button>
);

const ActionBtn = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-6 rounded-[2.5rem] flex flex-col items-center gap-3 shadow-lg hover:scale-105 active:scale-95 transition-all`}>
    <div className="p-3 bg-white/20 rounded-2xl">{icon}</div>
    <span className="text-[10px] font-black">{label}</span>
  </button>
);

export default Dashboard;