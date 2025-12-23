
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { EmployeeData, LogType, LeaveRequest, LeaveType } from './types';
import { getShamsiDate, getShamsiTime, getDayName, toEnglishDigits } from './jalali';
import { Play, Square, Coffee, Clock, Send, History, Calendar, Monitor, ClipboardList, LogIn, RefreshCcw, Flower2, UserPlus, LogOut, CheckCircle, XCircle } from 'lucide-react';

interface Props {
  currentUser: EmployeeData | null;
  onLogin: (user: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ currentUser, onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', nationalId: '', password: '' });
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'ACTIONS' | 'HISTORY' | 'REQUESTS'>('ACTIONS');
  
  const [reqForm, setReqForm] = useState<{ type: LeaveType, date: string, amount: number, desc: string }>({
    type: 'DAILY_LEAVE',
    date: getShamsiDate(),
    amount: 1,
    desc: ''
  });
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);

  const fetchMyData = async () => {
    if (!currentUser?.id) return;
    setSyncing(true);
    const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', currentUser.id).order('timestamp', { ascending: false });
    const { data: reqs } = await supabase.from('leave_requests').select('*').eq('employee_id', currentUser.id).order('timestamp', { ascending: false });
    
    if (logs) onLogin({ ...currentUser, logs: logs.map(l => ({ ...l, shamsiDate: l.shamsi_date })) });
    if (reqs) setMyRequests(reqs);
    setSyncing(false);
  };

  useEffect(() => { if (currentUser) fetchMyData(); }, [currentUser?.id]);

  const addLog = async (type: LogType) => {
    if (!currentUser?.id) return;
    setSyncing(true);
    try {
      await supabase.from('attendance_logs').insert([{
        employee_id: currentUser.id,
        type,
        shamsi_date: getShamsiDate(),
        time: getShamsiTime(),
        timestamp: Date.now()
      }]);
      fetchMyData();
    } catch (e) { alert('خطا در ثبت تردد'); }
    setSyncing(false);
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    setSyncing(true);
    try {
      const { error } = await supabase.from('leave_requests').insert([{
        employee_id: currentUser.id,
        type: reqForm.type,
        amount: reqForm.amount,
        shamsi_date: toEnglishDigits(reqForm.date),
        description: reqForm.desc,
        status: 'PENDING',
        timestamp: Date.now()
      }]);
      if (error) throw error;
      alert('درخواست شما با موفقیت ارسال شد و در انتظار تایید مدیر است.');
      setReqForm({ ...reqForm, desc: '' });
      fetchMyData();
    } catch (e) { alert('خطا در ارسال درخواست'); }
    setSyncing(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    const cleanId = toEnglishDigits(formData.nationalId);
    try {
      if (isRegister) {
        const { data, error } = await supabase.from('employees').insert([{ name: formData.name, national_id: cleanId, password: formData.password }]).select();
        if (error) throw error;
        onLogin({ ...data[0], nationalId: data[0].national_id, logs: [] });
      } else {
        const { data, error } = await supabase.from('employees').select('*').eq('national_id', cleanId).eq('password', formData.password).single();
        if (error || !data) throw new Error('کد ملی یا رمز عبور اشتباه است');
        onLogin({ ...data, nationalId: data.national_id, logs: [] });
      }
    } catch (err: any) { alert(err.message); }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-[3rem] shadow-2xl border border-slate-100">
        <div className="flex justify-center mb-8"><div className="bg-emerald-600 p-5 rounded-[2rem] text-white shadow-lg shadow-emerald-100"><Flower2 size={40}/></div></div>
        <h2 className="text-2xl font-black text-center mb-8 text-slate-800">ورود به BaharTime</h2>
        <form onSubmit={handleAuth} className="space-y-4">
          {isRegister && <input required className="w-full p-4 rounded-2xl bg-slate-50 border outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="نام و نام خانوادگی" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
          <input required className="w-full p-4 rounded-2xl bg-slate-50 border outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono" placeholder="کد ملی" value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} />
          <input required type="password" className="w-full p-4 rounded-2xl bg-slate-50 border outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="رمز عبور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          <button disabled={syncing} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-100">
            {syncing ? <RefreshCcw className="animate-spin" /> : <LogIn size={20}/>} {isRegister ? 'ایجاد حساب' : 'ورود به سامانه'}
          </button>
        </form>
        <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-xs text-slate-400 font-bold hover:text-emerald-600 transition-colors">
          {isRegister ? 'حساب دارید؟ وارد شوید' : 'هنوز ثبت‌نام نکرده‌اید؟ کلیک کنید'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <nav className="flex gap-2 bg-white p-2 rounded-3xl shadow-sm border border-slate-100 w-fit mx-auto sticky top-4 z-10">
        <TabBtn active={activeTab === 'ACTIONS'} label="ثبت تردد و پاس" icon={<Play size={18}/>} onClick={() => setActiveTab('ACTIONS')} />
        <TabBtn active={activeTab === 'HISTORY'} label="تاریخچه ترددها" icon={<History size={18}/>} onClick={() => setActiveTab('HISTORY')} />
        <TabBtn active={activeTab === 'REQUESTS'} label="درخواست‌های من" icon={<ClipboardList size={18}/>} onClick={() => setActiveTab('REQUESTS')} />
      </nav>

      {activeTab === 'ACTIONS' && (
        <div className="grid md:grid-cols-12 gap-6">
          <div className="md:col-span-8 space-y-6">
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col items-center relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
               <h2 className="text-6xl font-black text-emerald-600 mb-2 font-mono tracking-tighter">{getShamsiTime()}</h2>
               <p className="text-slate-400 font-bold text-lg">{getDayName(new Date())} {getShamsiDate()}</p>
               
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12 w-full">
                  <ActionBtn icon={<Play />} label="ثبت ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
                  <ActionBtn icon={<Square />} label="ثبت خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
                  <ActionBtn icon={<Coffee />} label="شروع پاس" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
                  <ActionBtn icon={<Clock />} label="پایان پاس" color="bg-indigo-500" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
               </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
               <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3 text-lg"><History size={22} className="text-emerald-600"/> ترددهای ثبت شده امروز</h3>
               <div className="space-y-3">
                  {currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length === 0 ? (
                    <div className="text-center py-10 text-slate-300 font-bold italic">هنوز ترددی ثبت نکرده‌اید.</div>
                  ) : (
                    currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).map((l, i) => (
                      <div key={i} className="flex justify-between items-center p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 hover:border-emerald-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${l.type.includes('IN') ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          <span className="text-sm font-black text-slate-700">{l.type.replace(/_/g, ' ')}</span>
                        </div>
                        <span className="text-lg font-mono font-black text-emerald-600">{l.time}</span>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </div>

          <div className="md:col-span-4">
             <div className="bg-gradient-to-br from-indigo-600 to-emerald-600 p-8 rounded-[3rem] text-white shadow-xl sticky top-24">
                <div className="flex justify-between items-start mb-10">
                   <div>
                      <h3 className="text-2xl font-black mb-1">{currentUser.name}</h3>
                      <p className="text-xs opacity-70 font-mono tracking-widest">{currentUser.nationalId}</p>
                   </div>
                   <div className="bg-white/20 p-2 rounded-2xl"><Monitor size={20}/></div>
                </div>
                <div className="bg-white/10 p-6 rounded-[2rem] backdrop-blur-md border border-white/10">
                   <p className="text-xs font-bold mb-2 opacity-80 text-emerald-100">کل تردد های امروز</p>
                   <p className="text-5xl font-black">{currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length}</p>
                </div>
                <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-3">
                   <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></div>
                   <span className="text-[10px] font-black uppercase tracking-widest opacity-80">System Connected</span>
                </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><History size={24} className="text-emerald-600"/> تاریخچه ۳۰ روز اخیر</h3>
            <span className="text-[10px] bg-slate-100 px-4 py-2 rounded-full font-black text-slate-500 uppercase">Archive Mode</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-5 rounded-r-[1.5rem]">تاریخ شمسی</th>
                  <th className="p-5">زمان ثبت</th>
                  <th className="p-5">روز هفته</th>
                  <th className="p-5 rounded-l-[1.5rem]">نوع تردد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentUser.logs.slice(0, 50).map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-5 font-mono font-bold text-slate-600">{l.shamsiDate}</td>
                    <td className="p-5 font-mono font-black text-emerald-600 text-lg">{l.time}</td>
                    <td className="p-5 text-slate-400 font-bold text-xs">{getDayName(new Date(l.timestamp))}</td>
                    <td className="p-5">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        l.type.includes('IN') ? 'bg-emerald-100 text-emerald-700' : 
                        l.type.includes('OUT') ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {l.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'REQUESTS' && (
        <div className="grid md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
           <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-3 text-slate-800"><Send size={22} className="text-indigo-600"/> ثبت درخواست جدید</h3>
              <form onSubmit={submitRequest} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">نوع درخواست</label>
                    <select className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer" value={reqForm.type} onChange={e => setReqForm({...reqForm, type: e.target.value as LeaveType})}>
                        <option value="DAILY_LEAVE">🌴 مرخصی روزانه (روز)</option>
                        <option value="HOURLY_PASS">⏱️ پاس ساعتی (ساعت)</option>
                        <option value="REMOTE_WORK">🏠 دورکاری (ساعت)</option>
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">تاریخ</label>
                       <input className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-mono font-bold border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500" value={reqForm.date} onChange={e => setReqForm({...reqForm, date: e.target.value})} placeholder="۱۴۰۳/۰۱/۰۱" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">مقدار واحد</label>
                       <input type="number" step="0.5" className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-mono font-bold border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500" value={reqForm.amount} onChange={e => setReqForm({...reqForm, amount: Number(e.target.value)})} placeholder="۱" />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">توضیحات و علت</label>
                    <textarea className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border border-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" rows={4} placeholder="شرح مختصری بنویسید..." value={reqForm.desc} onChange={e => setReqForm({...reqForm, desc: e.target.value})} />
                 </div>
                 <button disabled={syncing} className="w-full bg-indigo-600 text-white p-5 rounded-[2rem] font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
                    {syncing ? <RefreshCcw className="animate-spin" /> : <Send size={20}/>} ارسال درخواست برای مدیر
                 </button>
              </form>
           </div>

           <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
              <h3 className="text-xl font-black mb-8 border-b pb-4 flex items-center gap-3 text-slate-800"><ClipboardList size={22} className="text-emerald-600"/> پیگیری وضعیت درخواست‌ها</h3>
              <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                 {myRequests.length === 0 ? (
                   <div className="text-center py-20 text-slate-300 font-bold italic">هنوز درخواستی ارسال نکرده‌اید.</div>
                 ) : (
                   myRequests.map((r, i) => (
                     <div key={i} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 hover:border-indigo-100 transition-all">
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <p className="text-xs font-black text-slate-800 mb-1 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                {r.type === 'DAILY_LEAVE' ? 'مرخصی روزانه' : r.type === 'HOURLY_PASS' ? 'پاس ساعتی' : 'دورکاری'}
                              </p>
                              <p className="text-[10px] font-mono font-bold text-slate-400">{r.shamsi_date}</p>
                           </div>
                           <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-wider flex items-center gap-2 ${
                             r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 
                             r.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                           }`}>
                             {r.status === 'APPROVED' && <CheckCircle size={10}/>}
                             {r.status === 'REJECTED' && <XCircle size={10}/>}
                             {r.status === 'PENDING' && <RefreshCcw size={10} className="animate-spin"/>}
                             {r.status === 'APPROVED' ? 'تایید شد' : r.status === 'REJECTED' ? 'رد شد' : 'در انتظار'}
                           </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-bold bg-white p-3 rounded-xl border border-slate-50">{r.description || 'بدون توضیح'}</p>
                        <div className="mt-4 flex justify-end">
                           <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">مقدار: {r.amount} واحد</span>
                        </div>
                     </div>
                   ))
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-sm transition-all whitespace-nowrap ${
    active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'text-slate-400 hover:bg-slate-50'
  }`}>
    {icon} <span>{label}</span>
  </button>
);

const ActionBtn = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-8 rounded-[2.5rem] flex flex-col items-center gap-4 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all group`}>
    <div className="p-4 bg-white/20 rounded-[1.5rem] group-hover:rotate-12 transition-transform">{icon}</div>
    <span className="text-xs font-black uppercase tracking-widest">{label}</span>
  </button>
);

export default Dashboard;
