
import React, { useState, useEffect } from 'react';
import { EmployeeData, LogType, AttendanceLog, LeaveRequest, LeaveType } from './types';
import { getShamsiDate, getShamsiTime, getDayName, toEnglishDigits } from './jalali';
import { supabase } from './supabaseClient';
import { Play, Square, Coffee, LogOut, UserPlus, LogIn, RefreshCcw, Wifi, MessageSquare, Send, Users, Flower2, Clock, Calendar, ListChecks, ArrowLeftRight, Monitor, History } from 'lucide-react';

interface Props {
  currentUser: EmployeeData | null;
  onLogin: (user: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ currentUser, onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', nationalId: '', password: '' });
  const [syncing, setSyncing] = useState(false);
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [remoteReq, setRemoteReq] = useState({ date: getShamsiDate(), hours: 8, desc: '' });
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);

  const fetchMyRequests = async () => {
    if (!currentUser?.id) return;
    const { data } = await supabase.from('leave_requests').select('*').eq('employee_id', currentUser.id).order('timestamp', { ascending: false });
    if (data) setMyRequests(data);
  };

  const submitRemoteRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    setSyncing(true);
    try {
      const { error } = await supabase.from('leave_requests').insert([{
        employee_id: currentUser.id,
        type: 'REMOTE_WORK',
        amount: remoteReq.hours,
        shamsi_date: toEnglishDigits(remoteReq.date),
        description: remoteReq.desc,
        status: 'PENDING',
        timestamp: Date.now()
      }]);
      if (error) throw error;
      alert('✅ درخواست دورکاری ارسال شد و منتظر تایید مدیر است.');
      setRemoteReq({ ...remoteReq, desc: '' });
      fetchMyRequests();
    } catch (e) { alert('خطا در ارسال'); }
    setSyncing(false);
  };

  const refreshUserLogs = async () => {
    if (!currentUser?.id) return;
    const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', currentUser.id).order('shamsi_date', { ascending: false }).order('time', { ascending: false }).limit(20);
    if (logs) {
      onLogin({ 
        ...currentUser, 
        logs: logs.map(l => ({ 
          id: l.id, 
          timestamp: l.timestamp, 
          type: l.type as LogType, 
          shamsiDate: l.shamsi_date, 
          time: l.time,
          is_manual: l.is_manual,
          is_edited: l.is_edited
        })) 
      });
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    const cleanId = toEnglishDigits(formData.nationalId);
    try {
      if (isRegister) {
        const { data, error } = await supabase.from('employees').insert([{ 
          name: formData.name, 
          national_id: cleanId, 
          password: formData.password 
        }]).select();
        if (error) throw error;
        onLogin({ ...data[0], id: data[0].id, nationalId: data[0].national_id, logs: [] });
      } else {
        const { data, error } = await supabase.from('employees').select('*').eq('national_id', cleanId).eq('password', formData.password).single();
        if (error || !data) throw new Error('کد ملی یا رمز عبور اشتباه است');
        const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', data.id).order('timestamp', { ascending: false });
        onLogin({ ...data, id: data.id, logs: logs?.map(l => ({ ...l, shamsiDate: l.shamsi_date })) || [] });
      }
    } catch (err: any) { alert('❌ خطا: ' + err.message); }
    setSyncing(false);
  };

  useEffect(() => {
    if (currentUser) {
      fetchColleagues();
      refreshUserLogs();
      fetchMyRequests();
    }
  }, [currentUser?.id]);

  const fetchColleagues = async () => {
    const today = getShamsiDate();
    const { data } = await supabase.from('attendance_logs').select('*, employees(name)').eq('shamsi_date', today);
    if (data) {
      const last = {};
      data.forEach((l: any) => { if (l.employees) last[l.employee_id] = { name: l.employees.name, time: l.time, type: l.type }; });
      setColleagues(Object.values(last));
    }
  };

  const addLog = async (type: LogType) => {
    if (!currentUser?.id) return;
    setSyncing(true);
    try {
      await supabase.from('attendance_logs').insert([{ employee_id: currentUser.id, type, shamsi_date: getShamsiDate(), time: getShamsiTime(), timestamp: Date.now() }]);
      refreshUserLogs();
    } catch (e) { alert('خطا'); }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
          <div className="flex justify-center mb-6"><div className="bg-emerald-500 p-4 rounded-3xl text-white shadow-lg shadow-emerald-100"><Flower2 size={32}/></div></div>
          <h2 className="text-xl font-black text-center text-slate-800 mb-8">ورود به BaharTime</h2>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && <input required className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-emerald-500" placeholder="نام و نام خانوادگی" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
            <input required className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-emerald-500 font-mono" placeholder="کد ملی" value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} />
            <input required type="password" className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none focus:border-emerald-500" placeholder="رمز عبور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <button disabled={syncing} className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black flex items-center justify-center gap-3">
              {syncing ? <RefreshCcw className="animate-spin" /> : <LogIn size={20} />} {isRegister ? 'ایجاد حساب' : 'ورود'}
            </button>
          </form>
          <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-slate-400 text-[10px] font-bold">
            {isRegister ? 'وارد شوید' : 'ثبت‌نام کنید'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600 font-black text-2xl">{getShamsiTime()}</div>
                <div><h2 className="text-lg font-black text-slate-800">{getDayName(new Date())}</h2><p className="text-slate-400 text-[10px] font-bold">{getShamsiDate()}</p></div>
             </div>
             <div className="hidden md:flex bg-slate-50 p-3 rounded-2xl items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                <span className="text-[10px] font-black text-slate-600">سیستم آنلاین</span>
             </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <ActionBtn icon={<Play />} label="ورود" color="bg-emerald-500" onClick={() => addLog(LogType.CLOCK_IN)} />
             <ActionBtn icon={<Square />} label="خروج" color="bg-rose-500" onClick={() => addLog(LogType.CLOCK_OUT)} />
             <ActionBtn icon={<Coffee />} label="شروع پاس" color="bg-amber-500" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
             <ActionBtn icon={<Clock />} label="پایان پاس" color="bg-indigo-500" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
          </div>

          {/* فرم ثبت دورکاری */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><Monitor size={18}/> ثبت درخواست دورکاری</div>
             <form onSubmit={submitRemoteRequest} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 mr-1">تاریخ</label>
                  <input className="w-full p-3 bg-slate-50 rounded-xl text-xs font-mono" value={remoteReq.date} onChange={e => setRemoteReq({...remoteReq, date: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 mr-1">میزان (ساعت)</label>
                  <input type="number" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-mono" value={remoteReq.hours} onChange={e => setRemoteReq({...remoteReq, hours: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 mr-1">شرح فعالیت</label>
                  <input className="w-full p-3 bg-slate-50 rounded-xl text-xs" placeholder="..." value={remoteReq.desc} onChange={e => setRemoteReq({...remoteReq, desc: e.target.value})} />
                </div>
                <button disabled={syncing} className="md:col-span-3 bg-indigo-600 text-white p-4 rounded-2xl font-black text-xs shadow-lg flex items-center justify-center gap-2">
                  <Send size={16}/> ارسال درخواست برای مدیر
                </button>
             </form>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
             <div className="flex items-center gap-2 font-black text-slate-700 mb-6 border-b pb-4"><History size={18}/> وضعیت درخواست‌های من</div>
             <div className="space-y-2">
                {myRequests.length === 0 ? <p className="text-center text-slate-400 text-xs py-4">درخواستی ندارید.</p> : 
                  myRequests.slice(0, 5).map((req, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-700">{req.type === 'REMOTE_WORK' ? 'دورکاری' : 'مرخصی'} - {req.shamsi_date}</span>
                          <span className="text-[9px] text-slate-400">{req.amount} ساعت - {req.description}</span>
                       </div>
                       <span className={`text-[8px] font-black px-2 py-1 rounded-full ${req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : req.status === 'REJECTED' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                          {req.status === 'APPROVED' ? 'تایید شد' : req.status === 'REJECTED' ? 'رد شد' : 'در انتظار'}
                       </span>
                    </div>
                  ))
                }
             </div>
          </div>
        </div>

        <div className="md:col-span-4 space-y-6">
           <div className="bg-gradient-to-br from-emerald-600 to-indigo-700 p-8 rounded-[3rem] text-white shadow-xl">
              <h3 className="text-xl font-black mb-1">{currentUser.name}</h3>
              <p className="text-[10px] opacity-70 mb-8">خوش آمدید</p>
              <div className="bg-white/10 p-6 rounded-3xl backdrop-blur-md">
                 <p className="text-4xl font-black">{currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length}</p>
                 <p className="text-[10px] mt-2">تردد امروز</p>
              </div>
           </div>
           
           <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 font-black text-slate-700 mb-4 pb-2 border-b"><Users size={18}/> همکاران حاضر</div>
              <div className="space-y-2">
                 {colleagues.filter(c => c.type === LogType.CLOCK_IN).map((c, i) => (
                   <div key={i} className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                      <span className="text-[10px] font-black text-emerald-700">{c.name}</span>
                      <span className="text-[8px] font-mono text-emerald-500">{c.time}</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const ActionBtn = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-5 rounded-[2.2rem] flex flex-col items-center gap-2 shadow-lg active:scale-95 transition-all`}>
    <div className="p-2 bg-white/20 rounded-xl">{icon}</div>
    <span className="text-[10px] font-black">{label}</span>
  </button>
);

export default Dashboard;
