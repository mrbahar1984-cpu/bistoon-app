
import React, { useState } from 'react';
import { EmployeeData, LogType, AttendanceLog } from './types';
import { getShamsiDate, getShamsiTime, getDayName } from './jalali'; // تغییر مسیر به ریشه
import { supabase } from './supabaseClient';
import { Clock, Play, Square, Coffee, LogOut, UserPlus, LogIn, Fingerprint, RefreshCcw, Wifi, Zap, CheckCircle } from 'lucide-react';

interface Props {
  currentUser: EmployeeData | null;
  onLogin: (user: EmployeeData) => void;
}

const Dashboard: React.FC<Props> = ({ currentUser, onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', nationalId: '', password: '' });
  const [syncing, setSyncing] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    try {
      if (isRegister) {
        const { data, error } = await supabase.from('employees').insert([{ 
          name: formData.name, 
          national_id: formData.nationalId, 
          password: formData.password 
        }]).select();
        if (error) throw error;
        onLogin({ ...data[0], id: data[0].id, nationalId: data[0].national_id, logs: [] });
      } else {
        const { data, error } = await supabase.from('employees').select('*').eq('national_id', formData.nationalId).eq('password', formData.password).single();
        if (error || !data) throw new Error('کاربر یافت نشد یا رمز عبور اشتباه است');
        const { data: logs } = await supabase.from('attendance_logs').select('*').eq('employee_id', data.id).order('timestamp', { ascending: false });
        onLogin({ 
          id: data.id, 
          name: data.name, 
          nationalId: data.national_id, 
          password: data.password, 
          logs: logs?.map(l => ({ id: l.id, timestamp: l.timestamp, type: l.type as LogType, shamsiDate: l.shams_date, time: l.time })) || [] 
        });
      }
    } catch (err: any) {
      alert('❌ خطا: ' + (err.message || 'مشکل در ارتباط'));
    }
    setSyncing(false);
  };

  const addLog = async (type: LogType) => {
    if (!currentUser?.id) return;
    setSyncing(true);
    const now = new Date();
    try {
      const { data, error } = await supabase.from('attendance_logs').insert([{
        employee_id: currentUser.id,
        type,
        shamsi_date: getShamsiDate(now),
        time: getShamsiTime(now),
        timestamp: now.getTime(),
      }]).select();
      if (error) throw error;
      const newLog: AttendanceLog = { id: data[0].id, timestamp: data[0].timestamp, type: data[0].type as LogType, shamsiDate: data[0].shamsi_date, time: data[0].time };
      onLogin({ ...currentUser, logs: [newLog, ...currentUser.logs] });
    } catch (err) {
      alert('خطا در ثبت ابری!');
    }
    setSyncing(false);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-[#1e293b] p-10 rounded-[3.5rem] shadow-2xl border border-slate-700">
          <h2 className="text-3xl font-black text-center text-white mb-8">
            {isRegister ? 'ثبت‌نام پرسنل' : 'ورود به بیستون 5.0'}
          </h2>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegister && <input required className="w-full p-5 rounded-2xl bg-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none text-white" placeholder="نام" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />}
            <input required className="w-full p-5 rounded-2xl bg-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none text-white" placeholder="کد ملی" value={formData.nationalId} onChange={e => setFormData({...formData, nationalId: e.target.value})} />
            <input required type="password" className="w-full p-5 rounded-2xl bg-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none text-white" placeholder="رمز عبور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            <button disabled={syncing} className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
              {syncing ? <RefreshCcw className="animate-spin" /> : (isRegister ? <UserPlus /> : <LogIn />)}
              {isRegister ? 'ثبت‌نام' : 'ورود'}
            </button>
          </form>
          <button onClick={() => setIsRegister(!isRegister)} className="w-full mt-6 text-slate-500 text-xs font-bold">
            {isRegister ? 'ورود' : 'ثبت‌نام'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      <div className="bg-indigo-500/10 text-indigo-300 p-5 rounded-[2rem] text-xs font-black flex items-center justify-between border border-indigo-500/20">
        <div className="flex items-center gap-4">
           <Wifi size={20} className="text-emerald-400" />
           <span>نسخه ۵.۰ ابری - فعال</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#1e293b] p-10 rounded-[3rem] border border-slate-700 flex items-center justify-between shadow-2xl">
             <div className="flex items-center gap-8">
                <div className="bg-indigo-600 p-6 rounded-[2rem] text-white font-black text-4xl">{getShamsiTime()}</div>
                <div>
                  <h2 className="text-3xl font-black text-white">{getDayName(new Date())}</h2>
                  <p className="text-slate-400 text-sm font-bold">{getShamsiDate()}</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
             <ActionButton icon={<Play size={32}/>} label="ورود" color="bg-emerald-600" onClick={() => addLog(LogType.CLOCK_IN)} />
             <ActionButton icon={<Square size={32}/>} label="خروج" color="bg-rose-600" onClick={() => addLog(LogType.CLOCK_OUT)} />
             <ActionButton icon={<Coffee size={32}/>} label="مرخصی" color="bg-amber-600" onClick={() => addLog(LogType.HOURLY_LEAVE_START)} />
             <ActionButton icon={<LogOut size={32}/>} label="پایان مرخصی" color="bg-slate-600" onClick={() => addLog(LogType.HOURLY_LEAVE_END)} />
          </div>

          <div className="bg-[#1e293b] rounded-[3rem] border border-slate-700 overflow-hidden shadow-2xl p-8 space-y-4">
             {currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).map(log => (
                <div key={log.id} className="flex items-center justify-between p-6 bg-slate-800 rounded-3xl border border-slate-700">
                   <span className="text-sm font-bold text-slate-300">{log.type}</span>
                   <span className="font-mono font-black text-2xl text-indigo-400">{log.time}</span>
                </div>
             ))}
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-10 rounded-[3.5rem] shadow-2xl text-white">
           <h3 className="text-2xl font-black">پنل کاربری</h3>
           <p className="mt-4 opacity-80">{currentUser.name}</p>
           <div className="mt-10 bg-black/20 p-8 rounded-3xl text-center">
              <p className="text-7xl font-black">{currentUser.logs.filter(l => l.shamsiDate === getShamsiDate()).length}</p>
              <p className="text-xs mt-4">ترددهای امروز</p>
           </div>
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({ icon, label, color, onClick }: any) => (
  <button onClick={onClick} className={`${color} text-white p-10 rounded-[2.5rem] shadow-xl flex flex-col items-center justify-center gap-5 active:scale-90 transition-all`}>
    {icon}
    <span className="font-black text-xs">{label}</span>
  </button>
);

export default Dashboard;
