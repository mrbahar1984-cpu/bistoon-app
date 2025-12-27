
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, LeaveType } from './types';
import { getShamsiDate, getShamsiTime, getDayName, toEnglishDigits } from './jalali';
import { 
  Play, Square, Coffee, Clock, Send, History, 
  Monitor, ClipboardList, LogIn, RefreshCcw, 
  Flower2, CheckCircle, XCircle, Users, Search, Info 
} from 'lucide-react';

interface Props {
  currentUser: EmployeeData | null;
  onLogin: (user: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ currentUser, onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', nationalId: '', password: '' });
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'MAIN' | 'FULL_HISTORY' | 'REQUEST_STATUS'>('MAIN');
  const [colleagues, setColleagues] = useState<any[]>([]);
  
  const [reqForm, setReqForm] = useState({ 
    type: 'REMOTE_WORK' as LeaveType, 
    date: getShamsiDate(), 
    h: 0, m: 0, 
    desc: '' 
  });
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);

  const fetchColleagues = async () => {
    const today = getShamsiDate();
    const { data: emps } = await supabase.from('employees').select('id, name');
    const { data: logs } = await supabase.from('attendance_logs').select('*').eq('shamsi_date', today);
    
    if (emps && logs) {
      setColleagues(emps.map(e => {
        const eLogs = logs.filter(l => l.employee_id === e.id).sort((a,b) => b.timestamp - a.timestamp);
        const last = eLogs[0];
        return {
          name: e.name,
          event: last ? (last.type === LogType.CLOCK_IN ? 'ورود' : last.type === LogType.CLOCK_OUT ? 'خروج' : last.type === LogType.HOURLY_LEAVE_START ? 'شروع پاس' : 'پایان پاس') : 'بدون ثبت',
          time: last ? last.time : '--:--',
          status: last?.type === LogType.CLOCK_IN || last?.type === LogType.HOURLY_LEAVE_END ? 'ONLINE' : 'OFFLINE'
        };
      }));
    }
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

  useEffect(() => { if (currentUser) loadData(); }, [currentUser?.id]);

  const addLog = async (type: LogType) => {
    if (syncing) return;
    setSyncing(true);
    await supabase.from('attendance_logs').insert([{
      employee_id: currentUser?.id,
      type,
      shamsi_date: getShamsiDate(),
      time: getShamsiTime(),
      timestamp: Date.now()
    }]);
    loadData();
  };

  const submitReq = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    await supabase.from('leave_requests').insert([{
      employee_id: currentUser?.id,
      type: reqForm.type,
      remote_hours: reqForm.h,
      remote_minutes: reqForm.m,
      shamsi_date: toEnglishDigits(reqForm.date),
      description: reqForm.desc,
      status: 'PENDING',
      timestamp: Date.now()
    }]);
    setReqForm({ ...reqForm, desc: '', h: 0, m: 0 });
    loadData();
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
    } catch (err) { alert('خطا در احراز هویت'); }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[3rem] shadow-2xl border border-slate-100">
        <div className="flex justify-center mb-8"><div className="bg-emerald-600 p-5 rounded-[2rem] text-white shadow-lg"><Flower2 size={40}/></div></div>
        <h2 className="text-2xl font-black text-center mb-8 text-slate-800">BaharTime</h2>
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
        <TabBtn active={activeTab === 'FULL_HISTORY'} label="تاریخچه کامل" icon={<History size={18}/>} onClick={() => setActiveTab('FULL_HISTORY')} />
        <TabBtn active={activeTab === 'REQUEST_STATUS'} label="وضعیت درخواست‌ها" icon={<ClipboardList size={18}/>} onClick={() => setActiveTab('REQUEST_STATUS')} />
      </nav>

      {activeTab === 'MAIN' && (
        <div className="grid md:grid-cols-12 gap-6 animate-in fade-in">
          <div className="md:col-span-8 space-y-6">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 text-center">
               <h2 className="text-6xl font-black text-emerald-600 mb-2 font-mono tracking-tighter">{getShamsiTime()}</h2>
               <p className="text-slate-400 font-bold">{getDayName(new Date())} {getShamsiDate()}</p>
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
                  <ActionBtn icon={<Play />} label="ثبت ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
                  <ActionBtn icon={<Square />} label="ثبت خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
                  <ActionBtn icon={<Coffee />} label="شروع پاس" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
                  <ActionBtn icon={<Clock />} label="پایان پاس" color="bg-indigo-500" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
               </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><History size={20} className="text-emerald-600"/> ۱۰ تردد اخیر</h3>
                <div className="space-y-3">
                  {currentUser.logs.slice(0, 10).map((l, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400">{l.shamsi_date}</span>
                      <span className="text-sm font-black text-slate-700">{l.time}</span>
                      <span className="text-[9px] font-black bg-white px-2 py-1 rounded-lg border text-slate-500">{l.type.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2"><Users size={20} className="text-indigo-600"/> لیست همکاران</h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {colleagues.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${c.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        <span className="text-xs font-black text-slate-700">{c.name}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-[8px] font-black text-slate-400">{c.event}</p>
                        <p className="text-[10px] font-mono font-black text-indigo-600">{c.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-indigo-600"><Send size={20}/> ثبت درخواست دورکاری</h3>
              <form onSubmit={submitReq} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 mr-2">تاریخ شمسی</label>
                  <input className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-mono font-bold" value={reqForm.date} onChange={e => setReqForm({...reqForm, date: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 mr-2">ساعت</label>
                    <input type="number" className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-bold" value={reqForm.h} onChange={e => setReqForm({...reqForm, h: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 mr-2">دقیقه</label>
                    <input type="number" className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-bold" value={reqForm.m} onChange={e => setReqForm({...reqForm, m: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 mr-2">شرح مختصر</label>
                  <textarea className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-bold" rows={3} value={reqForm.desc} onChange={e => setReqForm({...reqForm, desc: e.target.value})} />
                </div>
                <button disabled={syncing} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all">ارسال درخواست</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'FULL_HISTORY' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4">
          <h3 className="text-xl font-black mb-8 flex items-center gap-2"><History size={24} className="text-emerald-600"/> تاریخچه کامل ترددها</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-4 rounded-r-2xl">تاریخ</th>
                  <th className="p-4">ساعت</th>
                  <th className="p-4 rounded-l-2xl">نوع رویداد</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {currentUser.logs.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-slate-500">{l.shamsi_date}</td>
                    <td className="p-4 font-mono font-black text-emerald-600">{l.time}</td>
                    <td className="p-4 font-black text-xs text-slate-400">{l.type.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'REQUEST_STATUS' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4">
          <h3 className="text-xl font-black mb-8 flex items-center gap-2"><ClipboardList size={24} className="text-indigo-600"/> وضعیت درخواست‌های من</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRequests.map((r, i) => (
              <div key={i} className="p-5 bg-slate-50 rounded-2xl border">
                <div className="flex justify-between mb-4">
                  <span className="text-[10px] font-black text-indigo-600 uppercase">{r.type.replace(/_/g, ' ')}</span>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black ${
                    r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 
                    r.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {r.status === 'APPROVED' ? 'تایید شده' : r.status === 'REJECTED' ? 'رد شده' : 'در انتظار'}
                  </span>
                </div>
                <p className="text-xs font-black text-slate-800 mb-2">{r.shamsi_date}</p>
                <p className="text-[11px] text-slate-400 italic mb-4">"{r.description || 'بدون شرح'}"</p>
                <div className="text-[9px] font-black text-slate-500 bg-white p-2 rounded-lg border">مقدار: {r.remote_hours} ساعت و {r.remote_minutes} دقیقه</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-sm transition-all ${
    active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-400 hover:bg-slate-50'
  }`}>
    {icon} <span>{label}</span>
  </button>
);

const ActionBtn = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-6 rounded-[2rem] flex flex-col items-center gap-3 shadow-md hover:scale-105 transition-all group`}>
    <div className="p-3 bg-white/20 rounded-xl">{icon}</div>
    <span className="text-[10px] font-black tracking-widest">{label}</span>
  </button>
);

export default Dashboard;
