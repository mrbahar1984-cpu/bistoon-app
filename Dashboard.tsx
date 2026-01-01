
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, LeaveType } from './types';
import { getShamsiDate, getShamsiTime, getDayName, toEnglishDigits } from './jalali';
import { 
  Play, Square, Coffee, Clock, Send, History, 
  LogIn, RefreshCcw, Flower2, CheckCircle, XCircle, 
  Users, Wifi, WifiOff, MessageCircle
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
  
  // States for Login/Register
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

  // سیستم مدیریت بروزرسانی (Realtime + Polling fallback)
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leave_requests', filter: `employee_id=eq.${currentUser.id}` }, 
      (payload) => {
        setMyRequests(prev => prev.map(req => req.id === payload.new.id ? { ...req, status: payload.new.status } : req));
      })
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    // سیستم Polling: هر ۴۰ ثانیه یکبار داده‌ها را بروزرسانی کن (اگر WebSocket قطع بود)
    const interval = setInterval(() => {
        loadDataSilent();
    }, 40000);

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
      setColleagues(emps.map(e => {
        const eLogs = logs.filter(l => l.employee_id === e.id).sort((a,b) => b.timestamp - a.timestamp);
        const last = eLogs[0];
        let event = 'بدون ثبت';
        if (last) {
          if (last.type === LogType.CLOCK_IN) event = 'ورود';
          else if (last.type === LogType.CLOCK_OUT) event = 'خروج';
          else if (last.type === LogType.HOURLY_LEAVE_START) event = 'شروع پاس';
          else if (last.type === LogType.HOURLY_LEAVE_END) event = 'پایان پاس';
        }
        return {
          name: e.name,
          event,
          time: last ? last.time : '--:--',
          status: last?.type === LogType.CLOCK_IN || last?.type === LogType.HOURLY_LEAVE_END ? 'ONLINE' : 'OFFLINE'
        };
      }));
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
      setSuccessMsg('درخواست شما با موفقیت در سیستم ثبت شد.');
      setReqForm({ ...reqForm, desc: '', h: 0, m: 0, days: 1 });
      loadData();
    } else {
      alert('خطا در ثبت درخواست');
    }
    setSyncing(false);
  };

  const handleWhatsAppNotify = () => {
    const managerPhone = '989123456789'; // شماره مدیر را اینجا وارد کنید
    const typeLabels: any = { 'REMOTE_WORK': 'دورکاری', 'HOURLY_PASS': 'پاس ساعتی', 'DAILY_LEAVE': 'مرخصی روزانه' };
    const text = `سلام، من یک درخواست جدید در BaharTime ثبت کردم:%0A👤 کارمند: ${currentUser?.name}%0A📋 نوع: ${typeLabels[reqForm.type] || 'درخواست'}%0A📅 تاریخ: ${reqForm.date}%0A💬 شرح: ${reqForm.desc || '---'}`;
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
        else alert('کد ملی یا رمز عبور اشتباه است');
      }
    } catch (err) { alert('خطا در برقراری ارتباط با پایگاه داده'); }
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
            {syncing ? <RefreshCcw className="animate-spin" /> : <LogIn size={20}/>} {isRegister ? 'ایجاد حساب' : 'ورود به BaharTime'}
          </button>
        </form>
        <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-xs text-slate-400 font-bold hover:text-emerald-600 transition-colors">
          {isRegister ? 'حساب دارید؟ وارد شوید' : 'ثبت‌نام کاربر جدید'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <nav className="flex gap-2 bg-white p-2 rounded-3xl shadow-sm border border-slate-100 w-fit mx-auto sticky top-4 z-20">
        <TabBtn active={activeTab === 'MAIN'} label="میز کار" icon={<Play size={18}/>} onClick={() => setActiveTab('MAIN')} />
        <TabBtn active={activeTab === 'FULL_HISTORY'} label="تاریخچه" icon={<History size={18}/>} onClick={() => setActiveTab('FULL_HISTORY')} />
        <TabBtn active={activeTab === 'REQUEST_STATUS'} label="درخواست‌ها" icon={<Send size={18}/>} onClick={() => setActiveTab('REQUEST_STATUS')} />
      </nav>

      <div className="flex items-center justify-center gap-4 text-[10px] font-black uppercase text-slate-400">
        <div className="flex items-center gap-1">
            {isRealtimeActive ? <Wifi size={14} className="text-emerald-500"/> : <WifiOff size={14} className="text-rose-500"/>}
            {isRealtimeActive ? 'اتصال آنی فعال' : 'بروزرسانی خودکار (Polling)'}
        </div>
      </div>

      {activeTab === 'MAIN' && (
        <div className="grid md:grid-cols-12 gap-6 animate-in fade-in">
          <div className="md:col-span-8 space-y-6">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5"><Flower2 size={200} /></div>
               <h2 className="text-7xl font-black text-emerald-600 mb-2 font-mono tracking-tighter">{getShamsiTime()}</h2>
               <p className="text-slate-400 font-bold text-lg">{getDayName(new Date())} {getShamsiDate()}</p>
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
                  <ActionBtn icon={<Play />} label="ثبت ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
                  <ActionBtn icon={<Square />} label="ثبت خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
                  <ActionBtn icon={<Coffee />} label="شروع پاس" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
                  <ActionBtn icon={<Clock />} label="پایان پاس" color="bg-indigo-500" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
               </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><History size={20} className="text-emerald-600"/> ۱۰ تردد اخیر</h3>
                <div className="space-y-2">
                  {currentUser.logs.slice(0, 10).map((l, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-sm font-black text-slate-700">{l.time}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase">{l.type.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><Users size={20} className="text-indigo-600"/> همکاران</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {colleagues.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                      <span className={`text-xs font-black ${c.status === 'ONLINE' ? 'text-emerald-600' : 'text-slate-400'}`}>{c.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{c.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-indigo-600 border-b pb-4"><Send size={20}/> ثبت درخواست</h3>
              
              {successMsg && (
                <div className="mb-4 p-4 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100 animate-in zoom-in-95">
                  <div className="text-[11px] font-black flex items-center gap-2 mb-3">
                    <CheckCircle size={16}/> {successMsg}
                  </div>
                  <button onClick={handleWhatsAppNotify} className="w-full bg-emerald-600 text-white p-3 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all">
                    <MessageCircle size={14}/> اطلاع‌رسانی به مدیر (واتساپ)
                  </button>
                </div>
              )}

              <form onSubmit={submitReq} className="space-y-4">
                <select className="w-full p-3 bg-slate-50 rounded-xl border-none font-black text-sm outline-none" value={reqForm.type} onChange={e => setReqForm({...reqForm, type: e.target.value as LeaveType})}>
                  <option value="REMOTE_WORK">دورکاری</option>
                  <option value="HOURLY_PASS">پاس ساعتی</option>
                  <option value="DAILY_LEAVE">مرخصی روزانه</option>
                </select>
                <input className="w-full p-3 bg-slate-50 rounded-xl border-none font-mono font-bold text-center outline-none" value={reqForm.date} onChange={e => setReqForm({...reqForm, date: e.target.value})} />
                
                {reqForm.type === 'REMOTE_WORK' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="ساعت" className="w-full p-3 bg-slate-50 rounded-xl text-center outline-none" value={reqForm.h} onChange={e => setReqForm({...reqForm, h: Number(e.target.value)})} />
                    <input type="number" placeholder="دقیقه" className="w-full p-3 bg-slate-50 rounded-xl text-center outline-none" value={reqForm.m} onChange={e => setReqForm({...reqForm, m: Number(e.target.value)})} />
                  </div>
                )}
                
                <textarea className="w-full p-3 bg-slate-50 rounded-xl border-none font-bold text-sm outline-none" rows={3} placeholder="توضیحات..." value={reqForm.desc} onChange={e => setReqForm({...reqForm, desc: e.target.value})} />
                <button disabled={syncing} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2">
                  {syncing ? <RefreshCcw className="animate-spin" size={18} /> : 'ارسال درخواست'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'FULL_HISTORY' && (
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4">
          <h3 className="text-2xl font-black mb-8">تاریخچه کامل تردد</h3>
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50">
              <tr><th className="p-4 font-black">تاریخ</th><th className="p-4 font-black">ساعت</th><th className="p-4 font-black">نوع</th></tr>
            </thead>
            <tbody>
              {currentUser.logs.map((l, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="p-4 font-mono">{l.shamsi_date}</td>
                  <td className="p-4 font-black text-emerald-600">{l.time}</td>
                  <td className="p-4 text-[10px] text-slate-400">{l.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'REQUEST_STATUS' && (
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4">
          <h3 className="text-2xl font-black mb-8">وضعیت درخواست‌ها</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {myRequests.map((r, i) => (
              <div key={i} className="p-6 bg-slate-50 rounded-[2rem] border relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-1 h-full ${r.status === 'APPROVED' ? 'bg-emerald-500' : r.status === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-400'}`}></div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase">{r.type}</span>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full ${r.status === 'APPROVED' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {r.status === 'APPROVED' ? 'تایید شد' : r.status === 'REJECTED' ? 'رد شد' : 'در انتظار'}
                  </span>
                </div>
                <p className="text-sm font-black text-slate-800">{r.shamsi_date}</p>
                <p className="text-xs text-slate-400 mt-2 truncate">"{r.description || '---'}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-sm transition-all ${active ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
    {icon} <span>{label}</span>
  </button>
);

const ActionBtn = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-6 rounded-[2rem] flex flex-col items-center gap-3 shadow-md hover:scale-105 transition-all active:scale-95`}>
    <div className="p-3 bg-white/20 rounded-xl">{icon}</div>
    <span className="text-[10px] font-black">{label}</span>
  </button>
);

export default Dashboard;
