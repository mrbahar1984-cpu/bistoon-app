
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
  const [successMsg, setSuccessMsg] = useState('');
  
  const [reqForm, setReqForm] = useState({ 
    type: 'REMOTE_WORK' as LeaveType, 
    date: getShamsiDate(), 
    h: 0, m: 0, 
    days: 1,
    desc: '' 
  });
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);

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
    const today = toEnglishDigits(getShamsiDate());
    const time = getShamsiTime();
    await supabase.from('attendance_logs').insert([{
      employee_id: currentUser?.id,
      type,
      shamsi_date: today,
      time: time,
      timestamp: Date.now()
    }]);
    loadData();
  };

  const submitReq = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    
    let amount = 0;
    if (reqForm.type === 'REMOTE_WORK') {
        // فیکس کردن مقدار اعشاری جهت جلوگیری از خطا در صورت عدم پشتیبانی دیتابیس
        amount = Number((reqForm.h + (reqForm.m / 60)).toFixed(2));
    } else if (reqForm.type === 'DAILY_LEAVE') {
        amount = reqForm.days;
    } else if (reqForm.type === 'HOURLY_PASS') {
        amount = 1; 
    }

    const { error } = await supabase.from('leave_requests').insert([{
      employee_id: currentUser?.id,
      type: reqForm.type,
      amount: amount,
      remote_hours: reqForm.type === 'REMOTE_WORK' ? reqForm.h : null,
      remote_minutes: reqForm.type === 'REMOTE_WORK' ? reqForm.m : null,
      shamsi_date: toEnglishDigits(reqForm.date),
      description: reqForm.desc,
      status: 'PENDING',
      timestamp: Date.now()
    }]);

    if (!error) {
        setSuccessMsg('ارسال با موفقیت انجام شد برای دیدن وضعیت به بخش درخواستها مراجعه کنید');
        setTimeout(() => setSuccessMsg(''), 6000);
        setReqForm({ ...reqForm, desc: '', h: 0, m: 0, days: 1 });
        loadData();
    } else {
        console.error("Database Insert Error:", error);
        alert(`خطا در ثبت درخواست: ممکن است ستون amount در دیتابیس اعشار نپذیرد. لطفا ستون را به decimal تغییر دهید.`);
    }
    setSyncing(false);
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
        <TabBtn active={activeTab === 'FULL_HISTORY'} label="تاریخچه کامل" icon={<History size={18}/>} onClick={() => setActiveTab('FULL_HISTORY')} />
        <TabBtn active={activeTab === 'REQUEST_STATUS'} label="وضعیت درخواست‌ها" icon={<ClipboardList size={18}/>} onClick={() => setActiveTab('REQUEST_STATUS')} />
      </nav>

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
                <div className="space-y-3">
                  {currentUser.logs.slice(0, 10).map((l, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white transition-all group">
                      <span className="text-[10px] font-black text-slate-400">{l.shamsi_date}</span>
                      <span className="text-sm font-black text-slate-700 group-hover:text-emerald-600">{l.time}</span>
                      <span className="text-[9px] font-black bg-white px-2 py-1 rounded-lg border text-slate-500">{l.type.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                  {currentUser.logs.length === 0 && <p className="text-center py-10 text-slate-300 text-xs italic">هنوز ترددی ثبت نشده است.</p>}
                </div>
              </div>

              <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><Users size={20} className="text-indigo-600"/> لیست همکاران</h3>
                <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                  {colleagues.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border hover:bg-white transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${c.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        <span className="text-xs font-black text-slate-700">{c.name}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-[8px] font-black text-slate-400 uppercase">{c.event}</p>
                        <p className="text-[10px] font-mono font-black text-indigo-600">{c.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden relative">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-indigo-600 border-b pb-4"><Send size={20}/> ثبت درخواست جدید</h3>
              
              {successMsg && (
                <div className="mb-4 p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-[11px] font-black border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                  <CheckCircle size={16} className="inline-block ml-2 text-emerald-600" />
                  {successMsg}
                </div>
              )}

              <form onSubmit={submitReq} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 mr-2">نوع درخواست</label>
                  <select required className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-black text-sm" value={reqForm.type} onChange={e => setReqForm({...reqForm, type: e.target.value as LeaveType})}>
                    <option value="REMOTE_WORK">دورکاری</option>
                    <option value="HOURLY_PASS">پاس ساعتی (فقط شرح)</option>
                    <option value="DAILY_LEAVE">مرخصی روزانه</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 mr-2">تاریخ (شمسی)</label>
                  <input required className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-mono font-bold text-center" value={reqForm.date} onChange={e => setReqForm({...reqForm, date: e.target.value})} />
                </div>

                {reqForm.type === 'REMOTE_WORK' && (
                    <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-right-2">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 mr-2">ساعت</label>
                            <input required type="number" min="0" className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-bold text-center" value={reqForm.h} onChange={e => setReqForm({...reqForm, h: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 mr-2">دقیقه</label>
                            <input required type="number" min="0" max="59" className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-bold text-center" value={reqForm.m} onChange={e => setReqForm({...reqForm, m: Number(e.target.value)})} />
                        </div>
                    </div>
                )}

                {reqForm.type === 'DAILY_LEAVE' && (
                    <div className="space-y-2 animate-in slide-in-from-right-2">
                        <label className="text-[10px] font-black text-slate-400 mr-2">تعداد روز</label>
                        <input required type="number" min="1" className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-bold text-center" value={reqForm.days} onChange={e => setReqForm({...reqForm, days: Number(e.target.value)})} />
                    </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 mr-2">شرح مختصر</label>
                  <textarea required className="w-full p-3 bg-slate-50 rounded-xl border-none outline-none font-bold text-sm" rows={3} value={reqForm.desc} onChange={e => setReqForm({...reqForm, desc: e.target.value})} />
                </div>
                <button disabled={syncing} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                  {syncing ? <RefreshCcw className="animate-spin" size={18} /> : <Send size={18}/>}
                  ارسال درخواست
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'FULL_HISTORY' && (
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4">
          <h3 className="text-2xl font-black mb-8 flex items-center gap-2"><History size={28} className="text-emerald-600"/> تاریخچه کامل ترددها</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-5 rounded-r-2xl font-black">تاریخ ثبت</th>
                  <th className="p-5 font-black">ساعت دقیق</th>
                  <th className="p-5 rounded-l-2xl font-black">نوع رویداد تردد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentUser.logs.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-5 font-mono font-bold text-slate-500">{l.shamsi_date}</td>
                    <td className="p-5 font-mono font-black text-emerald-600 text-lg">{l.time}</td>
                    <td className="p-5"><span className="px-3 py-1 rounded-full bg-white border text-[10px] font-black text-slate-400">{l.type.replace(/_/g, ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'REQUEST_STATUS' && (
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 animate-in slide-in-from-bottom-4">
          <h3 className="text-2xl font-black mb-8 flex items-center gap-2"><ClipboardList size={28} className="text-indigo-600"/> وضعیت درخواست‌های ثبت شده</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myRequests.map((r, i) => (
              <div key={i} className="p-6 bg-slate-50 rounded-[2.5rem] border hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-black text-indigo-600 bg-white px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-tighter">{r.type.replace(/_/g, ' ')}</span>
                  <span className={`px-4 py-1 rounded-full text-[10px] font-black shadow-sm ${
                    r.status === 'APPROVED' ? 'bg-emerald-500 text-white' : 
                    r.status === 'REJECTED' ? 'bg-rose-500 text-white' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {r.status === 'APPROVED' ? 'تایید نهایی' : r.status === 'REJECTED' ? 'رد شده' : 'در انتظار'}
                  </span>
                </div>
                <p className="text-sm font-black text-slate-800 mb-1">{r.shamsi_date}</p>
                <p className="text-xs text-slate-400 italic mb-6 min-h-[40px]">"{r.description || 'درخواست بدون شرح'}"</p>
                <div className="text-[11px] font-black text-slate-500 bg-white p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                  <span>جزئیات:</span>
                  <span className="font-mono text-indigo-600">
                      {r.type === 'REMOTE_WORK' ? `${r.remote_hours} ساعت و ${r.remote_minutes} دقیقه` : 
                       r.type === 'DAILY_LEAVE' ? `${r.amount} روز` : 'پاس ساعتی'}
                  </span>
                </div>
              </div>
            ))}
            {myRequests.length === 0 && <div className="col-span-full py-20 text-center text-slate-300 italic font-bold">هیچ درخواستی ثبت نشده است.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-8 py-5 rounded-2xl font-black text-sm transition-all ${
    active ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-100 scale-105' : 'text-slate-400 hover:bg-slate-50'
  }`}>
    {icon} <span>{label}</span>
  </button>
);

const ActionBtn = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-8 rounded-[2.5rem] flex flex-col items-center gap-3 shadow-lg hover:scale-105 transition-all group active:scale-95`}>
    <div className="p-4 bg-white/20 rounded-2xl group-hover:rotate-12 transition-transform">{icon}</div>
    <span className="text-xs font-black tracking-widest">{label}</span>
  </button>
);

export default Dashboard;
